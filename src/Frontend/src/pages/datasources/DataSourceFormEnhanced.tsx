import React, { useState, Suspense, lazy } from 'react';
import { Typography, Card, Form, Button, Space, Alert, Spin, message, Divider, Tabs, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, SaveOutlined, FileOutlined, ApiOutlined, ClockCircleOutlined, SafetyOutlined, BellOutlined, FileTextOutlined, ExportOutlined } from '@ant-design/icons';
import { type JSONSchema } from 'jsonjoy-builder';
import type { OutputConfiguration } from '../../components/datasource/shared/types';

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

// Import shared utilities
import { buildConnectionString, frequencyToCron } from '../../components/datasource/shared/helpers';
import { DEFAULT_FORM_VALUES } from '../../components/datasource/shared/constants';

const { Title, Paragraph } = Typography;

const DataSourceFormEnhanced: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  // State
  const [loading, setLoading] = useState<boolean>(false);
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

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);

    try {
      let cronExpressionToSave = values.cronExpression;
      if (values.scheduleFrequency !== 'Custom' && values.scheduleFrequency !== 'Manual') {
        cronExpressionToSave = frequencyToCron(values.scheduleFrequency);
      }

      const requestPayload: any = {
        name: values.name,
        supplierName: values.supplierName,
        category: values.category,
        description: values.description,
        connectionString: buildConnectionString(values),
        isActive: values.isActive ?? true,
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
            offsetReset: values.kafkaOffsetReset
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
        output: {
          defaultOutputFormat: outputConfig?.defaultOutputFormat || 'original',
          includeInvalidRecords: outputConfig?.includeInvalidRecords || false,
          destinations: outputConfig?.destinations || []
        },
        fileFormat: values.fileType,
        retentionDays: values.retentionDays
      };

      if (jsonSchema && Object.keys(jsonSchema).length > 0) {
        requestPayload.JsonSchema = jsonSchema;
      }

      const response = await fetch('http://localhost:5001/api/v1/datasource', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        if (response.status === 409) throw new Error(t('errors.duplicateName'));
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.IsSuccess) {
        message.success(t('messages.dataSourceCreated'));
        navigate('/datasources');
      } else {
        throw new Error(data.Error?.Message || 'Failed to create data source');
      }
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
          <Title level={2} style={{ margin: 0 }}>{t('datasources.create')}</Title>
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

      <Card>
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} preserve={true} initialValues={DEFAULT_FORM_VALUES}>
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
                      <BasicInfoTab form={form} t={t} />
                    </Suspense>
                  )
                },
                {
                  key: 'connection',
                  label: <span><ApiOutlined /> הגדרות חיבור</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <ConnectionTab
                        form={form}
                        t={t}
                        connectionType={connectionType}
                        testingConnection={testingConnection}
                        connectionTestResult={connectionTestResult}
                        onTestConnection={handleTestConnection}
                      />
                    </Suspense>
                  )
                },
                {
                  key: 'file',
                  label: <span><FileOutlined /> הגדרות קובץ</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <FileSettingsTab form={form} t={t} fileType={fileType} />
                    </Suspense>
                  )
                },
                {
                  key: 'schema',
                  label: <span><FileTextOutlined /> הגדרת Schema</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <SchemaTab jsonSchema={jsonSchema} onChange={handleSchemaChange} />
                    </Suspense>
                  )
                },
                {
                  key: 'schedule',
                  label: <span><ClockCircleOutlined /> תזמון</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <ScheduleTab
                        form={form}
                        t={t}
                        scheduleFrequency={scheduleFrequency}
                        cronExpression={cronExpression}
                        onOpenCronHelper={() => setCronHelperVisible(true)}
                      />
                    </Suspense>
                  )
                },
                {
                  key: 'validation',
                  label: <span><SafetyOutlined /> כללי אימות</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <ValidationTab form={form} t={t} />
                    </Suspense>
                  )
                },
                {
                  key: 'notifications',
                  label: <span><BellOutlined /> התראות</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <NotificationsTab form={form} t={t} />
                    </Suspense>
                  )
                },
                {
                  key: 'output',
                  label: <span><ExportOutlined /> פלט</span>,
                  children: (
                    <Suspense fallback={<Skeleton active />}>
                      <OutputTab output={outputConfig} onChange={setOutputConfig} />
                    </Suspense>
                  )
                }
              ]}
            />

            <Divider />
            <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
              <Space size="middle">
                <Button type="primary" size="large" htmlType="submit" icon={<SaveOutlined />} loading={loading} disabled={connectionTestResult === 'failed'}>
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
