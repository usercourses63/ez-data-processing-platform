/**
 * ConnectionTab - Data Source Connection Configuration
 * v0.2.0: Server-based configuration ONLY (no manual mode)
 *
 * Flow:
 * 1. Select connection protocol (FTP, SFTP, HTTP, Kafka, S3, NFS)
 * 2. Select from compatible servers (configured by admin)
 * 3. Enter applicative settings (path, pattern, topic, etc.)
 */
import React, { useMemo } from 'react';
import { Form, Input, Select, Button, Space, Alert, Row, Col, Tag, Divider, Typography } from 'antd';
import { FormInstance } from 'antd/es/form';
import { ApiOutlined, FileOutlined, CheckCircleOutlined, CloseCircleOutlined, CloudServerOutlined, DatabaseOutlined, WarningOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { KAFKA_OFFSET_RESET } from '../shared/constants';
import { getInputServers, serverQueryKeys, AdminServer } from '../../../services/servers-api-client';
import { ArchiveSettingsSection } from './sections/ArchiveSettingsSection';

const { Option } = Select;
const { Text } = Typography;

interface ConnectionTabProps {
  form: FormInstance;
  t: (key: string) => string;
  connectionType: string;
  testingConnection: boolean;
  connectionTestResult: 'success' | 'failed' | null;
  onTestConnection: () => void;
}

// Server type icons for display
const serverTypeIcons: Record<string, React.ReactNode> = {
  ftp: <ApiOutlined />,
  sftp: <ApiOutlined />,
  s3: <CloudServerOutlined />,
  http: <ApiOutlined />,
  nfs: <FileOutlined />,
  kafka: <DatabaseOutlined />,
};

// Protocol to server type mapping
const protocolToServerType: Record<string, string> = {
  'FTP': 'ftp',
  'SFTP': 'sftp',
  'HTTP': 'http',
  'Kafka': 'kafka',
  'S3': 's3',
  'NFS': 'nfs',
};

export const ConnectionTab: React.FC<ConnectionTabProps> = ({
  form,
  t,
  connectionType,
  testingConnection,
  connectionTestResult,
  onTestConnection
}) => {
  // Fetch available input servers
  const { data: inputServers = [], isLoading: loadingServers } = useQuery({
    queryKey: serverQueryKeys.list('input'),
    queryFn: getInputServers,
  });

  // Watch form fields
  const inputServerId = Form.useWatch('inputServerId', form);
  const isArchiveSource = Form.useWatch('isArchiveSource', form);

  // Filter servers based on selected protocol
  const compatibleServers = useMemo(() => {
    if (!connectionType) return [];
    const serverType = protocolToServerType[connectionType]?.toLowerCase();
    if (!serverType) return [];

    return inputServers.filter((server: AdminServer) =>
      server.IsActive &&
      server.ServerType?.toLowerCase() === serverType
    );
  }, [connectionType, inputServers]);

  // Get selected server details
  const selectedServer = useMemo(() => {
    if (!inputServerId) return null;
    return inputServers.find((s: AdminServer) => s.ID === inputServerId) || null;
  }, [inputServerId, inputServers]);

  // Check if servers are available for the selected protocol
  const hasCompatibleServers = compatibleServers.length > 0;

  // Effective connection type (normalized to lowercase)
  const effectiveConnectionType = connectionType?.toLowerCase();

  return (
    <>
      <Alert
        message="הגדרות חיבור למקור הנתונים"
        description="בחר את סוג הפרוטוקול ושרת שהוגדר על ידי מנהל המערכת"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Step 1: Protocol Selection */}
      <Form.Item
        name="connectionType"
        label={
          <Space>
            <ApiOutlined />
            {t('datasource.fields.connectionType') || 'סוג פרוטוקול'}
          </Space>
        }
        rules={[{ required: true, message: t('errors.required') }]}
        tooltip="בחר את סוג החיבור למקור הנתונים"
      >
        <Select
          placeholder="בחר סוג פרוטוקול..."
          onChange={() => {
            // Reset server selection when protocol changes
            form.setFieldsValue({ inputServerId: undefined });
          }}
        >
          <Option value="FTP">
            <Space>
              <ApiOutlined />
              FTP - File Transfer Protocol
            </Space>
          </Option>
          <Option value="SFTP">
            <Space>
              <ApiOutlined />
              SFTP - Secure FTP
            </Space>
          </Option>
          <Option value="HTTP">
            <Space>
              <ApiOutlined />
              HTTP/HTTPS - Web API
            </Space>
          </Option>
          <Option value="Kafka">
            <Space>
              <DatabaseOutlined />
              Kafka - Message Queue
            </Space>
          </Option>
          <Option value="S3">
            <Space>
              <CloudServerOutlined />
              S3 - Object Storage (MinIO)
            </Space>
          </Option>
          <Option value="NFS">
            <Space>
              <FileOutlined />
              NFS - Network File System
            </Space>
          </Option>
        </Select>
      </Form.Item>

      {/* Step 2: Server Selection - Only show after protocol selected */}
      {connectionType && (
        <>
          <Divider>{t('datasource.sections.serverSelection') || 'בחירת שרת'}</Divider>

          {!hasCompatibleServers ? (
            <Alert
              message={`אין שרתי ${connectionType} זמינים`}
              description={
                <Space direction="vertical" size="small">
                  <Text>{t('datasource.noServersHint') || 'פנה למנהל המערכת להוספת שרת מתאים'}</Text>
                  <Text type="secondary">
                    {t('navigation.adminSettings') || 'הגדרות מערכת'} → {t('admin.tabs.inputServers') || 'שרתי קלט'}
                  </Text>
                </Space>
              }
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 16 }}
              action={
                <Button
                  type="link"
                  size="small"
                  onClick={() => window.open('/admin', '_blank')}
                >
                  {t('datasource.goToAdminSettings') || 'עבור להגדרות מערכת'}
                </Button>
              }
            />
          ) : (
            <Form.Item
              name="inputServerId"
              label={
                <Space>
                  <CloudServerOutlined />
                  {t('datasource.fields.inputServer') || 'שרת קלט'}
                  <Tag color="green">{compatibleServers.length} {t('datasource.serversAvailable') || 'שרתים זמינים'}</Tag>
                </Space>
              }
              rules={[
                {
                  required: true,
                  message: t('datasource.errors.serverRequired') || 'חובה לבחור שרת'
                }
              ]}
              tooltip="בחר שרת שהוגדר על ידי מנהל המערכת"
            >
              <Select
                placeholder={
                  loadingServers
                    ? 'טוען שרתים...'
                    : `בחר שרת ${connectionType}...`
                }
                loading={loadingServers}
                disabled={loadingServers}
                allowClear
                showSearch
                optionFilterProp="children"
                notFoundContent={
                  loadingServers ? (
                    <Space>
                      <span role="status" aria-live="polite">
                        {t('datasource.loadingServers') || 'טוען שרתים...'}
                      </span>
                    </Space>
                  ) : (
                    t('datasource.noServersFound') || 'לא נמצאו שרתים'
                  )
                }
              >
                {compatibleServers.map((server: AdminServer) => (
                  <Option key={server.ID} value={server.ID}>
                    <Space>
                      {serverTypeIcons[server.ServerType?.toLowerCase() || 'local']}
                      {server.Name}
                      {server.Host && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          ({server.Host}{server.Port ? `:${server.Port}` : ''})
                        </Text>
                      )}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* Show server info when selected */}
          {selectedServer && (
            <Alert
              message={`שרת נבחר: ${selectedServer.Name}`}
              description={
                <Space direction="vertical" size={0}>
                  <Text>סוג: {selectedServer.ServerType?.toUpperCase()}</Text>
                  {selectedServer.Host && <Text>כתובת: {selectedServer.Host}:{selectedServer.Port}</Text>}
                  {selectedServer.BasePath && <Text>נתיב בסיס: {selectedServer.BasePath}</Text>}
                  {selectedServer.Description && <Text type="secondary">{selectedServer.Description}</Text>}
                </Space>
              }
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </>
      )}

      {/* Step 3: Applicative Fields - Only show when server selected */}
      {selectedServer && (
        <>
          {/* ========== FILE-BASED PROTOCOLS (Local, FTP, SFTP, S3, NFS) ========== */}
          {effectiveConnectionType !== 'kafka' && effectiveConnectionType !== 'http' && (
            <>
              <Divider>{t('datasource.sections.pathSettings') || 'הגדרות נתיב'}</Divider>

              <Form.Item
                name="filePath"
                label={effectiveConnectionType === 's3'
                  ? (t('datasource.fields.s3Bucket') || 'Bucket / Prefix')
                  : (t('datasource.fields.filePath') || 'נתיב (Path)')
                }
                tooltip="נתיב יחסי לנתיב הבסיס של השרת"
                rules={[{ required: true, message: t('errors.required') }]}
              >
                <Input
                  className="ltr-field"
                  placeholder={
                    effectiveConnectionType === 's3' ? 'bucket-name/prefix/' :
                    effectiveConnectionType === 'local' ? '/data/input/sales/' :
                    '/path/to/files/'
                  }
                />
              </Form.Item>

              <Form.Item
                name="filePattern"
                label={t('datasource.fields.filePattern') || 'תבנית קובץ (File Pattern)'}
                initialValue="*.*"
                rules={[
                  { required: true, message: t('errors.required') },
                  {
                    pattern: /^(\*\.[\w]+|\*\.\*|[\w-]+_\*\.[\w]+|[\w-]+\.[\w]+)$/,
                    message: 'תבנית לא תקינה. דוגמאות: *.csv, *.*, data_*.xml'
                  }
                ]}
                tooltip="תבנית לסינון קבצים. דוגמאות: *.csv (כל קבצי CSV), *.* (כל הקבצים)"
              >
                <Input className="ltr-field" placeholder="*.csv, *.json, data_*.xml, *.*" />
              </Form.Item>
            </>
          )}

          {/* ========== HTTP PROTOCOL ========== */}
          {effectiveConnectionType === 'http' && (
            <>
              <Divider>{t('datasource.sections.httpSettings') || 'הגדרות HTTP'}</Divider>

              <Form.Item
                name="httpEndpointPath"
                label="נתיב Endpoint"
                rules={[{ required: true, message: t('errors.required') }]}
                tooltip="נתיב יחסי ל-URL הבסיסי של השרת"
              >
                <Input className="ltr-field" placeholder="/data/files" />
              </Form.Item>
            </>
          )}

          {/* ========== KAFKA PROTOCOL ========== */}
          {effectiveConnectionType === 'kafka' && (
            <>
              <Divider>{t('datasource.sections.kafkaSettings') || 'הגדרות Kafka'}</Divider>

              <Form.Item
                name="kafkaTopic"
                label={t('datasource.fields.kafkaTopic') || 'Topic'}
                rules={[{ required: true, message: t('errors.required') }]}
                tooltip="שם ה-Topic לצריכת הודעות"
              >
                <Input className="ltr-field" placeholder="sales-events" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaConsumerGroup"
                    label={t('datasource.fields.kafkaConsumerGroup') || 'Consumer Group'}
                    tooltip="Consumer Group ID - אם ריק, ישתמש בברירת המחדל של השרת"
                  >
                    <Input className="ltr-field" placeholder="dataprocessing-sales" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaOffsetReset"
                    label={t('datasource.fields.kafkaOffsetReset') || 'Auto Offset Reset'}
                    tooltip="מאיפה להתחיל לקרוא כאשר אין offset שמור"
                    initialValue="latest"
                  >
                    <Select>
                      {KAFKA_OFFSET_RESET.map(opt => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </>
      )}

      {/* Archive Settings - Only for file-based protocols (not Kafka/HTTP) */}
      {selectedServer && effectiveConnectionType !== 'kafka' && effectiveConnectionType !== 'http' && (
        <ArchiveSettingsSection
          form={form}
          t={t}
          isArchiveSource={isArchiveSource || false}
        />
      )}

      {/* Connection Test Button */}
      <Form.Item style={{ marginTop: 16 }}>
        <Space>
          <Button
            type="default"
            icon={<ApiOutlined />}
            onClick={onTestConnection}
            loading={testingConnection}
            disabled={!selectedServer}
          >
            בדוק חיבור
          </Button>
          {connectionTestResult === 'success' && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              חיבור הצליח
            </Tag>
          )}
          {connectionTestResult === 'failed' && (
            <Tag icon={<CloseCircleOutlined />} color="error">
              חיבור נכשל
            </Tag>
          )}
        </Space>
      </Form.Item>
    </>
  );
};
