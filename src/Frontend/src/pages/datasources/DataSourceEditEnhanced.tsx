import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Typography, Card, Form, Button, Space, Alert, Spin, App, Divider, Tabs, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, SaveOutlined, FileOutlined, ApiOutlined, ClockCircleOutlined, SafetyOutlined, BellOutlined, FileTextOutlined, ExportOutlined, BarChartOutlined } from '@ant-design/icons';
import { type JSONSchema } from 'jsonjoy-builder';
import { buildConnectionString, frequencyToCron, extractFileTypeFromPattern } from '../../components/datasource/shared/helpers';
import { DataSource, ApiResponse, OutputConfiguration } from '../../components/datasource/shared/types';
import { useCompletenessTracker, CompletenessPanel, TAB_FIELD_CONFIG, REQUIRED_TABS } from '../../components/datasource/completeness';
import '../../components/datasource/completeness/completeness.css';

// Lazy load tab components for better performance
const BasicInfoTab = lazy(() => import('../../components/datasource/tabs/BasicInfoTab').then(m => ({ default: m.BasicInfoTab })));
const ConnectionTab = lazy(() => import('../../components/datasource/tabs/ConnectionTab').then(m => ({ default: m.ConnectionTab })));
const FileSettingsTab = lazy(() => import('../../components/datasource/tabs/FileSettingsTab').then(m => ({ default: m.FileSettingsTab })));
const SchemaTab = lazy(() => import('../../components/datasource/tabs/SchemaTab').then(m => ({ default: m.SchemaTab })));
const ScheduleTab = lazy(() => import('../../components/datasource/tabs/ScheduleTab').then(m => ({ default: m.ScheduleTab })));
const ValidationTab = lazy(() => import('../../components/datasource/tabs/ValidationTab').then(m => ({ default: m.ValidationTab })));
const NotificationsTab = lazy(() => import('../../components/datasource/tabs/NotificationsTab').then(m => ({ default: m.NotificationsTab })));
const OutputTab = lazy(() => import('../../components/datasource/tabs/OutputTab').then(m => ({ default: m.OutputTab })));
const MetricsTab = lazy(() => import('../../components/datasource/tabs/MetricsTab').then(m => ({ default: m.MetricsTab })));
const CronHelperDialog = lazy(() => import('../../components/datasource/CronHelperDialog'));

const { Title, Paragraph } = Typography;

const DataSourceEditEnhanced: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showSaveWarning, setShowSaveWarning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [parsedConfig, setParsedConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'failed' | null>(null);
  const [cronHelperVisible, setCronHelperVisible] = useState<boolean>(false);
  const [jsonSchema, setJsonSchema] = useState<JSONSchema>({});
  const [outputConfig, setOutputConfig] = useState<OutputConfiguration>({
    defaultOutputFormat: 'original',
    includeInvalidRecords: false,
    destinations: []
  });

  // Watch form fields
  const connectionType = Form.useWatch('connectionType', form);
  const fileType = Form.useWatch('fileType', form);
  const scheduleFrequency = Form.useWatch('scheduleFrequency', form);
  const cronExpression = Form.useWatch('cronExpression', form);

  // Completeness tracking: construct initial values from fetched data
  const editInitialValues = useMemo(() => {
    if (!dataSource || !parsedConfig) return undefined;
    const connectionConfig = parsedConfig?.connectionConfig || {};
    const fileConfig = parsedConfig?.fileConfig || {};
    const schedule = parsedConfig?.schedule || {};
    const validationRules = parsedConfig?.validationRules || {};
    const notificationSettings = parsedConfig?.notificationSettings || {};
    return {
      name: dataSource.Name,
      supplierName: dataSource.SupplierName,
      category: dataSource.Category,
      description: dataSource.Description,
      isActive: dataSource.IsActive,
      retentionDays: dataSource.AdditionalConfiguration?.RetentionDays || 30,
      connectionType: connectionConfig.type || 'Local',
      inputServerId: connectionConfig.inputServerId || (dataSource as any)?.FileServerId,
      nasDeviceId: connectionConfig.nasDeviceId || (dataSource as any)?.NasDeviceId,
      filePath: connectionConfig.path || dataSource.FilePath,
      httpEndpointPath: connectionConfig.url,
      kafkaTopic: connectionConfig.topic,
      fileType: fileConfig.type || extractFileTypeFromPattern(dataSource.FilePattern) || 'CSV',
      encoding: fileConfig.encoding || 'UTF-8',
      csvDelimiter: fileConfig.delimiter || ',',
      hasHeaders: fileConfig.hasHeaders !== false,
      excelSheet: fileConfig.sheetName,
      scheduleFrequency: schedule.frequency || 'Manual',
      scheduleEnabled: schedule.enabled || false,
      cronExpression: schedule.cronExpression,
      skipInvalidRecords: validationRules.skipInvalidRecords || false,
      maxErrorsAllowed: validationRules.maxErrorsAllowed,
      notifyOnSuccess: notificationSettings.onSuccess || false,
      notifyOnFailure: notificationSettings.onFailure !== false,
      notificationRecipients: notificationSettings.recipients?.join(', ') || '',
    };
  }, [dataSource, parsedConfig]);

  const { completeness, recalculate, getFieldStatus } = useCompletenessTracker(
    form, jsonSchema, outputConfig, editInitialValues, true /* isEditMode */
  );

  // Per-field border injection via DOM attributes (D-13, GAP-02)
  const applyFieldBorders = React.useCallback(() => {
    for (const [tabKey, config] of Object.entries(TAB_FIELD_CONFIG)) {
      if (!config?.fields) continue;

      const container = document.querySelector(`[data-tab-key="${tabKey}"]`);
      if (!container) continue;

      const formItems = container.querySelectorAll('.ant-form-item');
      const matchedFields = new Set<Element>();

      for (const field of config.fields) {
        for (const formItem of formItems) {
          if (matchedFields.has(formItem)) continue;
          const byId = formItem.querySelector(`[id="${field.name}"], [id*="${field.name}"]`);
          const label = formItem.querySelector(`label[for="${field.name}"], label[for*="${field.name}"]`);
          if (byId || label) {
            const status = getFieldStatus(tabKey, field.name);
            (formItem as HTMLElement).setAttribute('data-completeness-status', status);
            matchedFields.add(formItem);
            break;
          }
        }
      }

      for (const formItem of formItems) {
        if (!matchedFields.has(formItem) && !(formItem as HTMLElement).getAttribute('data-completeness-status')) {
          (formItem as HTMLElement).setAttribute('data-completeness-status', 'optional-empty');
        }
      }
    }
  }, [getFieldStatus]);

  useEffect(() => {
    // Run immediately for already-mounted tabs
    applyFieldBorders();
    // Run again after a short delay to catch lazy-loaded tab content that mounts after React render
    const timer = setTimeout(applyFieldBorders, 500);
    return () => clearTimeout(timer);
  }, [completeness, applyFieldBorders, activeTab]);

  // Handlers
  const handleSchemaChange = (newSchema: JSONSchema) => {
    setJsonSchema(newSchema);
  };

  const handleCronHelperSelect = (expression: string) => {
    form.setFieldsValue({ cronExpression: expression });
    message.success('ביטוי Cron עודכן');
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      await form.validateFields(['connectionType', 'connectionHost', 'connectionPort', 'connectionUsername', 'connectionPassword', 'connectionPath']);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConnectionTestResult('success');
      message.success('חיבור הצליח');
    } catch (err) {
      setConnectionTestResult('failed');
      message.error('חיבור נכשל');
    } finally {
      setTestingConnection(false);
    }
  };

  // Fetch data source
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

        if (data.Data.JsonSchema) {
          setJsonSchema(data.Data.JsonSchema);
        }

        const additionalConfig = data.Data.AdditionalConfiguration || {};
        let configSettings: any = {};
        let connectionConfig: any = {};
        let fileConfig: any = {};
        let schedule: any = {};
        let validationRules: any = {};
        let notificationSettings: any = {};

        try {
          if (additionalConfig.ConfigurationSettings) {
            configSettings = JSON.parse(additionalConfig.ConfigurationSettings);
            connectionConfig = configSettings.connectionConfig || {};
            fileConfig = configSettings.fileConfig || {};
            schedule = configSettings.schedule || {};
            validationRules = configSettings.validationRules || {};
            notificationSettings = configSettings.notificationSettings || {};
          }
        } catch (e) {
          console.warn('Failed to parse configuration settings:', e);
        }

        setParsedConfig(configSettings);

        form.setFieldsValue({
          name: data.Data.Name,
          supplierName: data.Data.SupplierName,
          category: data.Data.Category,
          description: data.Data.Description,
          isActive: data.Data.IsActive,
          retentionDays: additionalConfig.RetentionDays || 30,
          connectionType: connectionConfig.type || 'Local',
          connectionHost: connectionConfig.host,
          connectionPort: connectionConfig.port,
          connectionUsername: connectionConfig.username,
          connectionPassword: connectionConfig.password,
          connectionPath: connectionConfig.path || data.Data.FilePath,
          connectionUrl: connectionConfig.url,
          filePattern: connectionConfig.filePattern || data.Data.FilePattern || '*.*',
          // Server reference (v0.2.0)
          inputServerId: connectionConfig.inputServerId || (data.Data as any).FileServerId,
          // Kafka fields
          kafkaBrokers: connectionConfig.brokers,
          kafkaTopic: connectionConfig.topic,
          kafkaConsumerGroup: connectionConfig.consumerGroup,
          kafkaSecurityProtocol: connectionConfig.securityProtocol,
          kafkaOffsetReset: connectionConfig.offsetReset,
          // NAS fields
          nasDeviceId: connectionConfig.nasDeviceId || (data.Data as any).NasDeviceId,
          nasSubPath: connectionConfig.nasSubPath,
          fileType: fileConfig.type || extractFileTypeFromPattern(data.Data.FilePattern) || 'CSV',
          csvDelimiter: fileConfig.delimiter || ',',
          hasHeaders: fileConfig.hasHeaders !== false,
          excelSheet: fileConfig.sheetName,
          encoding: fileConfig.encoding || 'UTF-8',
          scheduleFrequency: schedule.frequency || 'Manual',
          cronExpression: schedule.cronExpression,
          scheduleEnabled: schedule.enabled || false,
          skipInvalidRecords: validationRules.skipInvalidRecords || false,
          maxErrorsAllowed: validationRules.maxErrorsAllowed,
          notifyOnSuccess: notificationSettings.onSuccess || false,
          notifyOnFailure: notificationSettings.onFailure !== false,
          notificationRecipients: notificationSettings.recipients?.join(', ') || '',
        });

        // Initialize output config if it exists (handle both camelCase and PascalCase)
        // Priority: configSettings.outputConfig > data.Data.Output
        let outputConfigData = configSettings.outputConfig || configSettings.OutputConfig || data.Data.Output;

        // Check if destinations have PascalCase properties (check first destination)
        const needsConversion = outputConfigData?.destinations?.[0]?.Type !== undefined || outputConfigData?.DefaultOutputFormat !== undefined;

        // If we have PascalCase properties, convert to camelCase
        if (outputConfigData && needsConversion) {
          outputConfigData = {
            defaultOutputFormat: outputConfigData.DefaultOutputFormat || outputConfigData.defaultOutputFormat,
            includeInvalidRecords: outputConfigData.IncludeInvalidRecords ?? outputConfigData.includeInvalidRecords,
            destinations: (outputConfigData.Destinations || outputConfigData.destinations || []).map((dest: any) => ({
              id: dest.Id,
              name: dest.Name,
              description: dest.Description,
              type: dest.Type,
              enabled: dest.Enabled,
              outputFormat: dest.OutputFormat,
              includeInvalidRecords: dest.IncludeInvalidRecords,
              outputServerId: dest.OutputServerId,
              nasDeviceId: dest.NasDeviceId,
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

        if (outputConfigData) {
          setOutputConfig(outputConfigData);
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
  }, [id, form]);

  const handleSubmit = async (values: any) => {
    if (!id || !dataSource) {
      message.error('Data source information is missing');
      return;
    }

    setSaving(true);

    try {
      const existingConfig = parsedConfig || {};
      
      let cronExpressionToSave = values.cronExpression;
      if (values.scheduleFrequency !== 'Custom' && values.scheduleFrequency !== 'Manual') {
        cronExpressionToSave = frequencyToCron(values.scheduleFrequency);
      }

      const mergedConfig = {
        connectionConfig: {
          ...(existingConfig.connectionConfig || {}),
          type: values.connectionType || existingConfig.connectionConfig?.type,
          host: values.connectionHost ?? existingConfig.connectionConfig?.host,
          port: values.connectionPort ?? existingConfig.connectionConfig?.port,
          username: values.connectionUsername ?? existingConfig.connectionConfig?.username,
          password: values.connectionPassword ?? existingConfig.connectionConfig?.password,
          path: values.connectionPath ?? existingConfig.connectionConfig?.path,
          url: values.connectionUrl ?? existingConfig.connectionConfig?.url,
          filePattern: values.filePattern ?? existingConfig.connectionConfig?.filePattern ?? '*.*',
          // Kafka-specific fields
          brokers: values.kafkaBrokers ?? existingConfig.connectionConfig?.brokers,
          topic: values.kafkaTopic ?? existingConfig.connectionConfig?.topic,
          consumerGroup: values.kafkaConsumerGroup ?? existingConfig.connectionConfig?.consumerGroup,
          securityProtocol: values.kafkaSecurityProtocol ?? existingConfig.connectionConfig?.securityProtocol,
          offsetReset: values.kafkaOffsetReset ?? existingConfig.connectionConfig?.offsetReset,
          // Server reference (v0.2.0)
          inputServerId: values.inputServerId ?? existingConfig.connectionConfig?.inputServerId,
          // NAS-specific fields
          nasDeviceId: values.nasDeviceId ?? existingConfig.connectionConfig?.nasDeviceId,
          nasSubPath: values.nasSubPath ?? existingConfig.connectionConfig?.nasSubPath
        },
        fileConfig: {
          ...(existingConfig.fileConfig || {}),
          type: values.fileType || existingConfig.fileConfig?.type,
          delimiter: values.csvDelimiter ?? existingConfig.fileConfig?.delimiter,
          hasHeaders: values.hasHeaders ?? existingConfig.fileConfig?.hasHeaders,
          sheetName: values.excelSheet ?? existingConfig.fileConfig?.sheetName,
          encoding: values.encoding || existingConfig.fileConfig?.encoding
        },
        schedule: {
          ...(existingConfig.schedule || {}),
          frequency: values.scheduleFrequency || existingConfig.schedule?.frequency,
          cronExpression: cronExpressionToSave ?? existingConfig.schedule?.cronExpression,
          enabled: values.scheduleEnabled ?? existingConfig.schedule?.enabled
        },
        validationRules: {
          ...(existingConfig.validationRules || {}),
          skipInvalidRecords: values.skipInvalidRecords ?? existingConfig.validationRules?.skipInvalidRecords,
          maxErrorsAllowed: values.maxErrorsAllowed ?? existingConfig.validationRules?.maxErrorsAllowed
        },
        notificationSettings: {
          ...(existingConfig.notificationSettings || {}),
          onSuccess: values.notifyOnSuccess ?? existingConfig.notificationSettings?.onSuccess,
          onFailure: values.notifyOnFailure ?? existingConfig.notificationSettings?.onFailure,
          recipients: values.notificationRecipients
            ? values.notificationRecipients.split(',').map((r: string) => r.trim())
            : existingConfig.notificationSettings?.recipients || []
        },
        outputConfig: outputConfig
      };

      // D-16: Auto-disable if completeness check fails
      // D-27/GAP-04: Show inline save warning with missing fields
      let isActive = values.isActive ?? dataSource.IsActive;
      if (!completeness.isFullyComplete) {
        isActive = false;
        setShowSaveWarning(true);
        message.info(t('completeness.autoDisabled'));
      }

      const requestPayload: any = {
        Id: id,
        Name: values.name || dataSource.Name,
        SupplierName: values.supplierName || dataSource.SupplierName,
        Category: values.category || dataSource.Category,
        Description: values.description ?? dataSource.Description,
        ConnectionString: buildConnectionString(values) || dataSource.FilePath,
        IsActive: isActive,
        FilePattern: values.filePattern ?? existingConfig.connectionConfig?.filePattern ?? dataSource.FilePattern ?? '*.*',
        ScheduleFrequency: values.scheduleFrequency || mergedConfig.schedule.frequency,
        CronExpression: cronExpressionToSave ?? mergedConfig.schedule.cronExpression,
        ScheduleEnabled: values.scheduleEnabled ?? mergedConfig.schedule.enabled,
        ConfigurationSettings: JSON.stringify(mergedConfig),
        Output: {
          DefaultOutputFormat: outputConfig?.defaultOutputFormat || 'original',
          IncludeInvalidRecords: outputConfig?.includeInvalidRecords || false,
          Destinations: (outputConfig?.destinations || []).map(d => ({
            Id: d.id,
            Name: d.name,
            Description: d.description,
            Type: d.type,
            Enabled: d.enabled,
            OutputFormat: d.outputFormat,
            IncludeInvalidRecords: d.includeInvalidRecords,
            OutputServerId: d.outputServerId,
            NasDeviceId: d.nasDeviceId,
            KafkaConfig: d.kafkaConfig,
            FolderConfig: d.folderConfig,
            SftpConfig: d.sftpConfig,
            HttpConfig: d.httpConfig,
          }))
        },
        ValidationRules: null,
        Metadata: null,
        FileFormat: mergedConfig.fileConfig.type || null,
        RetentionDays: values.retentionDays ?? dataSource.AdditionalConfiguration?.RetentionDays,
        Version: dataSource.Version ?? 1
      };

      if (jsonSchema && Object.keys(jsonSchema).length > 0) {
        requestPayload.JsonSchema = jsonSchema;
      }

      // Map Archive settings (v0.2.0) - nest form fields in ArchiveSettings object
      if (values.isArchiveSource) {
        requestPayload.ArchiveSettings = {
          IsArchiveSource: values.isArchiveSource,
          ArchiveType: values.archiveType || 'auto',
          ArchivePassword: values.archivePassword,
          ExtractionPattern: values.extractionPattern || '*.*',
          ProcessNestedArchives: values.processNestedArchives || false
        };
      }

      const response = await fetch(`/api/v1/datasource/${id}`, {
        method: 'PUT',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.Error?.Message || errorData.message || '\u05d4\u05e8\u05e9\u05d5\u05de\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4 \u05e2\u05dc \u05d9\u05d3\u05d9 \u05de\u05e9\u05ea\u05de\u05e9 \u05d0\u05d7\u05e8. \u05d0\u05e0\u05d0 \u05e8\u05e2\u05e0\u05df \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.');
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data: ApiResponse<any> = await response.json();

      if (data.IsSuccess) {
        message.success(t('messages.dataSourceUpdated'));
        // Refresh the data source instead of navigating away
        await fetchDataSource();
        // Reset to basic info tab to show updated data
        setActiveTab('basic');
      } else {
        throw new Error(data.Error?.Message || 'Failed to update data source');
      }
    } catch (err) {
      console.error('Error updating data source:', err);
      message.error(err instanceof Error ? err.message : 'Failed to update data source');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchDataSource();
  }, [fetchDataSource]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>טוען נתוני מקור נתונים...</div>
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

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>עריכת מקור נתונים</Title>
          <Paragraph className="page-subtitle">
            עריכת הגדרות מקור נתונים עם תמיכה בכל ההגדרות המתקדמות
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasources')}>{t('common.back')}</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Main form area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card>
            <Spin spinning={saving}>
              <Form form={form} layout="vertical" onFinish={handleSubmit} preserve={true} onValuesChange={recalculate}>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  type="card"
                  items={[
                    {
                      key: 'basic',
                      label: <span><FileOutlined /> מידע בסיסי</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="basic" className="completeness-tab">
                            <BasicInfoTab form={form} t={t} />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'connection',
                      label: <span><ApiOutlined /> הגדרות קלט</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="connection" className="completeness-tab">
                            <ConnectionTab
                              form={form}
                              t={t}
                              connectionType={connectionType}
                              testingConnection={testingConnection}
                              connectionTestResult={connectionTestResult}
                              onTestConnection={handleTestConnection}
                              savedFieldValues={parsedConfig?.connectionConfig ? {
                                inputServerId: parsedConfig.connectionConfig.inputServerId || (dataSource as any)?.FileServerId,
                                nasDeviceId: parsedConfig.connectionConfig.nasDeviceId || (dataSource as any)?.NasDeviceId,
                              } : undefined}
                            />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'file',
                      label: <span><FileOutlined /> הגדרות קובץ</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="file" className="completeness-tab">
                            <FileSettingsTab form={form} t={t} fileType={fileType} />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'schema',
                      label: <span><FileTextOutlined /> הגדרת Schema</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="schema" className="completeness-tab">
                            <SchemaTab jsonSchema={jsonSchema} onChange={handleSchemaChange} />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'metrics',
                      label: <span><BarChartOutlined /> מדדים</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="metrics" className="completeness-tab completeness-tab--recommended">
                            <MetricsTab
                              dataSourceId={id!}
                              dataSourceName={dataSource.Name}
                              onCreateMetric={() => navigate(`/metrics/new?dataSourceId=${id}`)}
                              onEditMetric={(metricId) => navigate(`/metrics/edit/${metricId}?dataSourceId=${id}`)}
                            />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'schedule',
                      label: <span><ClockCircleOutlined /> תזמון</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="schedule" className="completeness-tab completeness-tab--recommended">
                            <ScheduleTab
                              form={form}
                              t={t}
                              scheduleFrequency={scheduleFrequency}
                              cronExpression={cronExpression}
                              onOpenCronHelper={() => setCronHelperVisible(true)}
                            />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'validation',
                      label: <span><SafetyOutlined /> כללי אימות</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="validation" className="completeness-tab completeness-tab--optional">
                            <ValidationTab form={form} t={t} />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'notifications',
                      label: <span><BellOutlined /> התראות</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="notifications" className="completeness-tab completeness-tab--optional">
                            <NotificationsTab form={form} t={t} />
                          </div>
                        </Suspense>
                      )
                    },
                    {
                      key: 'output',
                      label: <span><ExportOutlined /> פלט</span>,
                      children: (
                        <Suspense fallback={<Skeleton active />}>
                          <div data-tab-key="output" className="completeness-tab completeness-tab--recommended">
                            <OutputTab output={outputConfig} onChange={setOutputConfig} />
                          </div>
                        </Suspense>
                      )
                    }
                  ]}
                />

                <Divider />

                {/* GAP-04: Save feedback with missing fields */}
                {showSaveWarning && !completeness.isFullyComplete && (
                  <Alert
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setShowSaveWarning(false)}
                    message={t('completeness.saveWarningTitle')}
                    description={
                      <div>
                        <div>{t('completeness.saveWarningMessage')}</div>
                        <ul style={{ margin: '4px 0 0', paddingInlineStart: 16 }}>
                          {completeness.missingFields.map((f) => (
                            <li key={f}>{t(`completeness.fieldLabels.${f}`, { defaultValue: f })}</li>
                          ))}
                        </ul>
                      </div>
                    }
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                  <Space size="middle">
                    <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={connectionTestResult === 'failed'}
                      onClick={() => { if (!completeness.isFullyComplete) setShowSaveWarning(true); }}
                    >
                      {t('common.update')}
                    </Button>
                    <Button size="large" onClick={() => navigate(`/datasources/${id}`)} disabled={saving}>
                      {t('common.cancel')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Spin>
          </Card>
        </div>

        {/* Completeness sidebar (D-01) */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <CompletenessPanel
            completeness={completeness}
            activeTab={activeTab}
            onTabClick={setActiveTab}
            isEditMode={true}
          />
        </div>
      </div>

      {cronHelperVisible && (
        <Suspense fallback={null}>
          <CronHelperDialog
            visible={cronHelperVisible}
            onClose={() => setCronHelperVisible(false)}
            onSelect={handleCronHelperSelect}
            currentValue={form.getFieldValue('cronExpression')}
          />
        </Suspense>
      )}
    </div>
  );
};

export default DataSourceEditEnhanced;
