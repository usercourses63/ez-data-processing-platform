/**
 * ConnectionTab - Data Source Connection Configuration
 * v0.2.0: Added server selection support for admin-configured servers
 *
 * Flow:
 * 1. Select connection protocol (Local, FTP, SFTP, HTTP, Kafka, S3, NFS)
 * 2. Select from compatible servers OR configure manually
 * 3. Enter applicative settings (path, pattern, topic, etc.)
 */
import React, { useMemo } from 'react';
import { Form, Input, Select, InputNumber, Button, Space, Alert, Row, Col, Tag, Divider, Typography, Radio } from 'antd';
import { FormInstance } from 'antd/es/form';
import { ApiOutlined, FileOutlined, CheckCircleOutlined, CloseCircleOutlined, CloudServerOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { KAFKA_SECURITY_PROTOCOLS, KAFKA_OFFSET_RESET } from '../shared/constants';
import { getInputServers, serverQueryKeys, AdminServer } from '../../../services/servers-api-client';

const { Option } = Select;
const { TextArea } = Input;
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
  local: <FileOutlined />,
  ftp: <ApiOutlined />,
  sftp: <ApiOutlined />,
  s3: <CloudServerOutlined />,
  http: <ApiOutlined />,
  nfs: <FileOutlined />,
  kafka: <DatabaseOutlined />,
  folder: <FileOutlined />,
};

// Protocol to server type mapping
const protocolToServerType: Record<string, string> = {
  'Local': 'local',
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
  const configMode = Form.useWatch('configMode', form);
  const inputServerId = Form.useWatch('inputServerId', form);

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
    if (!inputServerId || configMode !== 'server') return null;
    return inputServers.find((s: AdminServer) => s.ID === inputServerId) || null;
  }, [inputServerId, inputServers, configMode]);

  // Check if servers are available for the selected protocol
  const hasCompatibleServers = compatibleServers.length > 0;

  // Effective connection type (normalized to lowercase)
  const effectiveConnectionType = connectionType?.toLowerCase();

  return (
    <>
      <Alert
        message="הגדרות חיבור למקור הנתונים"
        description="בחר את סוג הפרוטוקול, ולאחר מכן בחר שרת מוגדר או הגדר חיבור ידני"
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
            form.setFieldsValue({
              inputServerId: undefined,
              configMode: undefined
            });
          }}
        >
          <Option value="Local">
            <Space>
              <FileOutlined />
              Local - תיקייה מקומית
            </Space>
          </Option>
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

      {/* Step 2: Configuration Mode (Server vs Manual) - Only show after protocol selected */}
      {connectionType && (
        <>
          <Divider>{t('datasource.sections.configMode') || 'מצב הגדרה'}</Divider>

          <Form.Item
            name="configMode"
            label={t('datasource.fields.configMode') || 'אופן הגדרה'}
            rules={[{ required: true, message: t('errors.required') }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="server" disabled={!hasCompatibleServers}>
                  <Space>
                    <CloudServerOutlined />
                    בחר שרת מוגדר
                    {hasCompatibleServers ? (
                      <Tag color="green">{compatibleServers.length} שרתים זמינים</Tag>
                    ) : (
                      <Tag color="orange">אין שרתי {connectionType} מוגדרים</Tag>
                    )}
                  </Space>
                </Radio>
                <Radio value="manual">
                  <Space>
                    <SettingOutlined />
                    הגדרה ידנית
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* Server Selection - Only show when server mode and protocol has compatible servers */}
          {configMode === 'server' && hasCompatibleServers && (
            <Form.Item
              name="inputServerId"
              label={
                <Space>
                  <CloudServerOutlined />
                  {t('datasource.fields.inputServer') || 'שרת קלט'}
                </Space>
              }
              rules={[{ required: configMode === 'server', message: t('errors.required') }]}
              tooltip="בחר שרת שהוגדר על ידי מנהל המערכת"
            >
              <Select
                placeholder={`בחר שרת ${connectionType}...`}
                loading={loadingServers}
                allowClear
                showSearch
                optionFilterProp="children"
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

      {/* Step 3: Applicative Fields - Based on protocol type */}
      {connectionType && configMode && (
        <>
          {/* ========== FILE-BASED PROTOCOLS (Local, FTP, SFTP, S3, NFS) ========== */}
          {effectiveConnectionType !== 'kafka' && effectiveConnectionType !== 'http' && (
            <>
              <Divider>{t('datasource.sections.pathSettings') || 'הגדרות נתיב'}</Divider>

              {/* Manual connection fields */}
              {configMode === 'manual' && (effectiveConnectionType === 'ftp' || effectiveConnectionType === 'sftp') && (
                <>
                  <Row gutter={16}>
                    <Col xs={24} lg={16}>
                      <Form.Item
                        name="connectionHost"
                        label="שרת (Host)"
                        rules={[{ required: true, message: t('errors.required') }]}
                      >
                        <Input className="ltr-field" placeholder="לדוגמה: ftp.example.com" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item
                        name="connectionPort"
                        label="פורט"
                        initialValue={effectiveConnectionType === 'sftp' ? 22 : 21}
                      >
                        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item
                        name="connectionUsername"
                        label="שם משתמש"
                        rules={[{ required: true, message: t('errors.required') }]}
                      >
                        <Input placeholder="שם משתמש לחיבור" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item
                        name="connectionPassword"
                        label="סיסמה"
                        rules={[{ required: true, message: t('errors.required') }]}
                      >
                        <Input.Password placeholder="סיסמה לחיבור" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              {/* S3 manual fields */}
              {configMode === 'manual' && effectiveConnectionType === 's3' && (
                <>
                  <Form.Item
                    name="s3Endpoint"
                    label="S3 Endpoint"
                    rules={[{ required: true, message: t('errors.required') }]}
                  >
                    <Input className="ltr-field" placeholder="https://s3.amazonaws.com או http://minio:9000" />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item
                        name="s3AccessKey"
                        label="Access Key"
                        rules={[{ required: true, message: t('errors.required') }]}
                      >
                        <Input className="ltr-field" placeholder="AKIAIOSFODNN7EXAMPLE" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item
                        name="s3SecretKey"
                        label="Secret Key"
                        rules={[{ required: true, message: t('errors.required') }]}
                      >
                        <Input.Password className="ltr-field" placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="s3Region" label="Region">
                    <Input className="ltr-field" placeholder="us-east-1" />
                  </Form.Item>
                </>
              )}

              {/* Path and file pattern - common to all file protocols */}
              <Form.Item
                name={configMode === 'manual' ? 'connectionPath' : 'filePath'}
                label={effectiveConnectionType === 's3'
                  ? (t('datasource.fields.s3Bucket') || 'Bucket / Prefix')
                  : (t('datasource.fields.filePath') || 'נתיב (Path)')
                }
                tooltip={configMode === 'server' ? 'נתיב יחסי לנתיב הבסיס של השרת' : 'נתיב מלא לתיקייה'}
                rules={[{ required: true, message: t('errors.required') }]}
              >
                <Input
                  className="ltr-field"
                  placeholder={
                    effectiveConnectionType === 's3' ? 'bucket-name/prefix/' :
                    effectiveConnectionType === 'local' ? 'C:\\Data\\Files או /data/input/' :
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

              {configMode === 'manual' && (
                <>
                  <Form.Item
                    name="connectionUrl"
                    label="כתובת URL בסיסית"
                    rules={[
                      { required: true, message: t('errors.required') },
                      { type: 'url', message: t('errors.invalidUrl') }
                    ]}
                  >
                    <Input className="ltr-field" placeholder="https://api.example.com" />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item name="httpAuthType" label="סוג אימות" initialValue="none">
                        <Select>
                          <Option value="none">ללא אימות</Option>
                          <Option value="basic">Basic Auth</Option>
                          <Option value="bearer">Bearer Token</Option>
                          <Option value="apikey">API Key</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item name="httpAuthCredential" label="אימות (Token/Key)">
                        <Input.Password className="ltr-field" placeholder="Token או API Key" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}

              <Form.Item
                name="httpEndpointPath"
                label="נתיב Endpoint"
                rules={[{ required: true, message: t('errors.required') }]}
              >
                <Input className="ltr-field" placeholder="/data/files" />
              </Form.Item>
            </>
          )}

          {/* ========== KAFKA PROTOCOL ========== */}
          {effectiveConnectionType === 'kafka' && (
            <>
              <Divider>{t('datasource.sections.kafkaSettings') || 'הגדרות Kafka'}</Divider>

              {configMode === 'manual' && (
                <>
                  <Form.Item
                    name="kafkaBrokers"
                    label="Kafka Brokers"
                    rules={[{ required: true, message: t('errors.required') }]}
                    tooltip="רשימת Kafka brokers (מופרדים בפסיקים)"
                  >
                    <TextArea
                      className="ltr-field"
                      rows={2}
                      placeholder="localhost:9092,broker2:9092,broker3:9092"
                    />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item
                        name="kafkaSecurityProtocol"
                        label="Security Protocol"
                        initialValue="PLAINTEXT"
                      >
                        <Select>
                          {KAFKA_SECURITY_PROTOCOLS.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item name="kafkaUsername" label="Username (SASL)">
                        <Input placeholder="kafka-user" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="kafkaPassword" label="Password (SASL)">
                    <Input.Password placeholder="kafka-password" />
                  </Form.Item>
                </>
              )}

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
                    tooltip="Consumer Group ID - אם ריק, ישתמש בברירת המחדל"
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

              {configMode === 'manual' && (
                <Alert
                  message="הגדרות Kafka מתקדמות"
                  description={
                    <ul style={{ margin: 0, paddingRight: 20 }}>
                      <li>Brokers: רשימת כתובות Kafka brokers (host:port)</li>
                      <li>Topic: שם ה-Topic לצריכת הודעות</li>
                      <li>Consumer Group: מזהה ייחודי למעקב אחר offset</li>
                      <li>Security: PLAINTEXT למערכות מקומיות, SSL/SASL לפרודקשן</li>
                    </ul>
                  }
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Connection Test Button */}
      <Form.Item style={{ marginTop: 16 }}>
        <Space>
          <Button
            type="default"
            icon={<ApiOutlined />}
            onClick={onTestConnection}
            loading={testingConnection}
            disabled={!connectionType || !configMode}
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
