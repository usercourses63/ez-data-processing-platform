import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Table, Card, Alert, Spin, Tag, Popconfirm, message, Select, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined, ClockCircleOutlined, FilterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { humanizeCron } from '../../components/datasource/shared/helpers';
import { getAllCategories } from '../../services/categories-api-client';

const { Title, Paragraph } = Typography;
const { Option } = Select;

// TypeScript interfaces for API response
interface DataSource {
  ID: string;
  Name: string;
  SupplierName: string;
  Category: string;
  Description?: string;
  ConnectionString?: string;
  IsActive: boolean;
  ConfigurationSettings?: string;
  ValidationRules?: string;
  Metadata?: string;
  FileFormat?: string;
  RetentionDays?: number;
  CreatedAt: string;
  UpdatedAt: string;
  LastProcessedAt?: string;
  TotalFilesProcessed: number;
  TotalErrorRecords: number;
  JsonSchema?: {
    $schema?: string;
    title?: string;
    description?: string;
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  SchemaVersion?: number;
  ScheduleFrequency?: string;
  ScheduleEnabled?: boolean;
}

interface PagedResult<T> {
  Items: T[];
  Page: number;
  Size: number;
  TotalItems: number;
  TotalPages: number;
  HasNextPage: boolean;
  HasPreviousPage: boolean;
}

interface ApiResponse<T> {
  CorrelationId: string;
  Data: T;
  Error: any;
  IsSuccess: boolean;
}

const DataSourceList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 25,
    total: 0,
  });
  const [sortInfo, setSortInfo] = useState<any>({
    order: 'ascend',
    field: 'CreatedAt',
    columnKey: 'CreatedAt'
  });
  const [triggeringMap, setTriggeringMap] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Fetch categories for filter dropdown
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const cats = await getAllCategories(false); // Only active
        setCategories(cats);
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Refetch datasources when filters change
  useEffect(() => {
    if (pagination.current > 0) {
      fetchDataSources(1, pagination.pageSize);
    }
  }, [categoryFilter, statusFilter]);

  // Handle manual trigger
  const handleManualTrigger = async (id: string, name: string) => {
    setTriggeringMap(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`http://localhost:5004/api/v1/scheduling/datasources/${id}/trigger`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        message.success(`הפעלה ידנית עבור "${name}" בוצעה בהצלחה!`, 2);
      } else {
        const errorData = await response.json().catch(() => null);
        message.error(errorData?.message || `שגיאה בהפעלה ידנית עבור "${name}"`);
      }
    } catch (err) {
      console.error('Error triggering manual execution:', err);
      message.error('שגיאה בחיבור לשרת התזמון');
    } finally {
      setTriggeringMap(prev => ({ ...prev, [id]: false }));
    }
  };

  // Handle status change
  const handleStatusChange = async (id: string, isActive: boolean) => {
    try {
      // First fetch the current data source to get all required fields
      const getResponse = await fetch(`http://localhost:5001/api/v1/datasource/${id}`);
      const getData: ApiResponse<DataSource> = await getResponse.json();
      
      if (!getData.IsSuccess || !getData.Data) {
        throw new Error('Failed to fetch current data source data');
      }
      
      const currentDataSource = getData.Data;
      
      // Now update with all required fields including ConnectionString
      const response = await fetch(`http://localhost:5001/api/v1/datasource/${id}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Id: id,
          Name: currentDataSource.Name,
          SupplierName: currentDataSource.SupplierName,
          Category: currentDataSource.Category,
          Description: currentDataSource.Description || '',
          ConnectionString: currentDataSource.ConnectionString || '/data/uploads',
          IsActive: isActive,
          ConfigurationSettings: currentDataSource.ConfigurationSettings,
          ValidationRules: currentDataSource.ValidationRules,
          Metadata: currentDataSource.Metadata,
          FileFormat: currentDataSource.FileFormat,
          RetentionDays: currentDataSource.RetentionDays
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();
      if (data.IsSuccess) {
        message.success(isActive ? 'מקור הנתונים הופעל' : 'מקור הנתונים הושבת');
        // Refetch to ensure UI shows latest data
        await fetchDataSources(pagination.current, pagination.pageSize);
      } else {
        throw new Error(data.Error?.Message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      message.error('שגיאה בעדכון סטטוס');
      // Refetch to revert optimistic UI update
      await fetchDataSources(pagination.current, pagination.pageSize);
    }
  };

  // Helper function to get translated category label
  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'financial': t('datasources.categories.financial'),
      'customers': t('datasources.categories.customers'),
      'inventory': t('datasources.categories.inventory'),
      'sales': t('datasources.categories.sales'),
      'operations': t('datasources.categories.operations'),
      'other': t('datasources.categories.other'),
    };
    return categoryMap[category] || category;
  };

  // Define table columns
  const columns: ColumnsType<DataSource> = [
    {
      title: 'מזהה',
      dataIndex: 'ID',
      key: 'id',
      width: 240,
      sorter: false,
      render: (id: string) => (
        <code style={{ 
          fontSize: '11px', 
          fontFamily: 'monospace', 
          color: '#555',
          direction: 'ltr',
          display: 'inline-block',
          textAlign: 'left',
          unicodeBidi: 'bidi-override',
          whiteSpace: 'nowrap',
          overflow: 'visible',
          backgroundColor: '#f5f5f5',
          padding: '2px 6px',
          borderRadius: '3px'
        }}>
          {id}
        </code>
      ),
    },
    {
      title: t('datasources.fields.name'),
      dataIndex: 'Name',
      key: 'Name',
      width: 200,
      sorter: true,
      render: (text: string, record: DataSource) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>{record.SupplierName}</div>
        </div>
      ),
    },
    {
      title: 'סטטוס',
      dataIndex: 'IsActive',
      key: 'status',
      width: 110,
      render: (isActive: boolean, record: DataSource) => (
        <Select
          value={isActive}
          size="small"
          style={{ width: '100%' }}
          onChange={(newStatus: boolean) => handleStatusChange(record.ID, newStatus)}
        >
          <Option value={true}>פעיל</Option>
          <Option value={false}>לא פעיל</Option>
        </Select>
      ),
    },
    {
      title: 'Schema',
      key: 'schema',
      width: 200,
      render: (_, record: DataSource) => {
        const jsonSchema = record.JsonSchema;
        
        // Check if schema exists and has properties
        if (!jsonSchema || !jsonSchema.properties || Object.keys(jsonSchema.properties).length === 0) {
          return (
            <Tag color="default" style={{ direction: 'rtl' }}>
              ללא Schema
            </Tag>
          );
        }
        
        // Extract schema info
        const fieldCount = Object.keys(jsonSchema.properties).length;
        const requiredCount = jsonSchema.required ? jsonSchema.required.length : 0;
        const schemaTitle = jsonSchema.title || jsonSchema.description || 'Schema מוגדר';
        
        return (
          <div style={{ direction: 'rtl', textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: 2 }}>
              📋 {schemaTitle}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>
              {fieldCount} שדות • {requiredCount} חובה
            </div>
          </div>
        );
      }
    },
    {
      title: t('datasources.fields.category'),
      dataIndex: 'Category',
      key: 'Category',
      width: 100,
      sorter: true,
      render: (category: string) => (
        <Tag color="blue">{getCategoryLabel(category)}</Tag>
      ),
    },
    {
      title: 'קבצים',
      dataIndex: 'TotalFilesProcessed',
      key: 'TotalFilesProcessed',
      width: 80,
      sorter: true,
      render: (count: number) => <span style={{ fontWeight: 'bold' }}>{count.toLocaleString(i18n.language)}</span>,
    },
    {
      title: 'תזמון',
      key: 'schedule',
      width: 150,
      render: (_, record: DataSource) => {
        // Parse schedule from ConfigurationSettings
        let scheduleFreq = record.ScheduleFrequency;
        let cronExpr = record.CronExpression;

        if (!scheduleFreq && record.ConfigurationSettings) {
          try {
            const config = JSON.parse(record.ConfigurationSettings);
            scheduleFreq = config?.schedule?.frequency;
            cronExpr = config?.schedule?.cronExpression || cronExpr;
          } catch (e) {
            // Ignore parse errors
          }
        }

        if (scheduleFreq === 'Manual') {
          return <Tag color="orange" icon={<ClockCircleOutlined />}>ידני</Tag>;
        }

        if (cronExpr) {
          return (
            <Tooltip title={cronExpr}>
              <Tag color="green" icon={<ClockCircleOutlined />}>
                {humanizeCron(cronExpr)}
              </Tag>
            </Tooltip>
          );
        }

        return <Tag color="default">לא הוגדר</Tag>;
      },
    },
    {
      title: 'פעולות',
      key: 'actions',
      width: 240,
      render: (_, record: DataSource) => {
        // Check ScheduleFrequency from top-level field or parse from ConfigurationSettings
        let scheduleFrequency = record.ScheduleFrequency;
        let scheduleEnabled = record.ScheduleEnabled;

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/datasources/${record.ID}`)}
            >
              צפה
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/datasources/${record.ID}/edit`)}
            >
              ערוך
            </Button>
            <Popconfirm
              title="מחק מקור נתונים?"
              onConfirm={() => handleDelete(record.ID, record.Name)}
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                מחק
              </Button>
            </Popconfirm>
            <Tooltip title="הפעלה ידנית - עיבוד קבצים חדשים כעת">
              <Button
                type="link"
                size="small"
                icon={<ThunderboltOutlined />}
                loading={triggeringMap[record.ID]}
                onClick={() => handleManualTrigger(record.ID, record.Name)}
                style={{ color: '#52c41a' }}
              >
                הפעל
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  // Fetch data sources from backend
  const fetchDataSources = async (page: number = 1, pageSize: number = 25, sortField?: string, sortOrder?: 'ascend' | 'descend') => {
    setLoading(true);
    setError(null);

    // Map frontend field to backend field
    const sortFieldMap: { [key: string]: string } = {
      'Name': 'Name',
      'Category': 'Category',
      'TotalFilesProcessed': 'TotalFilesProcessed'
    };

    const backendSortField = sortField ? sortFieldMap[sortField] || 'CreatedAt' : 'CreatedAt';
    const backendSortOrder = sortOrder === 'ascend' ? 'Ascending' : 'Descending';

    // Build query parameters with filters
    const params = new URLSearchParams({
      page: page.toString(),
      size: pageSize.toString(),
      sortBy: backendSortField,
      sortDirection: backendSortOrder,
    });

    if (categoryFilter) {
      params.append('category', categoryFilter);
    }

    if (statusFilter !== null) {
      params.append('isActive', statusFilter.toString());
    }

    try {
      const response = await fetch(
        `http://localhost:5001/api/v1/datasource?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<PagedResult<DataSource>> = await response.json();

      if (data.IsSuccess) {
        setDataSources(data.Data.Items);
        setPagination({
          current: data.Data.Page,
          pageSize: data.Data.Size,
          total: data.Data.TotalItems,
        });
      } else {
        throw new Error(data.Error?.Message || 'Failed to fetch data sources');
      }
    } catch (err) {
      console.error('Error fetching data sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data sources');
    } finally {
      setLoading(false);
    }
  };

  // Delete data source
  const handleDelete = async (id: string, name: string) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/v1/datasource/${id}?deletedBy=User`,
        {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<any> = await response.json();

      if (data.IsSuccess) {
        message.success(t('datasources.messages.deleteSuccess', { name }));
        fetchDataSources(pagination.current, pagination.pageSize);
      } else {
        throw new Error(data.Error?.Message || 'Failed to delete data source');
      }
    } catch (err) {
      console.error('Error deleting data source:', err);
      message.error(t('datasources.messages.deleteError', { name }));
    }
  };

  // Load data on component mount with default sorting (CreatedAt ascending = oldest first, by creation order)
  useEffect(() => {
    fetchDataSources(1, 25, 'CreatedAt', 'ascend');
  }, []);

  // Handle table changes (pagination, sorting, filtering)
  const handleTableChange = (paginationInfo: any, filters: any, sorter: any) => {
    const newSortField = sorter.field || 'CreatedAt';
    const newSortOrder = sorter.order || 'ascend';
    
    setSortInfo({
      order: newSortOrder,
      field: newSortField,
      columnKey: newSortField
    });
    
    fetchDataSources(paginationInfo.current, paginationInfo.pageSize, newSortField, newSortOrder);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {t('datasources.title')}
          </Title>
          <Paragraph className="page-subtitle">
            {t('datasources.subtitle')}
          </Paragraph>
        </div>
        <Space>
          <Select
            placeholder={<><FilterOutlined /> סנן לפי קטגוריה</>}
            allowClear
            style={{ width: 200 }}
            loading={categoriesLoading}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value || null)}
          >
            {categories.map(cat => (
              <Option key={cat.ID} value={cat.Name}>
                {cat.Name}
              </Option>
            ))}
          </Select>
          <Select
            placeholder={<><FilterOutlined /> סנן לפי סטטוס</>}
            allowClear
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
          >
            <Option value={true}>פעיל</Option>
            <Option value={false}>לא פעיל</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchDataSources(pagination.current, pagination.pageSize)}
            loading={loading}
          >
            {t('common.refresh')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/datasources/new')}
          >
            {t('datasources.create')}
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          message={t('common.error')}
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={dataSources}
            rowKey="ID"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} ${t('common.of')} ${total} ${t('common.items')}`,
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: t('common.noData'),
            }}
            sortDirections={['descend', 'ascend']}
            showSorterTooltip={false}
          />
        </Spin>
      </Card>
    </div>
  );
};

export default DataSourceList;
