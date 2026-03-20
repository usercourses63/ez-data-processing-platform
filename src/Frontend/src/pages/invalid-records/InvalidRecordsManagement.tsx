import React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Space, Typography, Row, Col, Select, DatePicker, Collapse, Descriptions, message, Spin, Statistic, Pagination, Popconfirm, Tooltip } from 'antd';
import {
  ExclamationCircleOutlined,
  ExportOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ClearOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { invalidRecordsApiClient, InvalidRecord, Statistics } from '../../services/invalidrecords-api-client';
import dayjs, { Dayjs } from 'dayjs';
import EditRecordModal from '../../components/invalid-records/EditRecordModal';
import {
  translateErrors,
  extractErroredFields,
} from '../../utils/validationErrorTranslator';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { Option } = Select;

interface DataSource {
  ID: string;
  Name: string;
  Category: string;
}

const InvalidRecordsManagement: React.FC = () => {
  const [selectedDataSource, setSelectedDataSource] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedErrorType, setSelectedErrorType] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalidRecords, setInvalidRecords] = useState<InvalidRecord[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [filteredStatistics, setFilteredStatistics] = useState<Statistics | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<InvalidRecord | null>(null);
  const pageSize = 10;

  // Error type labels for Corvus JSON Schema validation errors
  // These map to specific validation types extracted from error messages
  const errorTypeConfig: Record<string, { label: string; color: string }> = {
    SchemaValidation: { label: 'כל שגיאות Schema', color: 'red' },
    minimum: { label: 'ערך קטן מהמותר', color: 'magenta' },
    maximum: { label: 'ערך גדול מהמותר', color: 'volcano' },
    format: { label: 'פורמט שגוי (תאריך/אימייל)', color: 'orange' },
    pattern: { label: 'תבנית לא תקינה', color: 'geekblue' },
    enum: { label: 'ערך לא ברשימה המותרת', color: 'cyan' },
    required: { label: 'שדה חובה חסר', color: 'red' },
    minLength: { label: 'טקסט קצר מדי', color: 'purple' },
    maxLength: { label: 'טקסט ארוך מדי', color: 'gold' },
    type: { label: 'סוג נתונים שגוי', color: 'lime' },
  };

  // Extract specific validation type from Corvus error message
  // E.g., "Invalid Validation minimum" -> "minimum"
  const extractValidationType = (errorMessage: string): string => {
    const match = errorMessage.match(/Invalid Validation (\w+)/i);
    return match ? match[1].toLowerCase() : 'SchemaValidation';
  };

  // Check if a record has errors of a specific validation type
  const recordHasValidationType = (record: InvalidRecord, validationType: string): boolean => {
    if (validationType === 'all' || validationType === 'SchemaValidation') return true;
    return record.errors.some(err => extractValidationType(err.message) === validationType);
  };

  // Check if errorType is a specific validation type (not backend-supported)
  const isSpecificValidationType = (errorType: string): boolean => {
    return errorType !== 'all' && errorType !== 'SchemaValidation';
  };

  // Get available error types from actual records
  const getAvailableErrorTypes = (): string[] => {
    const typesSet = new Set<string>();
    // Always include SchemaValidation as the default
    typesSet.add('SchemaValidation');

    // Extract specific validation types from all records' error messages
    invalidRecords.forEach(record => {
      record.errors.forEach(err => {
        const validationType = extractValidationType(err.message);
        if (errorTypeConfig[validationType]) {
          typesSet.add(validationType);
        }
      });
    });

    return Array.from(typesSet);
  };

  // Calculate counts per specific validation type from loaded records
  const getErrorTypeCountsFromRecords = (): Record<string, number> => {
    const counts: Record<string, number> = {
      SchemaValidation: invalidRecords.length, // All records are schema validation errors
    };

    // Count records by specific validation type
    invalidRecords.forEach(record => {
      record.errors.forEach(err => {
        const validationType = extractValidationType(err.message);
        if (validationType !== 'SchemaValidation') {
          counts[validationType] = (counts[validationType] || 0) + 1;
        }
      });
    });

    return counts;
  };

  const renderErrorType = (errorType: string) => {
    const config = errorTypeConfig[errorType];
    return <Tag color={config?.color || 'red'}>{config?.label || errorType}</Tag>;
  };

  // Fetch datasources for filter dropdown
  const fetchDataSources = async () => {
    try {
      const response = await fetch('/api/v1/datasource?page=1&pageSize=100');
      const data = await response.json();

      if (data.Data?.Items) {
        setDataSources(data.Data.Items);
        const uniqueCategories = [...new Set(data.Data.Items.map((ds: DataSource) => ds.Category))] as string[];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Failed to fetch datasources:', error);
    }
  };

  // Fetch statistics for dashboard
  const fetchStatistics = async () => {
    try {
      const stats = await invalidRecordsApiClient.getStatistics();

      // Fetch records to extract specific validation types for byErrorType
      // The backend only stores "SchemaValidation" but we want to show specific types
      const allRecords = await invalidRecordsApiClient.getList({
        page: 1,
        pageSize: 1000,
      });

      // Extract specific validation types from error messages
      const byErrorType: Record<string, number> = {};
      allRecords.data.forEach(r => {
        r.errors.forEach(err => {
          const validationType = extractValidationType(err.message);
          byErrorType[validationType] = (byErrorType[validationType] || 0) + 1;
        });
      });

      // Override backend byErrorType with extracted specific types
      setStatistics({
        ...stats,
        byErrorType
      });
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    }
  };

  // Fetch filtered statistics based on current filters
  const fetchFilteredStatistics = async () => {
    try {
      // Calculate date range for filtered statistics
      let startDate, endDate;
      if (dateRange && dateRange[0] && dateRange[1]) {
        startDate = dateRange[0].toISOString();
        endDate = dateRange[1].toISOString();
      } else {
        const intervalRange = getDateRangeFromInterval(selectedTimeRange);
        if (intervalRange) {
          [startDate, endDate] = intervalRange;
        }
      }

      // Fetch all filtered records to calculate statistics
      // Don't filter by specific validation types on the backend
      const allFilteredRecords = await invalidRecordsApiClient.getList({
        page: 1,
        pageSize: 1000,
        dataSourceId: selectedDataSource === 'all' ? undefined : selectedDataSource,
        errorType: undefined, // Don't filter by errorType for statistics - we need to count specific types
        startDate,
        endDate,
      });

      // Apply client-side filtering for specific validation types (same as fetchRecords)
      let recordsForStats = allFilteredRecords.data;
      if (isSpecificValidationType(selectedErrorType)) {
        recordsForStats = allFilteredRecords.data.filter(record =>
          recordHasValidationType(record, selectedErrorType)
        );
      }

      // Calculate filtered statistics from records
      const filteredStats: Statistics = {
        totalInvalidRecords: recordsForStats.length,
        reviewedRecords: recordsForStats.filter(r => r.isReviewed).length,
        ignoredRecords: recordsForStats.filter(r => r.isIgnored).length,
        byDataSource: {},
        byErrorType: {},
        bySeverity: {}
      };

      // Group by datasource
      recordsForStats.forEach(r => {
        filteredStats.byDataSource[r.dataSourceName] =
          (filteredStats.byDataSource[r.dataSourceName] || 0) + 1;
      });

      // Group by specific validation types (not record-level errorType)
      // Extract specific validation types from each record's error messages
      recordsForStats.forEach(r => {
        r.errors.forEach(err => {
          const validationType = extractValidationType(err.message);
          filteredStats.byErrorType[validationType] =
            (filteredStats.byErrorType[validationType] || 0) + 1;
        });
      });

      // Group by severity
      recordsForStats.forEach(r => {
        filteredStats.bySeverity[r.severity] =
          (filteredStats.bySeverity[r.severity] || 0) + 1;
      });

      setFilteredStatistics(filteredStats);
    } catch (error) {
      console.error('Failed to fetch filtered statistics:', error);
    }
  };

  // Calculate date range based on time interval selection
  const getDateRangeFromInterval = (interval: string): [string, string] | undefined => {
    if (interval === 'all') return undefined;

    const now = dayjs();
    let start: Dayjs;

    switch (interval) {
      case 'hour':
        start = now.subtract(1, 'hour');
        break;
      case 'day':
        start = now.subtract(1, 'day');
        break;
      case 'week':
        start = now.subtract(1, 'week');
        break;
      case 'month':
        start = now.subtract(1, 'month');
        break;
      default:
        return undefined;
    }

    return [start.toISOString(), now.toISOString()];
  };

  // Fetch invalid records from API
  const fetchRecords = async () => {
    setLoading(true);
    try {
      let startDate, endDate;

      // Use custom date range if set, otherwise use time interval
      if (dateRange && dateRange[0] && dateRange[1]) {
        startDate = dateRange[0].toISOString();
        endDate = dateRange[1].toISOString();
      } else {
        const intervalRange = getDateRangeFromInterval(selectedTimeRange);
        if (intervalRange) {
          [startDate, endDate] = intervalRange;
        }
      }

      // For specific validation types (minimum, maximum, etc.), don't filter on backend
      // Backend only supports 'SchemaValidation', so we filter client-side
      const apiErrorType = isSpecificValidationType(selectedErrorType)
        ? undefined  // Don't filter by errorType for specific validation types
        : (selectedErrorType === 'all' ? undefined : selectedErrorType);

      const result = await invalidRecordsApiClient.getList({
        page: currentPage,
        pageSize: isSpecificValidationType(selectedErrorType) ? 1000 : pageSize, // Get more for client-side filtering
        dataSourceId: selectedDataSource === 'all' ? undefined : selectedDataSource,
        errorType: apiErrorType,
        startDate,
        endDate,
      });

      // Apply client-side filtering for specific validation types
      let filteredData = result.data;
      if (isSpecificValidationType(selectedErrorType)) {
        filteredData = result.data.filter(record => recordHasValidationType(record, selectedErrorType));
      }

      setInvalidRecords(filteredData);
      setTotalCount(isSpecificValidationType(selectedErrorType) ? filteredData.length : result.totalCount);
    } catch (error: any) {
      message.error(error.message || 'Failed to load invalid records');
      setInvalidRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Get filtered datasources based on selected category
  const getFilteredDataSources = () => {
    if (selectedCategory === 'all') return dataSources;
    return dataSources.filter(ds => ds.Category === selectedCategory);
  };

  // Handle category change - reset datasource selection if it's not in the new category
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (category !== 'all') {
      const filteredDs = dataSources.filter(ds => ds.Category === category);
      if (selectedDataSource !== 'all' && !filteredDs.find(ds => ds.ID === selectedDataSource)) {
        setSelectedDataSource('all');
      }
    }
  };

  useEffect(() => {
    fetchDataSources();
    fetchStatistics();
  }, []);

  // Auto-refresh when another user changes invalid records (SignalR EntityChanged)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.entityType === 'InvalidRecord' || detail?.entityType === 'DataSource') {
        fetchRecords();
        fetchStatistics();
        fetchFilteredStatistics();
      }
    };
    window.addEventListener('entity-changed', handler);
    return () => window.removeEventListener('entity-changed', handler);
  }, [selectedDataSource, selectedErrorType, selectedTimeRange, dateRange, currentPage]);

  useEffect(() => {
    fetchRecords();
    fetchFilteredStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataSource, selectedErrorType, selectedTimeRange, dateRange, currentPage]);

  const handleReprocess = (record: InvalidRecord) => {
    // Open edit modal instead of direct reprocess
    setSelectedRecord(record);
    setEditModalVisible(true);
  };

  const handleEditSuccess = async () => {
    // Refresh both records list and statistics after successful edit
    await Promise.all([fetchRecords(), fetchStatistics(), fetchFilteredStatistics()]);
  };

  const handleDelete = async (recordId: string) => {
    try {
      await invalidRecordsApiClient.deleteRecord(recordId);
      message.success('Record deleted successfully');
      await Promise.all([fetchRecords(), fetchStatistics(), fetchFilteredStatistics()]);
    } catch (error: any) {
      message.error(error.message || 'Failed to delete record');
    }
  };

  const handleDeleteAll = async () => {
    try {
      setLoading(true);

      // Calculate date range for filtering (same as fetchRecords)
      let startDate, endDate;
      if (dateRange && dateRange[0] && dateRange[1]) {
        startDate = dateRange[0].toISOString();
        endDate = dateRange[1].toISOString();
      } else {
        const intervalRange = getDateRangeFromInterval(selectedTimeRange);
        if (intervalRange) {
          [startDate, endDate] = intervalRange;
        }
      }

      // Fetch all record IDs matching ALL current filters (including date range)
      const allRecords = await invalidRecordsApiClient.getList({
        page: 1,
        pageSize: 1000, // Get all records
        dataSourceId: selectedDataSource === 'all' ? undefined : selectedDataSource,
        errorType: selectedErrorType === 'all' ? undefined : selectedErrorType,
        startDate,
        endDate,
      });

      if (allRecords.data.length === 0) {
        message.info('No records to delete');
        return;
      }

      const recordIds = allRecords.data.map(r => r.id);

      // Call bulk delete API
      const response = await fetch('/api/v1/invalid-records/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds, requestedBy: 'User' })
      });

      if (response.ok) {
        message.success(`Successfully deleted ${recordIds.length} records`);
        await Promise.all([fetchRecords(), fetchStatistics(), fetchFilteredStatistics()]);
        setCurrentPage(1);
      } else {
        message.error('Failed to delete records');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to delete all records');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);

      // Calculate date range for export (same as fetchRecords)
      let startDate, endDate;
      if (dateRange && dateRange[0] && dateRange[1]) {
        startDate = dateRange[0].toISOString();
        endDate = dateRange[1].toISOString();
      } else {
        const intervalRange = getDateRangeFromInterval(selectedTimeRange);
        if (intervalRange) {
          [startDate, endDate] = intervalRange;
        }
      }

      // Fetch ALL records matching current filters (not just current page)
      const allRecords = await invalidRecordsApiClient.getList({
        page: 1,
        pageSize: totalCount || 1000, // Get all records (use totalCount or max 1000)
        dataSourceId: selectedDataSource === 'all' ? undefined : selectedDataSource,
        errorType: selectedErrorType === 'all' ? undefined : selectedErrorType,
        startDate,
        endDate,
      });

      // Export with UTF-8 BOM for Hebrew support
      const jsonData = JSON.stringify(allRecords.data, null, 2);
      const blob = new Blob(['\ufeff' + jsonData], { type: 'application/json;charset=utf-8' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invalid-records-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success(`Exported ${allRecords.data.length} records successfully`);
    } catch (error: any) {
      message.error(error.message || 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  // Render original record as JSON with errored fields highlighted
  const renderOriginalRecord = (record: InvalidRecord) => {
    const erroredFields = extractErroredFields(record.errors);
    const data = record.originalData || {};

    // Render JSON with highlighted errored fields
    const renderJsonValue = (value: any, indent: number = 2): React.ReactNode => {
      if (typeof value === 'string') return `"${value}"`;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (value === null) return 'null';
      return JSON.stringify(value);
    };

    return (
      <pre
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: 16,
          borderRadius: 8,
          overflow: 'auto',
          maxHeight: 400,
          fontSize: 13,
          lineHeight: 1.6,
          direction: 'ltr',
          textAlign: 'left',
          margin: 0,
        }}
      >
        <code>
          {'{'}
          {'\n'}
          {Object.entries(data).map(([key, value], index, arr) => {
            const hasError = erroredFields.has(key);
            const isLast = index === arr.length - 1;
            return (
              <span key={key}>
                {'  '}
                <span style={{ color: hasError ? '#ff6b6b' : '#9cdcfe' }}>
                  {hasError && <WarningOutlined style={{ marginRight: 4, color: '#ff6b6b' }} />}
                  "{key}"
                </span>
                <span style={{ color: '#d4d4d4' }}>: </span>
                <span style={{
                  color: hasError ? '#ff6b6b' : (
                    typeof value === 'string' ? '#ce9178' :
                    typeof value === 'number' ? '#b5cea8' :
                    typeof value === 'boolean' ? '#569cd6' : '#d4d4d4'
                  ),
                  fontWeight: hasError ? 'bold' : 'normal',
                }}>
                  {renderJsonValue(value)}
                </span>
                {!isLast && ','}
                {'\n'}
              </span>
            );
          })}
          {'}'}
        </code>
      </pre>
    );
  };

  const renderInvalidRecord = (record: InvalidRecord) => (
    <Card 
      key={record.id}
      style={{ 
        marginBottom: 16, 
        backgroundColor: '#fff5f5',
        borderRight: '4px solid #e74c3c',
      }}
    >
      <Row justify="space-between" align="top">
        <Col flex="auto">
          <Title level={5}>רשומה #{record.id}</Title>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="מקור נתונים">{record.dataSourceName}</Descriptions.Item>
            <Descriptions.Item label="קובץ">{record.fileName}</Descriptions.Item>
            <Descriptions.Item label="חותמת זמן">{new Date(record.createdAt).toLocaleString('he-IL')}</Descriptions.Item>
            {record.lineNumber && (
              <Descriptions.Item label="שורה">{record.lineNumber}</Descriptions.Item>
            )}
          </Descriptions>
        </Col>
        <Col>
          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleReprocess(record)}
            >
              עבד מחדש
            </Button>
            <Button 
              size="small" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDelete(record.id)}
            >
              מחק
            </Button>
          </Space>
        </Col>
      </Row>

      <div style={{ marginTop: 12, color: '#e74c3c' }}>
        <Text strong>שגיאות אימות:</Text>
        <div style={{ marginTop: 8 }}>
          {translateErrors(record.errors).map((translated, index) => (
            <Tooltip
              key={index}
              title={translated.detailedMessage}
              placement="top"
            >
              <Tag
                color="red"
                style={{ marginBottom: 4, fontSize: '13px', padding: '4px 8px', cursor: 'help' }}
              >
                <WarningOutlined style={{ marginLeft: 4 }} />
                {translated.shortMessage}
              </Tag>
            </Tooltip>
          ))}
        </div>
      </div>

      <Collapse ghost style={{ marginTop: 10 }}>
        <Panel header="הצג נתוני רשומה מקורית" key="1">
          {renderOriginalRecord(record)}
        </Panel>
      </Collapse>
    </Card>
  );

  return (
    <div className="invalid-records-page">
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            ניהול רשומות לא תקינות
          </Title>
        </div>
        <Space>
          <Popconfirm
            title="מחק רשומות מסוננות?"
            description={`פעולה זו תמחק ${totalCount} רשומות לא תקינות לפי הפילטרים הנוכחיים ותעדכן את הסטטיסטיקות. האם להמשיך?`}
            onConfirm={handleDeleteAll}
            okText="מחק"
            cancelText="ביטול"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<ClearOutlined />}
              disabled={totalCount === 0}
              loading={loading}
            >
              מחק הכל ({totalCount})
            </Button>
          </Popconfirm>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
            disabled={totalCount === 0}
          >
            יצא JSON ({totalCount})
          </Button>
        </Space>
      </div>

      {/* Global Statistics Dashboard */}
      {statistics && (
        <>
          <Title level={4} style={{ marginBottom: 16 }}>סטטיסטיקות כלליות</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="סה״כ רשומות לא תקינות"
                  value={statistics.totalInvalidRecords}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="רשומות שנבדקו"
                  value={statistics.reviewedRecords}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="רשומות שהתעלמו"
                  value={statistics.ignoredRecords}
                  prefix={<EyeInvisibleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="סוגי שגיאות"
                  value={Object.keys(statistics.byErrorType).length}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Filtered Statistics Dashboard */}
      {filteredStatistics && (
        <>
          <Title level={4} style={{ marginBottom: 16 }}>סטטיסטיקות מסוננות (תצוגה נוכחית)</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                <Statistic
                  title="רשומות מוצגות"
                  value={filteredStatistics.totalInvalidRecords}
                  prefix={<SearchOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: '#52c41a', borderWidth: 2 }}>
                <Statistic
                  title="נבדקו (מסוננות)"
                  value={filteredStatistics.reviewedRecords}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: '#faad14', borderWidth: 2 }}>
                <Statistic
                  title="התעלמו (מסוננות)"
                  value={filteredStatistics.ignoredRecords}
                  prefix={<EyeInvisibleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                <Statistic
                  title="סוגי שגיאות (מסוננות)"
                  value={Object.keys(filteredStatistics.byErrorType).length}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Search and Filter Controls */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>קטגוריה:</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                <Option value="all">כל הקטגוריות</Option>
                {categories.map(cat => (
                  <Option key={cat} value={cat}>{cat}</Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>מקור נתונים:</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedDataSource}
                onChange={setSelectedDataSource}
                showSearch
                optionFilterProp="children"
              >
                <Option value="all">כל מקורות הנתונים</Option>
                {getFilteredDataSources().map(ds => (
                  <Option key={ds.ID} value={ds.ID}>{ds.Name}</Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>סוג שגיאה:</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedErrorType}
                onChange={setSelectedErrorType}
              >
                <Option value="all">כל השגיאות</Option>
                {(() => {
                  const errorTypeCounts = getErrorTypeCountsFromRecords();
                  return getAvailableErrorTypes().map(type => {
                    const config = errorTypeConfig[type];
                    const count = errorTypeCounts[type] || 0;
                    return (
                      <Option key={type} value={type}>
                        {config?.label || type} {count > 0 && `(${count})`}
                      </Option>
                    );
                  });
                })()}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>טווח זמן:</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedTimeRange}
                onChange={(value) => {
                  setSelectedTimeRange(value);
                  if (value !== 'custom') setDateRange(null);
                }}
              >
                <Option value="all">כל הזמנים</Option>
                <Option value="hour">שעה אחרונה</Option>
                <Option value="day">יום אחרון</Option>
                <Option value="week">שבוע אחרון</Option>
                <Option value="month">חודש אחרון</Option>
                <Option value="custom">טווח מותאם אישית</Option>
              </Select>
            </Space>
          </Col>
        </Row>
        {selectedTimeRange === 'custom' && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text>תאריכים מותאמים:</Text>
                <RangePicker
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                  showTime
                />
              </Space>
            </Col>
            <Col span={12}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                style={{ marginTop: 24 }}
                onClick={fetchRecords}
                loading={loading}
              >
                חפש
              </Button>
            </Col>
          </Row>
        )}
      </Card>

      {/* Invalid Records List */}
      <Spin spinning={loading} tip="טוען רשומות לא תקינות...">
        {invalidRecords.length === 0 && !loading ? (
          <Card style={{ textAlign: 'center', padding: '40px' }}>
            <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#bbb', marginBottom: '16px' }} />
            <Title level={4}>אין רשומות לא תקינות</Title>
            <Text type="secondary">לא נמצאו רשומות לא תקינות עם הפילטרים הנבחרים</Text>
          </Card>
        ) : (
          <div>
            {(() => {
              // Group records by dataSource
              const groupedRecords = invalidRecords.reduce((acc, record) => {
                const key = record.dataSourceId;
                if (!acc[key]) {
                  acc[key] = {
                    dataSourceName: record.dataSourceName,
                    dataSourceId: record.dataSourceId,
                    records: []
                  };
                }
                acc[key].records.push(record);
                return acc;
              }, {} as Record<string, {dataSourceName: string, dataSourceId: string, records: InvalidRecord[]}>);

              // Render with Collapse grouping
              return (
                <Collapse
                  items={Object.entries(groupedRecords).map(([dsId, group]) => ({
                    key: dsId,
                    label: (
                      <Space>
                        <DatabaseOutlined />
                        <Text strong>{group.dataSourceName}</Text>
                        <Tag color="red">{group.records.length} רשומות</Tag>
                      </Space>
                    ),
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.records.map(renderInvalidRecord)}
                      </Space>
                    )
                  }))}
                  defaultActiveKey={Object.keys(groupedRecords).slice(0, 1)}
                  style={{ marginBottom: 24 }}
                />
              );
            })()}

            {totalCount > pageSize && (
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={totalCount}
                onChange={(page) => setCurrentPage(page)}
                showSizeChanger={false}
                showTotal={(total) => `סה"כ ${total} רשומות לא תקינות`}
                style={{ marginTop: 24, textAlign: 'center' }}
              />
            )}
          </div>
        )}
      </Spin>

      {/* Edit Record Modal */}
      <EditRecordModal
        visible={editModalVisible}
        record={selectedRecord}
        onClose={() => setEditModalVisible(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default InvalidRecordsManagement;
