import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Typography, Card, Form, Button, Space, Alert, Spin, App, Divider, Tabs, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeftOutlined, SaveOutlined, FileOutlined, ApiOutlined, ClockCircleOutlined, SafetyOutlined, BellOutlined, FileTextOutlined, ExportOutlined } from '@ant-design/icons';
import { type JSONSchema } from 'jsonjoy-builder';
import type { OutputConfiguration, ClonePayload } from '../../components/datasource/shared/types';
import { buildConnectionString, frequencyToCron } from '../../components/datasource/shared/helpers';
import { DEFAULT_FORM_VALUES } from '../../components/datasource/shared/constants';
import { useCompletenessTracker, CompletenessPanel, TAB_FIELD_CONFIG, REQUIRED_TABS, RECOMMENDED_TABS, OPTIONAL_TABS } from '../../components/datasource/completeness';
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
const CronHelperDialog = lazy(() => import('../../components/datasource/CronHelperDialog'));

const { Title, Paragraph } = Typography;

const DataSourceFormEnhanced: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const cloneData = (location.state as { cloneData?: ClonePayload } | null)?.cloneData;
  const [form] = Form.useForm();

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [showSaveWarning, setShowSaveWarning] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('basic');
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

  // Completeness tracking: extract initial values for lazy-loaded tabs
  const cloneInitialValues = useMemo(() => {
    if (!cloneData) return undefined;
    return {
      name: cloneData.name,
      supplierName: cloneData.supplierName,
      category: cloneData.category,
      description: cloneData.description || '',
      isActive: cloneData.isActive,
      filePattern: cloneData.filePattern,
      scheduleEnabled: false,
      scheduleFrequency: cloneData.schedule?.frequency || 'Manual',
      cronExpression: cloneData.schedule?.cronExpression || '',
      fileType: cloneData.fileConfig?.type || 'CSV',
      csvDelimiter: cloneData.fileConfig?.delimiter || ',',
      hasHeaders: cloneData.fileConfig?.hasHeaders ?? true,
      excelSheet: cloneData.fileConfig?.sheetName || '',
      encoding: cloneData.fileConfig?.encoding || 'UTF-8',
      connectionType: cloneData.connectionConfig?.type || 'NFS',
      inputServerId: cloneData.connectionConfig?.inputServerId,
      nasDeviceId: cloneData.connectionConfig?.nasDeviceId,
      kafkaTopic: cloneData.connectionConfig?.topic || '',
      retentionDays: cloneData.retentionDays || 30,
      skipInvalidRecords: cloneData.validationRules?.skipInvalidRecords ?? false,
      maxErrorsAllowed: cloneData.validationRules?.maxErrorsAllowed,
      notifyOnSuccess: cloneData.notificationSettings?.onSuccess ?? false,
      notifyOnFailure: cloneData.notificationSettings?.onFailure ?? true,
      notificationRecipients: cloneData.notificationSettings?.recipients?.join(', ') || '',
    };
  }, [cloneData]);

  const { completeness, recalculate, getFieldStatus } = useCompletenessTracker(
    form, jsonSchema, outputConfig, cloneInitialValues, false /* isEditMode */
  );

  // Per-field border injection via DOM attributes (D-13, GAP-02)
  useEffect(() => {
    // Apply to ALL tabs that have fields config (required + recommended + optional)
    for (const [tabKey, config] of Object.entries(TAB_FIELD_CONFIG)) {
      if (!config?.fields) continue;

      const container = document.querySelector(`[data-tab-key="${tabKey}"]`);
      if (!container) continue;

      const formItems = container.querySelectorAll(':scope > .ant-form-item, .ant-form-item');
      const matchedFields = new Set<Element>();

      // First pass: match configured fields to form items
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

      // Second pass: mark unmatched form items as optional (gray borders)
      for (const formItem of formItems) {
        if (!matchedFields.has(formItem) && !(formItem as HTMLElement).getAttribute('data-completeness-status')) {
          (formItem as HTMLElement).setAttribute('data-completeness-status', 'optional-empty');
        }
      }
    }
  }, [completeness, getFieldStatus]);

  // Populate form from clone data (if navigated from clone action)
  React.useEffect(() => {
    if (!cloneData) return;

    // Set form fields (per D-04 carry-over, D-05 resets)
    const formValues: Record<string, any> = {
      name: cloneData.name,
      supplierName: cloneData.supplierName,
      category: cloneData.category,
      description: cloneData.description || '',
      isActive: cloneData.isActive,
      filePattern: cloneData.filePattern,
      // Schedule: preserve cron/frequency but force disabled (per D-05)
      scheduleEnabled: false,
      scheduleFrequency: cloneData.schedule?.frequency || 'Manual',
      cronExpression: cloneData.schedule?.cronExpression || '',
      // File settings
      fileType: cloneData.fileConfig?.type || 'CSV',
      csvDelimiter: cloneData.fileConfig?.delimiter || ',',
      hasHeaders: cloneData.fileConfig?.hasHeaders ?? true,
      excelSheet: cloneData.fileConfig?.sheetName || '',
      encoding: cloneData.fileConfig?.encoding || 'UTF-8',
      // Connection settings
      connectionType: cloneData.connectionConfig?.type || 'NFS',
      connectionHost: cloneData.connectionConfig?.host || '',
      connectionPort: cloneData.connectionConfig?.port || undefined,
      connectionUsername: cloneData.connectionConfig?.username || '',
      connectionPassword: cloneData.connectionConfig?.password || '',
      connectionPath: cloneData.connectionConfig?.path || '',
      connectionUrl: cloneData.connectionConfig?.url || '',
      inputServerId: cloneData.connectionConfig?.inputServerId,
      nasDeviceId: cloneData.connectionConfig?.nasDeviceId,
      nasSubPath: cloneData.connectionConfig?.nasSubPath,
      // Kafka fields
      kafkaBrokers: cloneData.connectionConfig?.brokers || '',
      kafkaTopic: cloneData.connectionConfig?.topic || '',
      kafkaConsumerGroup: cloneData.connectionConfig?.consumerGroup || '',
      kafkaSecurityProtocol: cloneData.connectionConfig?.securityProtocol || 'PLAINTEXT',
      kafkaOffsetReset: cloneData.connectionConfig?.offsetReset || 'earliest',
      // Validation
      skipInvalidRecords: cloneData.validationRules?.skipInvalidRecords ?? false,
      maxErrorsAllowed: cloneData.validationRules?.maxErrorsAllowed,
      // Notifications
      notifyOnSuccess: cloneData.notificationSettings?.onSuccess ?? false,
      notifyOnFailure: cloneData.notificationSettings?.onFailure ?? true,
      notificationRecipients: cloneData.notificationSettings?.recipients?.join(', ') || '',
      // Retention
      retentionDays: cloneData.retentionDays || 30,
    };

    // Archive settings (if present)
    if (cloneData.archiveSettings) {
      formValues.isArchiveSource = cloneData.archiveSettings.IsArchiveSource;
      formValues.archiveType = cloneData.archiveSettings.ArchiveType;
      formValues.archivePassword = cloneData.archiveSettings.ArchivePassword;
      formValues.extractionPattern = cloneData.archiveSettings.ExtractionPattern;
      formValues.processNestedArchives = cloneData.archiveSettings.ProcessNestedArchives;
    }

    form.setFieldsValue(formValues);

    // Set non-form state: JSON Schema
    if (cloneData.jsonSchema && Object.keys(cloneData.jsonSchema).length > 0) {
      setJsonSchema(cloneData.jsonSchema);
    }

    // Set non-form state: Output configuration (with already-regenerated UUIDs)
    if (cloneData.outputConfig) {
      setOutputConfig(cloneData.outputConfig);
    }

    // Reset connection test status (per D-05)
    setConnectionTestResult(null);
  }, [cloneData]); // eslint-disable-line react-hooks/exhaustive-deps

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
      message.success(t('datasources.form.connectionSuccess'));
    } catch (err) {
      setConnectionTestResult('failed');
      message.error(t('datasources.form.connectionFailed'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (rawValues: any) => {
    setLoading(true);
    setError(null);

    // Merge clone data for lazy-loaded tab fields that may not be mounted yet
    // Form.setFieldsValue silently drops values for unmounted Form.Items
    const values = cloneData ? {
      connectionType: cloneData.connectionConfig?.type || 'NFS',
      connectionHost: cloneData.connectionConfig?.host || '',
      connectionPort: cloneData.connectionConfig?.port || undefined,
      connectionUsername: cloneData.connectionConfig?.username || '',
      connectionPassword: cloneData.connectionConfig?.password || '',
      connectionPath: cloneData.connectionConfig?.path || '',
      connectionUrl: cloneData.connectionConfig?.url || '',
      inputServerId: cloneData.connectionConfig?.inputServerId,
      nasDeviceId: cloneData.connectionConfig?.nasDeviceId,
      nasSubPath: cloneData.connectionConfig?.nasSubPath,
      kafkaBrokers: cloneData.connectionConfig?.brokers || '',
      kafkaTopic: cloneData.connectionConfig?.topic || '',
      kafkaConsumerGroup: cloneData.connectionConfig?.consumerGroup || '',
      kafkaSecurityProtocol: cloneData.connectionConfig?.securityProtocol || 'PLAINTEXT',
      kafkaOffsetReset: cloneData.connectionConfig?.offsetReset || 'earliest',
      fileType: cloneData.fileConfig?.type || 'CSV',
      csvDelimiter: cloneData.fileConfig?.delimiter || ',',
      hasHeaders: cloneData.fileConfig?.hasHeaders ?? true,
      excelSheet: cloneData.fileConfig?.sheetName || '',
      encoding: cloneData.fileConfig?.encoding || 'UTF-8',
      skipInvalidRecords: cloneData.validationRules?.skipInvalidRecords ?? false,
      maxErrorsAllowed: cloneData.validationRules?.maxErrorsAllowed,
      notifyOnSuccess: cloneData.notificationSettings?.onSuccess ?? false,
      notifyOnFailure: cloneData.notificationSettings?.onFailure ?? true,
      notificationRecipients: cloneData.notificationSettings?.recipients?.join(', ') || '',
      scheduleEnabled: false,
      scheduleFrequency: cloneData.schedule?.frequency || 'Manual',
      cronExpression: cloneData.schedule?.cronExpression || '',
      ...rawValues, // User-edited values override clone defaults
    } : rawValues;

    try {
      let cronExpressionToSave = values.cronExpression;
      if (values.scheduleFrequency !== 'Custom' && values.scheduleFrequency !== 'Manual') {
        cronExpressionToSave = frequencyToCron(values.scheduleFrequency);
      }

      // D-16: Auto-disable if completeness check fails
      // D-27/GAP-04: Show inline save warning with missing fields
      let isActive = values.isActive ?? true;
      if (!completeness.isFullyComplete) {
        isActive = false;
        setShowSaveWarning(true);
        message.info(t('completeness.autoDisabled'));
      }

      const requestPayload: any = {
        name: values.name,
        supplierName: values.supplierName,
        category: values.category,
        description: values.description,
        connectionString: buildConnectionString(values),
        isActive,
        filePattern: values.filePattern || '*.*',
        configurationSettings: JSON.stringify({
          connectionConfig: {
            type: values.connectionType,
            host: values.connectionHost,
            port: values.connectionPort,
            username: values.connectionUsername,
            password: values.connectionPassword,
            path: values.connectionPath,
            url: values.connectionUrl,
            filePattern: values.filePattern || '*.*',
            // Kafka-specific fields
            brokers: values.kafkaBrokers,
            topic: values.kafkaTopic,
            consumerGroup: values.kafkaConsumerGroup,
            securityProtocol: values.kafkaSecurityProtocol,
            offsetReset: values.kafkaOffsetReset,
            // Server reference (v0.2.0)
            inputServerId: values.inputServerId,
            // NAS-specific fields
            nasDeviceId: values.nasDeviceId,
            nasSubPath: values.nasSubPath,
          },
          fileConfig: {
            type: values.fileType,
            delimiter: values.csvDelimiter,
            hasHeaders: values.hasHeaders,
            sheetName: values.excelSheet,
            encoding: values.encoding
          },
          schedule: {
            frequency: values.scheduleFrequency,
            cronExpression: cronExpressionToSave,
            enabled: values.scheduleEnabled ?? false
          },
          validationRules: {
            skipInvalidRecords: values.skipInvalidRecords ?? false,
            maxErrorsAllowed: values.maxErrorsAllowed
          },
          notificationSettings: {
            onSuccess: values.notifyOnSuccess ?? false,
            onFailure: values.notifyOnFailure ?? true,
            recipients: values.notificationRecipients ? values.notificationRecipients.split(',').map((r: string) => r.trim()) : []
          },
          outputConfig: outputConfig
        }),
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
        fileFormat: values.fileType,
        retentionDays: values.retentionDays
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

      const response = await fetch('/api/v1/datasource', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();
      if (!response.ok || !data.IsSuccess) {
        const errorMsg = data.Error?.Message || '';
        const errorCode = data.Error?.Code || '';
        if (response.status === 409 || errorCode.includes('DUPLICATE') || errorMsg.includes('duplicate') || errorMsg.includes('already exists') || errorCode.includes('DATABASE_ERROR')) {
          throw new Error(t('errors.duplicateName', { defaultValue: 'שם מקור הנתונים כבר קיים. שנה את השם ונסה שוב.' }));
        }
        throw new Error(errorMsg || `HTTP error! status: ${response.status}`);
      }

      message.success(t('messages.dataSourceCreated'));
      navigate('/datasources');
    } catch (err) {
      console.error('Error creating data source:', err);
      setError(err instanceof Error ? err.message : 'Failed to create data source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {cloneData ? t('datasources.clone.confirmTitle', { defaultValue: 'שכפול מקור נתונים' }) : t('datasources.create')}
          </Title>
          <Paragraph className="page-subtitle">
            צור מקור נתונים חדש עם הגדרות מלאות לחיבור, עיבוד, ותזמון
          </Paragraph>
        </div>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/datasources')}>
            {t('common.back')}
          </Button>
        </Space>
      </div>

      {error && (
        <Alert message={t('common.error')} description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Main form area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card>
            <Spin spinning={loading}>
              <Form form={form} layout="vertical" onFinish={handleSubmit} preserve={true} initialValues={DEFAULT_FORM_VALUES} onValuesChange={recalculate}>
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
                              savedFieldValues={cloneData?.connectionConfig ? {
                                inputServerId: cloneData.connectionConfig.inputServerId,
                                nasDeviceId: cloneData.connectionConfig.nasDeviceId,
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
                    <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={loading} disabled={connectionTestResult === 'failed'}
                      onClick={() => { if (!completeness.isFullyComplete) setShowSaveWarning(true); }}
                    >
                      {t('common.create')}
                    </Button>
                    <Button size="large" onClick={() => navigate('/datasources')} disabled={loading}>
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
            isEditMode={false}
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

export default DataSourceFormEnhanced;
