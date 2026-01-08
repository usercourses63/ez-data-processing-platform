import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  message,
  Row,
  Col,
  Popconfirm,
  Alert,
  List
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { schemaApiClient } from '../../services/schema-api-client';
import { CreateSchemaRequest, SchemaStatus, SchemaTemplate } from '../../types/schema-api';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// TypeScript interfaces
interface SchemaRecord {
  id: string;
  name: string;
  displayName: string;
  description: string;
  dataSourceId?: string;
  dataSourceName?: string;
  version: string;
  status: 'Draft' | 'Active' | 'Inactive' | 'Archived';
  fieldsCount: number;
  usageCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Utility function for data source names
const getDataSourceName = (dataSourceId: string): string => {
  const dataSourceNames: Record<string, string> = {
    ds1: 'נתוני מכירות',
    ds2: 'לקוחות חדשים',
    ds3: 'עדכוני מלאי',
    ds4: 'משאבי אנוש',
    ds5: 'מוצרים'
  };
  return dataSourceNames[dataSourceId] || 'מקור נתונים';
};

// Helper to calculate field count
const calculateFieldCount = (jsonSchemaContent: string): number => {
  try {
    const schema = JSON.parse(jsonSchemaContent);
    const properties = schema?.properties || {};
    return Object.keys(properties).length;
  } catch {
    return 0;
  }
};

// Helper to convert status
const convertStatusToString = (status: number): 'Draft' | 'Active' | 'Inactive' | 'Archived' => {
  const statusMap: Record<number, 'Draft' | 'Active' | 'Inactive' | 'Archived'> = {
    0: 'Draft',
    1: 'Active', 
    2: 'Inactive',
    3: 'Archived'
  };
  return statusMap[status] || 'Draft';
};

// Transform API schema to SchemaRecord  
const transformSchema = (schema: any): SchemaRecord => ({
  id: schema.ID,
  name: schema.Name,
  displayName: schema.DisplayName,
  description: schema.Description,
  dataSourceId: schema.DataSourceId,
  dataSourceName: schema.DataSourceId ? getDataSourceName(schema.DataSourceId) : undefined,
  version: `v${schema.Version}`,
  status: convertStatusToString(schema.Status),
  fieldsCount: calculateFieldCount(schema.JsonSchemaContent),
  usageCount: schema.UsageCount,
  publishedAt: schema.PublishedAt,
  createdAt: schema.CreatedAt,
  updatedAt: schema.UpdatedAt,
  createdBy: schema.CreatedBy
});

const SchemaManagementEnhanced: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  
  // State management - replacing React Query hooks with manual state
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSchema, setSelectedSchema] = useState<SchemaRecord | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState<boolean>(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState<boolean>(false);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<any[]>([]);
  
  // API state - manual management
  const [schemas, setSchemas] = useState<SchemaRecord[]>([]);
  const [templates, setTemplates] = useState<SchemaTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [operationPending, setOperationPending] = useState<boolean>(false);

  // Fetch schemas - replacing useSchemas hook
  const fetchSchemas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        search: searchText || undefined,
        status: statusFilter !== 'all' ? (statusFilter as SchemaStatus) : undefined
      };
      
      const response = await schemaApiClient.getSchemas(params);
      const transformedSchemas = response.data?.map(transformSchema) || [];
      setSchemas(transformedSchemas);
    } catch (err) {
      console.error('Error fetching schemas:', err);
      setError(err as Error);
      setSchemas([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchText, statusFilter]);

  // Fetch templates - replacing useSchemaTemplates hook
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const result = await schemaApiClient.getTemplates();
      setTemplates(result);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // Fetch data sources for dropdown
  const fetchDataSources = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/datasource');
      const data = await response.json();
      if (data.IsSuccess) {
        setDataSources(data.Data.Items || []);
      }
    } catch (error) {
      console.error('Error fetching data sources:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchSchemas();
    fetchTemplates();
    fetchDataSources();
  }, [fetchSchemas, fetchTemplates, fetchDataSources]);

  // Handle highlighting from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (state?.highlightDataSourceId && schemas.length > 0) {
      const schemaToHighlight = schemas.find(s => s.dataSourceId === state.highlightDataSourceId);
      if (schemaToHighlight) {
        setHighlightedRowId(schemaToHighlight.id);
        
        setTimeout(() => {
          const element = document.querySelector(`[data-row-key="${schemaToHighlight.id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        
        setTimeout(() => {
          setHighlightedRowId(null);
        }, 3000);
        
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [schemas, location.state, navigate, location.pathname]);

  // Handlers
  const handleView = (record: SchemaRecord) => {
    setSelectedSchema(record);
    setIsDetailModalVisible(true);
  };

  const handleEdit = (record: SchemaRecord) => {
    navigate(`/schema/edit/${record.id}`);
  };

  const handleDuplicate = async (record: SchemaRecord) => {
    setOperationPending(true);
    try {
      await schemaApiClient.duplicateSchema(record.id, {
        name: `${record.name}_copy`,
        displayName: `${record.displayName} (העתק)`,
        description: `העתק של ${record.description}`,
        createdBy: 'User',
        copyTags: true,
        additionalTags: ['copy']
      });
      message.success('Schema שוכפל בהצלחה');
      await fetchSchemas(); // Refresh list
    } catch (error) {
      console.error('Error duplicating schema:', error);
      message.error('שגיאה בשכפול Schema');
    } finally {
      setOperationPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setOperationPending(true);
    try {
      await schemaApiClient.deleteSchema(id, 'User');
      message.success('Schema נמחק בהצלחה');
      await fetchSchemas(); // Refresh list
    } catch (error) {
      console.error('Error deleting schema:', error);
      message.error('שגיאה במחיקת Schema');
    } finally {
      setOperationPending(false);
    }
  };

  const handleCreateSchema = () => {
    form.resetFields();
    setIsCreateModalVisible(true);
  };

  const handleSubmitCreate = async (values: any) => {
    setOperationPending(true);
    try {
      const blankJsonSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {},
        "required": []
      };

      const payload: CreateSchemaRequest = {
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        dataSourceId: values.dataSourceId,
        jsonSchemaContent: JSON.stringify(blankJsonSchema, null, 2),
        tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : [],
        status: SchemaStatus.Draft,
        version: 1,
        createdBy: 'User'
      };

      const newSchema = await schemaApiClient.createSchema(payload);
      setIsCreateModalVisible(false);
      message.success('Schema נוצר בהצלחה');
      navigate(`/schema/edit/${newSchema.id}`);
    } catch (error) {
      console.error('Error creating schema:', error);
      message.error('שגיאה ביצירת Schema');
    } finally {
      setOperationPending(false);
    }
  };

  const handlePublishSchema = async (id: string) => {
    setOperationPending(true);
    try {
      await schemaApiClient.publishSchema(id);
      message.success('Schema פורסם בהצלחה');
      await fetchSchemas(); // Refresh list
    } catch (error) {
      console.error('Error publishing schema:', error);
      message.error('שגיאה בפרסום Schema');
    } finally {
      setOperationPending(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'Draft' | 'Active' | 'Inactive' | 'Archived') => {
    try {
      const response = await fetch(`/api/v1/schema/${id}`);
      const apiResponse = await response.json();
      
      if (!apiResponse.isSuccess || !apiResponse.data) {
        throw new Error('Failed to fetch current schema data');
      }
      
      const currentSchema = apiResponse.data;

      const statusMap: Record<string, number> = {
        'Draft': 0,
        'Active': 1,
        'Inactive': 2,
        'Archived': 3
      };

      const updateResponse = await fetch(`/api/v1/schema/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          displayName: currentSchema.DisplayName,
          description: currentSchema.Description,
          dataSourceId: currentSchema.DataSourceId,
          jsonSchemaContent: currentSchema.JsonSchemaContent,
          tags: currentSchema.Tags || [],
          status: statusMap[newStatus],
          updatedBy: 'User'
        })
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error?.message || 'Failed to update status');
      }

      await fetchSchemas(); // Refresh
      
      const statusText = newStatus === 'Active' ? 'פעיל' : newStatus === 'Draft' ? 'טיוטה' : newStatus === 'Inactive' ? 'לא פעיל' : 'בארכיון';
      message.success(`סטטוס Schema עודכן ל-${statusText}`);
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('שגיאה בעדכון סטטוס Schema');
      await fetchSchemas(); // Revert
    }
  };

  const handleDataSourceAssignment = async (schemaId: string, dataSourceId?: string) => {
    try {
      const freshSchemasResponse = await fetch('/api/v1/schema');
      const freshSchemasData = await freshSchemasResponse.json();
      
      if (!freshSchemasData.isSuccess || !freshSchemasData.data) {
        throw new Error('Failed to fetch schemas from API');
      }

      const freshSchemas = freshSchemasData.data;
      const currentSchema = freshSchemas.find((s: any) => s.ID === schemaId);
      
      if (!currentSchema) {
        return;
      }

      if (dataSourceId) {
        const existingAssignment = freshSchemas.find((s: any) => 
          s.DataSourceId === dataSourceId && s.ID !== schemaId
        );
        
        if (existingAssignment) {
          Modal.error({
            title: 'שגיאה: מקור נתונים כבר מקושר',
            content: (
              <div>
                <p>מקור הנתונים <strong>{dataSourceId}</strong> כבר מקושר ל-Schema <strong>"{existingAssignment.DisplayName}"</strong>.</p>
                <p>יש לנתק תחילה את הקישור הקיים לפני שניתן לקשר אותו ל-Schema אחר.</p>
                <p>המערכת מאפשרת קישור 1-ל-1 בלבד (Schema אחד למקור נתונים אחד).</p>
              </div>
            ),
            okText: 'הבנתי',
          });
          await fetchSchemas();
          return;
        }
      }

      await performAssignment(schemaId, dataSourceId, currentSchema.DisplayName);
    } catch (error) {
      console.error('Error updating data source assignment:', error);
      message.error('שגיאה בעדכון קישור מקור נתונים');
    }
  };

  const performAssignment = async (schemaId: string, dataSourceId: string | undefined, schemaDisplayName: string) => {
    try {
      const getResponse = await fetch(`/api/v1/schema/${schemaId}`);
      const getData = await getResponse.json();
      
      if (!getData.isSuccess || !getData.data) {
        throw new Error('Failed to fetch current schema');
      }
      
      const currentSchema = getData.data;

      const statusMap: Record<string, number> = {
        'Draft': 0,
        'Active': 1,
        'Inactive': 2,
        'Archived': 3
      };

      const payload: any = {
        displayName: currentSchema.DisplayName,
        description: currentSchema.Description,
        jsonSchemaContent: currentSchema.JsonSchemaContent,
        tags: currentSchema.Tags || [],
        status: typeof currentSchema.Status === 'number' ? currentSchema.Status : statusMap[currentSchema.Status] || 1,
        updatedBy: 'User'
      };

      if (dataSourceId) {
        payload.dataSourceId = dataSourceId;
      } else {
        payload.dataSourceId = null;
      }

      const updateResponse = await fetch(`/api/v1/schema/${schemaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error?.message || 'Failed to update schema');
      }

      await fetchSchemas();
      await fetchDataSources();

      if (dataSourceId) {
        message.success(`✓ ${schemaDisplayName} קושר למקור נתונים - עודכן בהצלחה`);
      } else {
        message.success(`✓ ${schemaDisplayName} נותק ממקור הנתונים - השדה ריק כעת`);
      }
    } catch (error) {
      console.error('Error in performAssignment:', error);
      message.error(`שגיאה: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const handleShowTemplates = () => {
    const templateData = templates.length > 0 ? templates : [
      {
        id: 'israeli_customer',
        nameHebrew: 'לקוח ישראלי',
        descriptionHebrew: 'תבנית עבור רשומות לקוחות עם שדות ישראליים',
        fieldsCount: 9
      },
      {
        id: 'financial_transaction',
        nameHebrew: 'עסקה פיננסית',
        descriptionHebrew: 'תבנית עבור עסקאות פיננסיות',
        fieldsCount: 12
      }
    ] as any[];

    Modal.info({
      title: 'תבניות Schema',
      width: 800,
      content: (
        <List
          loading={templatesLoading}
          dataSource={templateData}
          renderItem={(template: any) => (
            <List.Item
              actions={[
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    message.success(`נוצר Schema חדש מתבנית "${template.nameHebrew}"`);
                    Modal.destroyAll();
                    navigate(`/schema/builder?template=${template.id}`);
                  }}
                >
                  השתמש בתבנית
                </Button>
              ]}
            >
              <List.Item.Meta
                title={<Text strong>{template.nameHebrew || template.name}</Text>}
                description={template.descriptionHebrew || template.description}
              />
            </List.Item>
          )}
        />
      ),
      okText: 'סגור',
      style: { direction: 'rtl' }
    });
  };

  const loading = isLoading || operationPending;

  // Table columns
  const columns = [
    {
      title: 'Schema',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: SchemaRecord) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{record.displayName}</Text>
        </div>
      )
    },
    {
      title: 'סטטוס',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string, record: SchemaRecord) => (
        <Select
          value={status as 'Draft' | 'Active' | 'Inactive' | 'Archived'}
          size="small"
          style={{ width: '100%' }}
          onChange={(newStatus: 'Draft' | 'Active' | 'Inactive' | 'Archived') => handleStatusChange(record.id, newStatus)}
        >
          <Option value="Draft">טיוטה</Option>
          <Option value="Active">פעיל</Option>
          <Option value="Inactive">לא פעיל</Option>
          <Option value="Archived">בארכיון</Option>
        </Select>
      )
    },
    {
      title: 'מקור נתונים',
      dataIndex: 'dataSourceId',
      key: 'dataSourceId',
      width: 180,
      render: (dataSourceId: string, record: SchemaRecord) => {
        const availableDataSources = dataSources.filter(ds => {
          if (ds.ID === dataSourceId) {
            return true;
          }
          
          const isAssignedToOtherSchema = schemas.some(schema => 
            schema.id !== record.id && schema.dataSourceId === ds.ID
          );
          
          return !isAssignedToOtherSchema;
        });

        return (
          <Select
            value={dataSourceId || undefined}
            size="small"
            style={{ width: '100%' }}
            placeholder=""
            showSearch
            allowClear
            optionFilterProp="children"
            onChange={(newDataSourceId) => handleDataSourceAssignment(record.id, newDataSourceId)}
            dropdownAlign={{ offset: [0, 4] }}
          >
            {availableDataSources.map(ds => (
              <Option key={ds.ID} value={ds.ID}>{ds.Name}</Option>
            ))}
          </Select>
        );
      }
    },
    {
      title: 'שדות',
      dataIndex: 'fieldsCount',
      key: 'fieldsCount',
      width: 60,
      render: (count: number) => <Text strong>{count}</Text>
    },
    {
      title: 'פעולות',
      key: 'actions',
      width: 160,
      render: (_: any, record: SchemaRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            צפה
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            ערוך
          </Button>
          <Popconfirm
            title="מחק Schema?"
            onConfirm={() => handleDelete(record.id)}
            disabled={record.usageCount > 0}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.usageCount > 0}
            >
              מחק
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <FileTextOutlined /> {t('schema.title')}
          </Title>
          <Paragraph className="page-subtitle">
            {t('schema.subtitle')}
          </Paragraph>
        </div>
        <Space>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleCreateSchema}
          >
            {t('schema.actions.create')}
          </Button>
          <Button
            size="large"
            onClick={handleShowTemplates}
            title={t('schema.tooltips.templatesQuickStart')}
          >
            {t('schema.templates.title')}
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={8}>
            <Input
              placeholder={t('schema.placeholders.searchSchemas')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="large"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select
              placeholder={t('schema.messages.filterByStatus')}
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
              size="large"
            >
              <Option value="all">{t('schema.messages.allStatuses')}</Option>
              <Option value="Active">{t('schema.status.active')}</Option>
              <Option value="Draft">{t('schema.status.draft')}</Option>
              <Option value="Inactive">{t('schema.status.inactive')}</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button onClick={fetchSchemas} loading={isLoading}>
              {t('common.refresh')}
            </Button>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          message="שגיאה בטעינת נתונים"
          description="לא ניתן לטעון schemas מהשרת"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={fetchSchemas}>
              נסה שוב
            </Button>
          }
        />
      )}

      <Alert
        message={
          <Space size="large">
            <Text><Text strong>{schemas.length}</Text> Schemas</Text>
            <Text><Text strong>{schemas.filter(s => s.status === 'Active').length}</Text> פעילים</Text>
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={schemas}
          rowKey="id"
          loading={loading}
          rowClassName={(record) => record.id === highlightedRowId ? 'highlighted-row' : ''}
          pagination={{
            defaultPageSize: 25,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} מתוך ${total} Schemas`
          }}
        />
      </Card>

      <Modal
        title="צור Schema חדש"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitCreate}
        >
          <Form.Item
            name="name"
            label="שם Schema"
            rules={[
              { required: true, message: 'שדה חובה' },
              { pattern: /^[a-z0-9_]+$/, message: 'רק אותיות אנגליות קטנות, מספרים וקו תחתון' }
            ]}
          >
            <Input placeholder="sales_transaction" />
          </Form.Item>

          <Form.Item
            name="displayName"
            label="שם תצוגה"
            rules={[{ required: true, message: 'שדה חובה' }]}
          >
            <Input placeholder="עסקאות מכירה" />
          </Form.Item>

          <Form.Item
            name="description"
            label="תיאור"
            rules={[{ required: true, message: 'שדה חובה' }]}
          >
            <TextArea rows={3} placeholder="תאר את מטרת Schema" />
          </Form.Item>

          <Form.Item
            name="tags"
            label="תגיות"
          >
            <Input placeholder="financial, sales" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsCreateModalVisible(false)}>
                ביטול
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={operationPending}
              >
                צור
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="פרטי Schema מלאים"
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            סגור
          </Button>,
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              if (selectedSchema) {
                handleEdit(selectedSchema);
                setIsDetailModalVisible(false);
              }
            }}
          >
            ערוך Schema
          </Button>
        ]}
      >
        {selectedSchema && (
          <div>
            {/* Basic Information */}
            <Card title="מידע בסיסי" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">שם Schema</Text>
                  <div><Text strong code>{selectedSchema.name}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">שם תצוגה</Text>
                  <div><Text strong>{selectedSchema.displayName}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">גרסה</Text>
                  <div><Tag color="blue">{selectedSchema.version}</Tag></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">סטטוס</Text>
                  <div>
                    <Tag color={selectedSchema.status === 'Active' ? 'green' : 'orange'}>
                      {selectedSchema.status === 'Active' ? 'פעיל' : selectedSchema.status}
                    </Tag>
                  </div>
                </Col>
                <Col span={24}>
                  <Text type="secondary">תיאור</Text>
                  <div><Text>{selectedSchema.description}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">מקור נתונים מקושר</Text>
                  <div>
                    {selectedSchema.dataSourceId ? (
                      <Button 
                        type="link" 
                        size="small"
                        onClick={() => navigate('/datasources')}
                        style={{ padding: 0, height: 'auto' }}
                      >
                        {getDataSourceName(selectedSchema.dataSourceId)}
                      </Button>
                    ) : (
                      <Text type="secondary">לא מקושר</Text>
                    )}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">מספר שדות</Text>
                  <div><Text strong style={{ color: '#1890ff' }}>{selectedSchema.fieldsCount}</Text></div>
                </Col>
              </Row>
            </Card>

            {/* Usage Statistics */}
            <Card title="סטטיסטיקות שימוש" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                      {selectedSchema.usageCount}
                    </div>
                    <Text type="secondary">שימושים</Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                      {selectedSchema.fieldsCount}
                    </div>
                    <Text type="secondary">שדות מוגדרים</Text>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                      {selectedSchema.status === 'Active' ? '✓' : '○'}
                    </div>
                    <Text type="secondary">סטטוס פרסום</Text>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Timestamps */}
            <Card title="תאריכים" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">תאריך יצירה</Text>
                  <div><Text>{new Date(selectedSchema.createdAt).toLocaleString('he-IL')}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">עודכן לאחרונה</Text>
                  <div><Text>{new Date(selectedSchema.updatedAt).toLocaleString('he-IL')}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">נוצר על ידי</Text>
                  <div><Text>{selectedSchema.createdBy}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">תאריך פרסום</Text>
                  <div>
                    {selectedSchema.publishedAt ? (
                      <Text>{new Date(selectedSchema.publishedAt).toLocaleString('he-IL')}</Text>
                    ) : (
                      <Text type="secondary">לא פורסם</Text>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Quick Actions */}
            <Card title="פעולות מהירות" size="small">
              <Space wrap>
                <Button size="small" onClick={() => navigate(`/schema/edit/${selectedSchema.id}`)}>
                  ערוך Schema
                </Button>
                <Button size="small" onClick={() => handleDuplicate(selectedSchema)}>
                  שכפל Schema
                </Button>
                {selectedSchema.status === 'Draft' && (
                  <Button size="small" type="primary" onClick={() => handlePublishSchema(selectedSchema.id)}>
                    פרסם Schema
                  </Button>
                )}
                {selectedSchema.dataSourceId && (
                  <Button size="small" onClick={() => navigate('/datasources')}>
                    צפה במקור הנתונים
                  </Button>
                )}
              </Space>
            </Card>
          </div>
        )}
      </Modal>

      <style>{`
        .highlighted-row {
          animation: highlightFade 3s ease-in-out;
          background-color: #e6f7ff !important;
        }
        .highlighted-row:hover {
          background-color: #bae7ff !important;
        }
        @keyframes highlightFade {
          0% {
            background-color: #fff7e6;
            box-shadow: 0 0 10px rgba(250, 173, 20, 0.5);
          }
          20% {
            background-color: #fff7e6;
            box-shadow: 0 0 10px rgba(250, 173, 20, 0.5);
          }
          100% {
            background-color: #e6f7ff;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
};

export default SchemaManagementEnhanced;
