import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Space, Button, Alert, Spin, Tabs, Row, Col, Statistic, message, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, EditOutlined, FileOutlined, ApiOutlined, ClockCircleOutlined, SafetyOutlined, BellOutlined, InfoCircleOutlined, FileTextOutlined, LineChartOutlined, ExportOutlined, ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';

// Import detail tab components
import {
  BasicInfoDetailsTab,
  ConnectionDetailsTab,
  FileDetailsTab,
  ScheduleDetailsTab,
  ValidationDetailsTab,
  NotificationsDetailsTab,
  OutputDetailsTab
} from '../../components/datasource/details/AllDetailsTabsExport';
import { SchemaDetailsTab } from '../../components/datasource/details/SchemaDetailsTab';
import { RelatedMetricsTab } from '../../components/datasource/details/RelatedMetricsTab';

// Import shared utilities
import { DataSource, ApiResponse } from '../../components/datasource/shared/types';
import { extractFileTypeFromPattern, prepareCloneData } from '../../components/datasource/shared/helpers';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

const DataSourceDetailsEnhanced: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { modal } = App.useApp();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [parsedConfig, setParsedConfig] = useState<any>(null);
  const [schemas, setSchemas] = useState<any[]>([]);
  const [loadingSchemas, setLoadingSchemas] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);

  const fetchSchemas = async () => {
    setLoadingSchemas(true);
    try {
      const response = await fetch('/api/v1/schema', {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isSuccess && data.data) {
          setSchemas(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching schemas:', err);
    } finally {
      setLoadingSchemas(false);
    }
  };

  const fetchDataSource = useCallback(async () => {
    if (!id) {
      setError('Data source ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/datasource/${id}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data: ApiResponse<DataSource> = await response.json();

      if (data.IsSuccess) {
        setDataSource(data.Data);
        
        if (data.Data.AdditionalConfiguration?.ConfigurationSettings) {
          try {
            const config = JSON.parse(data.Data.AdditionalConfiguration.ConfigurationSettings);
            console.log('Parsed config:', config);
            console.log('OutputConfig:', config.outputConfig);
            setParsedConfig(config);
          } catch (e) {
            console.warn('Failed to parse configuration:', e);
          }
        }
      } else {
        throw new Error(data.Error?.Message || 'Failed to fetch data source');
      }
    } catch (err) {
      console.error('Error fetching data source:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data source');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDataSource();
    fetchSchemas();
  }, [fetchDataSource]);

  const handleManualTrigger = async () => {
    if (!id) return;

    setTriggering(true);
    try {
      const response = await fetch(`/api/v1/scheduling/datasources/${id}/trigger`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        message.success('הפעלה ידנית בוצעה בהצלחה! קבצים חדשים יתגלו ויעובדו כעת.', 2);
      } else{
        const errorData = await response.json().catch(() => null);
        message.error(errorData?.message || 'שגיאה בהפעלה ידנית');
      }
    } catch (err) {
      console.error('Error triggering manual execution:', err);
      message.error('שגיאה בחיבור לשרת התזמון');
    } finally {
      setTriggering(false);
    }
  };

  const handleClone = () => {
    if (!dataSource) return;

    modal.confirm({
      title: t('datasources.clone.confirmTitle'),
      content: (
        <div>
          <p>{t('datasources.clone.confirmMessage', { name: dataSource.Name })}</p>
          <p style={{ color: '#faad14', fontSize: '13px' }}>{t('datasources.clone.confirmNote')}</p>
        </div>
      ),
      okText: t('datasources.clone.confirmOk'),
      cancelText: t('datasources.clone.confirmCancel'),
      onOk: () => {
        const cloneData = prepareCloneData(dataSource, parsedConfig, i18n.language);
        navigate('/datasources/new', { state: { cloneData } });
      },
    });
  };

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

  const getFileTypeDisplay = () => {
    if (fileConfig.type) return fileConfig.type;
    if (dataSource?.FilePattern) {
      return extractFileTypeFromPattern(dataSource.FilePattern);
    }
    return 'לא הוגדר';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>טוען פרטי מקור נתונים...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <div><Title level={2} style={{ margin: 0 }}>שגיאה בטעינת מקור נתונים</Title></div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasources')}>{t('common.back')}</Button>
        </div>
        <Alert message={t('common.error')} description={error} type="error" showIcon />
      </div>
    );
  }

  if (!dataSource) {
    return (
      <div>
        <div className="page-header">
          <div><Title level={2} style={{ margin: 0 }}>מקור נתונים לא נמצא</Title></div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasources')}>{t('common.back')}</Button>
        </div>
        <Alert message="מקור נתונים לא נמצא" description="מקור הנתונים שביקשת לא נמצא או שנמחק." type="warning" showIcon />
      </div>
    );
  }

  const connectionConfig = parsedConfig?.connectionConfig || {};
  const fileConfig = parsedConfig?.fileConfig || {};

  // Construct schedule from datasource properties (not from parsedConfig)
  const schedule = {
    frequency: dataSource.ScheduleFrequency || dataSource.scheduleFrequency || 'Manual',
    enabled: dataSource.ScheduleEnabled ?? dataSource.scheduleEnabled ?? false,
    cronExpression: dataSource.CronExpression || dataSource.cronExpression
  };

  const validationRules = parsedConfig?.validationRules || {};
  const notificationSettings = parsedConfig?.notificationSettings || {};

  // Check if manual trigger button should be shown
  const showManualTrigger = schedule.frequency === 'Manual' || !schedule.enabled;

  // Handle both camelCase and PascalCase (C# may serialize with PascalCase)
  // Get output config from parsed config or fallback to dataSource.Output
  let outputConfig = parsedConfig?.outputConfig || parsedConfig?.OutputConfig || dataSource?.Output || null;

  // Check if destinations have PascalCase properties (check first destination)
  const needsConversion = outputConfig?.destinations?.[0]?.Type !== undefined || outputConfig?.DefaultOutputFormat !== undefined;

  // If we have PascalCase properties, convert to camelCase for consistency
  if (outputConfig && needsConversion) {
    outputConfig = {
      defaultOutputFormat: outputConfig.DefaultOutputFormat || outputConfig.defaultOutputFormat,
      includeInvalidRecords: outputConfig.IncludeInvalidRecords ?? outputConfig.includeInvalidRecords,
      destinations: (outputConfig.Destinations || outputConfig.destinations || []).map((dest: any) => ({
        id: dest.Id,
        name: dest.Name,
        description: dest.Description,
        type: dest.Type,
        enabled: dest.Enabled,
        outputFormat: dest.OutputFormat,
        includeInvalidRecords: dest.IncludeInvalidRecords,
        kafkaConfig: dest.KafkaConfig ? {
          brokerServer: dest.KafkaConfig.BrokerServer,
          topic: dest.KafkaConfig.Topic,
          messageKey: dest.KafkaConfig.MessageKey,
          headers: dest.KafkaConfig.Headers,
          partitionKey: dest.KafkaConfig.PartitionKey,
          securityProtocol: dest.KafkaConfig.SecurityProtocol,
          saslMechanism: dest.KafkaConfig.SaslMechanism,
          username: dest.KafkaConfig.Username,
          password: dest.KafkaConfig.Password
        } : undefined,
        folderConfig: dest.FolderConfig ? {
          path: dest.FolderConfig.Path,
          fileNamePattern: dest.FolderConfig.FileNamePattern,
          createSubfolders: dest.FolderConfig.CreateSubfolders,
          subfolderPattern: dest.FolderConfig.SubfolderPattern,
          overwriteExisting: dest.FolderConfig.OverwriteExisting
        } : undefined,
        sftpConfig: dest.SftpConfig,
        httpConfig: dest.HttpConfig
      }))
    };
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>פרטי מקור נתונים</Title>
          <Paragraph className="page-subtitle">צפייה מפורטת בכל הגדרות וסטטיסטיקות מקור הנתונים</Paragraph>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasources')}>{t('common.back')}</Button>
          {showManualTrigger && (
            <Button
              type="default"
              icon={<ThunderboltOutlined />}
              onClick={handleManualTrigger}
              loading={triggering}
              style={{ backgroundColor: '#52c41a', color: 'white', borderColor: '#52c41a' }}
            >
              הפעל עכשיו
            </Button>
          )}
          <Button icon={<CopyOutlined />} onClick={handleClone}>
            {t('datasources.clone.button')}
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/datasources/${id}/edit`)}>{t('common.edit')}</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="קבצים שעובדו" value={dataSource.TotalFilesProcessed} valueStyle={{ color: '#3f8600' }} prefix="📊" /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="רשומות שגויות" value={dataSource.TotalErrorRecords} valueStyle={{ color: '#cf1322' }} prefix="⚠️" /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="תקופת שמירה" value={dataSource.AdditionalConfiguration?.RetentionDays || 0} suffix="ימים" valueStyle={{ color: '#1890ff' }} prefix="📁" /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="סטטוס" value={dataSource.IsActive ? 'פעיל' : 'לא פעיל'} valueStyle={{ color: dataSource.IsActive ? '#3f8600' : '#cf1322' }} prefix={dataSource.IsActive ? '✅' : '❌'} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs defaultActiveKey="basic" type="card">
          <TabPane tab={<span><InfoCircleOutlined /> מידע בסיסי</span>} key="basic">
            <BasicInfoDetailsTab dataSource={dataSource} getCategoryLabel={getCategoryLabel} />
          </TabPane>

          <TabPane tab={<span><ApiOutlined /> חיבור</span>} key="connection">
            <ConnectionDetailsTab connectionConfig={connectionConfig} dataSource={dataSource} />
          </TabPane>

          <TabPane tab={<span><FileOutlined /> קובץ</span>} key="file">
            <FileDetailsTab fileConfig={fileConfig} getFileTypeDisplay={getFileTypeDisplay} />
          </TabPane>

          <TabPane tab={<span><FileTextOutlined /> Schema</span>} key="schema">
            <SchemaDetailsTab jsonSchema={dataSource.JsonSchema} dataSourceId={id} onEdit={() => navigate(`/datasources/${id}/edit`)} />
          </TabPane>

          <TabPane tab={<span><ClockCircleOutlined /> תזמון</span>} key="schedule">
            <ScheduleDetailsTab schedule={schedule} />
          </TabPane>

          <TabPane tab={<span><SafetyOutlined /> אימות</span>} key="validation">
            <ValidationDetailsTab validationRules={validationRules} schemas={schemas} dataSourceId={id} loadingSchemas={loadingSchemas} />
          </TabPane>

          <TabPane tab={<span><BellOutlined /> התראות</span>} key="notifications">
            <NotificationsDetailsTab notificationSettings={notificationSettings} />
          </TabPane>

          <TabPane tab={<span><LineChartOutlined /> Metrics</span>} key="metrics">
            <RelatedMetricsTab dataSourceId={id!} />
          </TabPane>

          <TabPane tab={<span><ExportOutlined /> פלט</span>} key="output">
            <OutputDetailsTab outputConfig={outputConfig} />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default DataSourceDetailsEnhanced;
