/**
 * ConnectionTab - Data Source Connection Configuration
 * v0.2.0: Added server selection support for admin-configured servers
 */
import React, { useMemo } from 'react';
import { Form, Input, Select, InputNumber, Button, Space, Alert, Row, Col, Tag, Divider, Typography } from 'antd';
import { FormInstance } from 'antd/es/form';
import { ApiOutlined, FileOutlined, CheckCircleOutlined, CloseCircleOutlined, CloudServerOutlined } from '@ant-design/icons';
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
  kafka: <ApiOutlined />,
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
    queryKey: serverQueryKeys.input(),
    queryFn: getInputServers,
  });

  // Watch for input server selection
  const inputServerId = Form.useWatch('inputServerId', form);

  // Get selected server details
  const selectedServer = useMemo(() => {
    if (!inputServerId || inputServerId === 'manual') return null;
    return inputServers.find((s: AdminServer) => s.ID === inputServerId) || null;
  }, [inputServerId, inputServers]);

  // Determine effective connection type (from server or manual selection)
  const effectiveConnectionType = selectedServer?.ServerType?.toLowerCase() || connectionType?.toLowerCase();

  return (
    <>
      <Alert
        message="הגדרות חיבור למקור הנתונים"
        description="בחר שרת קלט מהרשימה או הגדר חיבור ידני"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Server Selection - New in v0.2.0 */}
      <Form.Item
        name="inputServerId"
        label={
          <Space>
            <CloudServerOutlined />
            {t('datasource.fields.inputServer') || 'שרת קלט (Input Server)'}
          </Space>
        }
        tooltip="בחר שרת שהוגדר על ידי מנהל המערכת, או בחר הגדרה ידנית"
      >
        <Select
          placeholder="בחר שרת קלט..."
          loading={loadingServers}
          allowClear
          showSearch
          optionFilterProp="children"
          onChange={(value) => {
            // When server is selected, clear manual connection type
            if (value && value !== 'manual') {
              form.setFieldValue('connectionType', undefined);
            }
          }}
        >
          <Option value="manual">
            <Space>
              <ApiOutlined />
              <Text type="secondary">הגדרה ידנית (Manual Configuration)</Text>
            </Space>
          </Option>
          <Divider style={{ margin: '4px 0' }} />
          {inputServers
            .filter((server: AdminServer) => server.IsActive)
            .map((server: AdminServer) => (
              <Option key={server.ID} value={server.ID}>
                <Space>
                  {serverTypeIcons[server.ServerType?.toLowerCase() || 'local']}
                  {server.Name}
                  <Tag color="blue">{server.ServerType?.toUpperCase()}</Tag>
                  {server.Host && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {server.Host}
                    </Text>
                  )}
                </Space>
              </Option>
            ))}
        </Select>
      </Form.Item>

      {/* Show server info when selected */}
      {selectedServer && (
        <Alert
          message={`שרת נבחר: ${selectedServer.Name}`}
          description={
            <Space direction="vertical" size={0}>
              <Text>סוג: {selectedServer.ServerType?.toUpperCase()}</Text>
              {selectedServer.Host && <Text>כתובת: {selectedServer.Host}:{selectedServer.Port}</Text>}
              {selectedServer.Description && <Text type="secondary">{selectedServer.Description}</Text>}
            </Space>
          }
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Manual Connection Type - Only show when manual mode selected */}
      {(inputServerId === 'manual' || !inputServerId) && (
        <>
          <Divider>{t('datasource.sections.manualConfig') || 'הגדרת חיבור ידנית'}</Divider>

          <Form.Item
            name="connectionType"
            label="סוג החיבור"
            rules={[{ required: inputServerId === 'manual', message: t('errors.required') }]}
          >
            <Select placeholder="בחר סוג חיבור">
              <Option value="Local">
                <Space>
                  <FileOutlined />
                  Local - תיקייה מקומית
                </Space>
              </Option>
              <Option value="SFTP">
                <Space>
                  <ApiOutlined />
                  SFTP - Secure FTP
                </Space>
              </Option>
              <Option value="FTP">
                <Space>
                  <ApiOutlined />
                  FTP - File Transfer Protocol
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
                  <ApiOutlined />
                  Kafka - Message Queue
                </Space>
              </Option>
            </Select>
          </Form.Item>
        </>
      )}

      {/* ========== SERVER-BASED CONFIGURATION (v0.2.0) ========== */}
      {/* When a server is selected, show only applicative fields */}
      {selectedServer && effectiveConnectionType !== 'kafka' && (
        <>
          <Divider>{t('datasource.sections.pathSettings') || 'הגדרות נתיב'}</Divider>

          <Form.Item
            name="filePath"
            label={t('datasource.fields.filePath') || 'נתיב (Path)'}
            tooltip="נתיב יחסי לנתיב הבסיס של השרת"
            rules={[{ required: true, message: t('errors.required') }]}
          >
            <Input
              className="ltr-field"
              placeholder={selectedServer.ServerType?.toLowerCase() === 's3' ? 'bucket-name/prefix/' : '/data/input/'}
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
            <Input
              className="ltr-field"
              placeholder="*.csv, *.json, data_*.xml, *.*"
            />
          </Form.Item>
        </>
      )}

      {/* Kafka applicative fields when Kafka server selected */}
      {selectedServer && effectiveConnectionType === 'kafka' && (
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

          <Form.Item
            name="kafkaConsumerGroup"
            label={t('datasource.fields.kafkaConsumerGroup') || 'Consumer Group'}
            tooltip="Consumer Group ID - אם ריק, ישתמש בברירת המחדל של השרת"
          >
            <Input className="ltr-field" placeholder="dataprocessing-sales" />
          </Form.Item>

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
        </>
      )}

      {/* ========== MANUAL CONFIGURATION (Legacy) ========== */}
      {/* Show manual fields when no server selected or manual mode */}
      {(inputServerId === 'manual' || !inputServerId) && (
        <>
          {/* SFTP/FTP manual fields */}
          {(connectionType === 'SFTP' || connectionType === 'FTP') && (
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
                    initialValue={connectionType === 'SFTP' ? 22 : 21}
                  >
                    <InputNumber
                      min={1}
                      max={65535}
                      style={{ width: '100%' }}
                    />
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

              <Form.Item
                name="connectionPath"
                label="נתיב בשרת"
                rules={[{ required: true, message: t('errors.required') }]}
              >
                <Input className="ltr-field" placeholder="/path/to/files/" />
              </Form.Item>

              <Form.Item
                name="filePattern"
                label="תבנית קובץ (File Pattern)"
                initialValue="*.*"
                rules={[
                  { required: true, message: t('errors.required') },
                  {
                    pattern: /^(\*\.[\w]+|\*\.\*|[\w-]+_\*\.[\w]+|[\w-]+\.[\w]+)$/,
                    message: 'תבנית לא תקינה. דוגמאות: *.csv, *.*, data_*.xml'
                  }
                ]}
                tooltip="תבנית לסינון קבצים בתיקייה. דוגמאות: *.csv (כל קבצי CSV), *.* (כל הקבצים), data_*.xml"
              >
                <Input
                  className="ltr-field"
                  placeholder="*.csv, *.json, data_*.xml, *.*"
                />
              </Form.Item>
            </>
          )}

          {/* HTTP manual fields */}
          {connectionType === 'HTTP' && (
            <Form.Item
              name="connectionUrl"
              label="כתובת URL"
              rules={[
                { required: true, message: t('errors.required') },
                { type: 'url', message: t('errors.invalidUrl') }
              ]}
            >
              <Input className="ltr-field" placeholder="https://api.example.com/data/files" />
            </Form.Item>
          )}

          {/* Local manual fields */}
          {connectionType === 'Local' && (
            <>
              <Form.Item
                name="connectionPath"
                label="נתיב מקומי"
                rules={[{ required: true, message: t('errors.required') }]}
                tooltip="נתיב מלא לתיקייה במחשב או ברשת"
              >
                <Input className="ltr-field" placeholder="C:\Data\Files או \\server\share\files" />
              </Form.Item>

              <Form.Item
                name="filePattern"
                label="תבנית קובץ (File Pattern)"
                initialValue="*.*"
                rules={[
                  { required: true, message: t('errors.required') },
                  {
                    pattern: /^(\*\.[\w]+|\*\.\*|[\w-]+_\*\.[\w]+|[\w-]+\.[\w]+)$/,
                    message: 'תבנית לא תקינה. דוגמאות: *.csv, *.*, data_*.xml'
                  }
                ]}
                tooltip="תבנית לסינון קבצים בתיקייה. דוגמאות: *.csv (כל קבצי CSV), *.* (כל הקבצים), data_*.xml"
              >
                <Input
                  className="ltr-field"
                  placeholder="*.csv, *.json, data_*.xml, *.*"
                />
              </Form.Item>
            </>
          )}

          {/* Kafka manual fields */}
          {connectionType === 'Kafka' && (
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
                    name="kafkaTopic"
                    label="Topic Name"
                    rules={[{ required: true, message: t('errors.required') }]}
                    tooltip="שם ה-Topic ל-Consume ממנו"
                  >
                    <Input className="ltr-field" placeholder="data-events" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaConsumerGroup"
                    label="Consumer Group"
                    tooltip="Consumer Group ID (ייחודי לאפליקציה)"
                  >
                    <Input className="ltr-field" placeholder="ez-data-processor-group" />
                  </Form.Item>
                </Col>
              </Row>

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
                  <Form.Item
                    name="kafkaOffsetReset"
                    label="Auto Offset Reset"
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

              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaUsername"
                    label="Username (SASL)"
                    tooltip="נדרש רק עבור SASL authentication"
                  >
                    <Input placeholder="kafka-user" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaPassword"
                    label="Password (SASL)"
                    tooltip="נדרש רק עבור SASL authentication"
                  >
                    <Input.Password placeholder="kafka-password" />
                  </Form.Item>
                </Col>
              </Row>

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
            disabled={!effectiveConnectionType && !connectionType}
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
