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
  SyncOutlined,
} from '@ant-design/icons';
import { invalidRecordsApiClient, InvalidRecord, Statistics } from '../../services/invalidrecords-api-client';
import dayjs, { Dayjs } from 'dayjs';
import EditRecordModal from '../../components/invalid-records/EditRecordModal';
import {
  translateErrors,
  extractErroredFields,
} from '../../utils/validationErrorTranslator';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [revalidating, setRevalidating] = useState(false);
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
  // These map to specific validation types extracted from error messages.
  // Labels are resolved via t() at render time so they switch with language.
  const errorTypeConfig: Record<string, { labelKey: string; color: string }> = {
    SchemaValidation: { labelKey: 'invalidRecords.errorTypes.schemaValidation', color: 'red' },
    minimum: { labelKey: 'invalidRecords.errorTypes.minimum', color: 'magenta' },
    maximum: { labelKey: 'invalidRecords.errorTypes.maximum', color: 'volcano' },
    format: { labelKey: 'invalidRecords.errorTypes.format', color: 'orange' },
    pattern: { labelKey: 'invalidRecords.errorTypes.pattern', color: 'geekblue' },
    enum: { labelKey: 'invalidRecords.errorTypes.enum', color: 'cyan' },
    required: { labelKey: 'invalidRecords.errorTypes.required', color: 'red' },
    minLength: { labelKey: 'invalidRecords.errorTypes.minLength', color: 'purple' },
    maxLength: { labelKey: 'invalidRecords.errorTypes.maxLength', color: 'gold' },
    type: { labelKey: 'invalidRecords.errorTypes.type', color: 'lime' },
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
    return <Tag color={config?.color || 'red'}>{config?.labelKey ? t(config.labelKey) : errorType}</Tag>;
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

  // Auto-refresh when revalidation completes (per D-06: live stats update)
  useEffect(() => {
    const handler = () => {
      fetchRecords();
      fetchStatistics();
      fetchFilteredStatistics();
    };
    window.addEventListener('revalidation-completed', handler);
    return () => window.removeEventListener('revalidation-completed', handler);
  }, [selectedDataSource, selectedErrorType, selectedTimeRange, dateRange, currentPage]);

  useEffect(() => {
    fetchRecords();
    fetchFilteredStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataSource, selectedErrorType, selectedTimeRange, dateRange, currentPage]);

  const handleRevalidateAll = async () => {
    setRevalidating(true);
    try {
      const dsFilter = selectedDataSource !== 'all' ? selectedDataSource : undefined;
      const result = await invalidRecordsApiClient.revalidateAll(dsFilter);
      if (result.isSuccess) {
        message.success(t('revalidation.revalidateSuccess', { count: result.data?.published || 0 }));
        await Promise.all([fetchRecords(), fetchStatistics(), fetchFilteredStatistics()]);
      } else {
        message.error(result.error?.message || t('revalidation.revalidateError'));
      }
    } catch (err) {
      message.error(t('revalidation.revalidateError'));
    } finally {
      setRevalidating(false);
    }
  };

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
          <Space align="center" style={{ marginBottom: 4 }}>
            <Title level={5} style={{ margin: 0 }}>{t('invalidRecords.recordNumber', { id: record.id })}</Title>
            {record.validatedWithSchemaVersion != null && (
              <Tag color="blue">
                {t('revalidation.schemaVersionLabel')} v{record.validatedWithSchemaVersion}
              </Tag>
            )}
            {record.isRevalidated && (
              <Tag color="green">
                {t('revalidation.revalidated')}
              </Tag>
            )}
          </Space>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label={t('invalidRecords.fields.dataSource')}>{record.dataSourceName}</Descriptions.Item>
            <Descriptions.Item label={t('invalidRecords.fields.file')}>{record.fileName}</Descriptions.Item>
            <Descriptions.Item label={t('invalidRecords.fields.timestamp')}>{new Date(record.createdAt).toLocaleString(i18n.language)}</Descriptions.Item>
            {record.lineNumber && (
              <Descriptions.Item label={t('invalidRecords.fields.line')}>{record.lineNumber}</Descriptions.Item>
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
              {t('invalidRecords.reprocess')}
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            >
              {t('invalidRecords.delete')}
            </Button>
          </Space>
        </Col>
      </Row>

      <div style={{ marginTop: 12, color: '#e74c3c' }}>
        <Text strong>{t('invalidRecords.fields.validationErrors')}</Text>
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
        <Panel header={t('invalidRecords.fields.viewOriginalRecord')} key="1">
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
            {t('invalidRecords.title')}
          </Title>
        </div>
        <Space>
          <Popconfirm
            title={t('revalidation.revalidateConfirmTitle')}
            description={selectedDataSource !== 'all' ? t('revalidation.revalidateConfirmDatasource') : t('revalidation.revalidateConfirmAll')}
            onConfirm={handleRevalidateAll}
            okText={t('revalidation.revalidateAll')}
            cancelText={t('common.cancel')}
          >
            <Button
              icon={<SyncOutlined spin={revalidating} />}
              loading={revalidating}
              type="default"
              disabled={totalCount === 0}
            >
              {t('revalidation.revalidateAll')}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={t('invalidRecords.confirmDelete.title')}
            description={t('invalidRecords.confirmDelete.description', { count: totalCount })}
            onConfirm={handleDeleteAll}
            okText={t('invalidRecords.delete')}
            cancelText={t('invalidRecords.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<ClearOutlined />}
              disabled={totalCount === 0}
              loading={loading}
            >
              {t('invalidRecords.deleteAll', { count: totalCount })}
            </Button>
          </Popconfirm>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
            disabled={totalCount === 0}
          >
            {t('invalidRecords.exportJson', { count: totalCount })}
          </Button>
        </Space>
      </div>

      {/* Global Statistics Dashboard */}
      {statistics && (
        <>
          <Title level={4} style={{ marginBottom: 16 }}>{t('invalidRecords.stats.globalTitle')}</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('invalidRecords.stats.totalRecords')}
                  value={statistics.totalInvalidRecords}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('invalidRecords.stats.reviewedRecords')}
                  value={statistics.reviewedRecords}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('invalidRecords.stats.ignoredRecords')}
                  value={statistics.ignoredRecords}
                  prefix={<EyeInvisibleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title={t('invalidRecords.stats.errorTypes')}
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
          <Title level={4} style={{ marginBottom: 16 }}>{t('invalidRecords.stats.filteredTitle')}</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                <Statistic
                  title={t('invalidRecords.stats.recordsShown')}
                  value={filteredStatistics.totalInvalidRecords}
                  prefix={<SearchOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: '#52c41a', borderWidth: 2 }}>
                <Statistic
                  title={t('invalidRecords.stats.reviewedFiltered')}
                  value={filteredStatistics.reviewedRecords}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: '#faad14', borderWidth: 2 }}>
                <Statistic
                  title={t('invalidRecords.stats.ignoredFiltered')}
                  value={filteredStatistics.ignoredRecords}
                  prefix={<EyeInvisibleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: '#1890ff', borderWidth: 2 }}>
                <Statistic
                  title={t('invalidRecords.stats.errorTypesFiltered')}
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
              <Text>{t('invalidRecords.filters.category')}</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                <Option value="all">{t('invalidRecords.filters.allCategories')}</Option>
                {categories.map(cat => (
                  <Option key={cat} value={cat}>{cat}</Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>{t('invalidRecords.filters.dataSource')}</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedDataSource}
                onChange={setSelectedDataSource}
                showSearch
                optionFilterProp="children"
              >
                <Option value="all">{t('invalidRecords.filters.allDataSources')}</Option>
                {getFilteredDataSources().map(ds => (
                  <Option key={ds.ID} value={ds.ID}>{ds.Name}</Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>{t('invalidRecords.filters.errorType')}</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedErrorType}
                onChange={setSelectedErrorType}
              >
                <Option value="all">{t('invalidRecords.filters.allErrors')}</Option>
                {(() => {
                  const errorTypeCounts = getErrorTypeCountsFromRecords();
                  return getAvailableErrorTypes().map(type => {
                    const config = errorTypeConfig[type];
                    const count = errorTypeCounts[type] || 0;
                    return (
                      <Option key={type} value={type}>
                        {config?.labelKey ? t(config.labelKey) : type} {count > 0 && `(${count})`}
                      </Option>
                    );
                  });
                })()}
              </Select>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>{t('invalidRecords.filters.timeRange')}</Text>
              <Select
                style={{ width: '100%' }}
                value={selectedTimeRange}
                onChange={(value) => {
                  setSelectedTimeRange(value);
                  if (value !== 'custom') setDateRange(null);
                }}
              >
                <Option value="all">{t('invalidRecords.filters.allTimes')}</Option>
                <Option value="hour">{t('invalidRecords.filters.lastHour')}</Option>
                <Option value="day">{t('invalidRecords.filters.lastDay')}</Option>
                <Option value="week">{t('invalidRecords.filters.lastWeek')}</Option>
                <Option value="month">{t('invalidRecords.filters.lastMonth')}</Option>
                <Option value="custom">{t('invalidRecords.filters.customRange')}</Option>
              </Select>
            </Space>
          </Col>
        </Row>
        {selectedTimeRange === 'custom' && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text>{t('invalidRecords.filters.customDates')}</Text>
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
                {t('invalidRecords.search')}
              </Button>
            </Col>
          </Row>
        )}
      </Card>

      {/* Invalid Records List */}
      <Spin spinning={loading} tip={t('invalidRecords.loading')}>
        {invalidRecords.length === 0 && !loading ? (
          <Card style={{ textAlign: 'center', padding: '40px' }}>
            <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#bbb', marginBottom: '16px' }} />
            <Title level={4}>{t('invalidRecords.empty.title')}</Title>
            <Text type="secondary">{t('invalidRecords.empty.subtitle')}</Text>
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
                        <Tag color="red">{t('invalidRecords.recordCount', { count: group.records.length })}</Tag>
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
                showTotal={(total) => t('invalidRecords.totalCount', { count: total })}
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
