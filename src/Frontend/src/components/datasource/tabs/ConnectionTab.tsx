/**
 * ConnectionTab - Data Source Connection Configuration
 * v0.2.0: Server-based configuration ONLY (no manual mode)
 *
 * Flow:
 * 1. Select connection protocol (FTP, SFTP, HTTP, Kafka, S3, NAS)
 * 2. Select from compatible servers (configured by admin)
 * 3. Enter applicative settings (path, pattern, topic, etc.)
 */
import React, { useMemo, useEffect } from 'react';
import { Form, Input, Select, Button, Space, Alert, Row, Col, Tag, Divider, Typography } from 'antd';
import { FormInstance } from 'antd/es/form';
import { ApiOutlined, FileOutlined, CheckCircleOutlined, CloseCircleOutlined, CloudServerOutlined, DatabaseOutlined, WarningOutlined, HddOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { KAFKA_OFFSET_RESET } from '../shared/constants';
import { getInputServers, serverQueryKeys, AdminServer } from '../../../services/servers-api-client';
import { getNasDevices, nasDeviceQueryKeys, NasDevice } from '../../../services/nas-devices-api-client';
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
  nas: <HddOutlined />,
  kafka: <DatabaseOutlined />,
};

// Protocol to server type mapping (NAS replaces NFS - NFS is internal to NAS)
const protocolToServerType: Record<string, string> = {
  'FTP': 'ftp',
  'SFTP': 'sftp',
  'HTTP': 'http',
  'Kafka': 'kafka',
  'S3': 's3',
  'NAS': 'nas',
};

export const ConnectionTab: React.FC<ConnectionTabProps> = ({
  form,
  t,
  connectionType,
  testingConnection,
  connectionTestResult,
  onTestConnection
}) => {
  // Fetch available input servers (for non-NAS protocols)
  const { data: inputServers = [], isLoading: loadingServers } = useQuery({
    queryKey: serverQueryKeys.list('input'),
    queryFn: getInputServers,
    enabled: connectionType !== 'NAS',
  });

  // Fetch NAS devices (for NAS protocol)
  const { data: nasDevices = [], isLoading: loadingNasDevices } = useQuery({
    queryKey: nasDeviceQueryKeys.list(),
    queryFn: () => getNasDevices(),
    enabled: connectionType === 'NAS',
  });

  // Watch form fields
  const inputServerId = Form.useWatch('inputServerId', form);
  const nasDeviceId = Form.useWatch('nasDeviceId', form);
  const isArchiveSource = Form.useWatch('isArchiveSource', form);

  // Filter servers based on selected protocol (for non-NAS protocols)
  const compatibleServers = useMemo(() => {
    if (!connectionType || connectionType === 'NAS') return [];
    const serverType = protocolToServerType[connectionType]?.toLowerCase();
    if (!serverType) return [];

    return inputServers.filter((server: AdminServer) =>
      server.IsActive &&
      server.ServerType?.toLowerCase() === serverType
    );
  }, [connectionType, inputServers]);

  // Get selected server details (for non-NAS protocols)
  const selectedServer = useMemo(() => {
    if (!inputServerId || connectionType === 'NAS') return null;
    return inputServers.find((s: AdminServer) => s.ID === inputServerId) || null;
  }, [inputServerId, inputServers, connectionType]);

  // Filter NAS devices - show mounted devices as enabled, unmounted as disabled
  const availableNasDevices = useMemo(() => {
    if (connectionType !== 'NAS') return [];
    // Filter devices that can be input sources (Input or Both roles)
    return nasDevices.filter((device: NasDevice) =>
      device.Role === 'Input' || device.Role === 'Both'
    );
  }, [connectionType, nasDevices]);

  // Get selected NAS device details
  const selectedNasDevice = useMemo(() => {
    if (!nasDeviceId || connectionType !== 'NAS') return null;
    return nasDevices.find((d: NasDevice) => d.ID === nasDeviceId) || null;
  }, [nasDeviceId, nasDevices, connectionType]);

  // Check if NAS device is mounted (provisioned)
  const isNasDeviceMounted = (device: NasDevice): boolean => {
    return device.IsPvCreated && device.IsPvcBound;
  };

  // Check if servers are available for the selected protocol
  const hasCompatibleServers = connectionType === 'NAS'
    ? availableNasDevices.length > 0
    : compatibleServers.length > 0;

  // Effective connection type (normalized to lowercase)
  const effectiveConnectionType = connectionType?.toLowerCase();

  // Clear dependent fields when protocol changes
  useEffect(() => {
    if (connectionType !== 'NAS') {
      // Clear NAS-specific fields when switching away from NAS
      form.setFieldsValue({
        nasDeviceId: undefined,
        nasExportPath: undefined,
        nasSubPath: undefined,
      });
    } else {
      // Clear server-specific fields when switching to NAS
      form.setFieldsValue({
        inputServerId: undefined,
      });
    }
  }, [connectionType, form]);

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
            {t('datasources.fields.connectionType') || 'סוג פרוטוקול'}
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
          <Option value="NAS">
            <Space>
              <HddOutlined />
              {t('datasources.protocols.nas') || 'NAS - Network Attached Storage'}
            </Space>
          </Option>
        </Select>
      </Form.Item>

      {/* Step 2: Server/Device Selection - Only show after protocol selected */}
      {connectionType && (
        <>
          <Divider>
            {connectionType === 'NAS'
              ? (t('datasources.sections.nasDeviceSelection') || 'בחירת התקן NAS')
              : (t('datasources.sections.serverSelection') || 'בחירת שרת')
            }
          </Divider>

          {!hasCompatibleServers ? (
            <Alert
              message={connectionType === 'NAS'
                ? (t('datasources.noNasDevices') || 'אין התקני NAS זמינים')
                : `אין שרתי ${connectionType} זמינים`
              }
              description={
                <Space direction="vertical" size="small">
                  <Text>{t('datasources.noServersHint') || 'פנה למנהל המערכת להוספת שרת מתאים'}</Text>
                  <Text type="secondary">
                    {t('navigation.adminSettings') || 'הגדרות מערכת'} → {connectionType === 'NAS'
                      ? (t('admin.tabs.nasDevices') || 'התקני NAS')
                      : (t('admin.tabs.inputServers') || 'שרתי קלט')
                    }
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
                  {t('datasources.goToAdminSettings') || 'עבור להגדרות מערכת'}
                </Button>
              }
            />
          ) : connectionType === 'NAS' ? (
            /* NAS Device Selection */
            <Form.Item
              name="nasDeviceId"
              label={
                <Space>
                  <HddOutlined />
                  {t('datasources.fields.nasDevice') || 'התקן NAS'}
                  <Tag color="blue">
                    {availableNasDevices.filter(d => isNasDeviceMounted(d)).length} {t('datasources.devicesAvailable') || 'התקנים זמינים'}
                  </Tag>
                </Space>
              }
              rules={[
                {
                  required: true,
                  message: t('datasources.errors.nasDeviceRequired') || 'חובה לבחור התקן NAS'
                }
              ]}
              tooltip={t('datasources.tooltips.nasDevice') || 'בחר התקן NAS שהוגדר על ידי מנהל המערכת'}
            >
              <Select
                placeholder={
                  loadingNasDevices
                    ? (t('datasources.loadingNasDevices') || 'טוען התקני NAS...')
                    : (t('datasources.selectNasDevice') || 'בחר התקן NAS...')
                }
                loading={loadingNasDevices}
                disabled={loadingNasDevices}
                allowClear
                showSearch
                optionFilterProp="children"
                notFoundContent={
                  loadingNasDevices ? (
                    <Space>
                      <span role="status" aria-live="polite">
                        {t('datasources.loadingNasDevices') || 'טוען התקני NAS...'}
                      </span>
                    </Space>
                  ) : (
                    t('datasources.noNasDevicesFound') || 'לא נמצאו התקני NAS'
                  )
                }
              >
                {availableNasDevices.map((device: NasDevice) => {
                  const isMounted = isNasDeviceMounted(device);
                  return (
                    <Option
                      key={device.ID}
                      value={device.ID}
                      disabled={!isMounted}
                    >
                      <Space>
                        <HddOutlined style={{ color: isMounted ? '#52c41a' : '#faad14' }} />
                        {device.Name}
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          ({device.Host}:{device.Port})
                        </Text>
                        {!isMounted && (
                          <Tag color="warning" style={{ marginLeft: 8 }}>
                            {t('datasources.nasNotMounted') || 'לא מחובר'}
                          </Tag>
                        )}
                      </Space>
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>
          ) : (
            /* Standard Server Selection (non-NAS protocols) */
            <Form.Item
              name="inputServerId"
              label={
                <Space>
                  <CloudServerOutlined />
                  {t('datasources.fields.inputServer') || 'שרת קלט'}
                  <Tag color="green">{compatibleServers.length} {t('datasources.serversAvailable') || 'שרתים זמינים'}</Tag>
                </Space>
              }
              rules={[
                {
                  required: true,
                  message: t('datasources.errors.serverRequired') || 'חובה לבחור שרת'
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
                        {t('datasources.loadingServers') || 'טוען שרתים...'}
                      </span>
                    </Space>
                  ) : (
                    t('datasources.noServersFound') || 'לא נמצאו שרתים'
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

          {/* Show server info when selected (non-NAS) */}
          {selectedServer && connectionType !== 'NAS' && (
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

          {/* Show NAS device info when selected */}
          {selectedNasDevice && connectionType === 'NAS' && (
            <Alert
              message={`${t('datasources.nasDeviceSelected') || 'התקן NAS נבחר'}: ${selectedNasDevice.Name}`}
              description={
                <Space direction="vertical" size={0}>
                  <Text>{t('admin.nas.fields.host') || 'שרת'}: {selectedNasDevice.Host}:{selectedNasDevice.Port}</Text>
                  <Text>{t('admin.nas.fields.exportPath') || 'נתיב ייצוא'}: {selectedNasDevice.ExportPath}</Text>
                  <Text>
                    {t('datasources.nasMountPath') || 'נתיב Mount'}:{' '}
                    <Text code className="ltr-field">/mnt/nfs/{selectedNasDevice.Name.toLowerCase().replace(/\s+/g, '-')}{selectedNasDevice.ExportPath}</Text>
                  </Text>
                  {selectedNasDevice.Description && <Text type="secondary">{selectedNasDevice.Description}</Text>}
                </Space>
              }
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </>
      )}

      {/* Step 3: Applicative Fields - Only show when server/device selected */}
      {(selectedServer || selectedNasDevice) && (
        <>
          {/* ========== NAS PROTOCOL - Path within export ========== */}
          {effectiveConnectionType === 'nas' && selectedNasDevice && (
            <>
              <Divider>{t('datasources.sections.nasPathSettings') || 'הגדרות נתיב NAS'}</Divider>

              <Form.Item
                name="nasSubPath"
                label={t('datasources.fields.nasSubPath') || 'נתיב משנה בתוך הייצוא'}
                tooltip={t('datasources.tooltips.nasSubPath') || 'נתיב יחסי בתוך נתיב הייצוא של ה-NAS'}
                rules={[{ required: false }]}
              >
                <Input
                  className="ltr-field"
                  placeholder="/sales/daily/"
                  addonBefore={
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {selectedNasDevice.ExportPath}
                    </Text>
                  }
                />
              </Form.Item>

              <Form.Item
                name="filePattern"
                label={t('datasources.fields.filePattern') || 'תבנית קובץ (File Pattern)'}
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

              {/* Display computed full mount path */}
              <Alert
                message={t('datasources.computedMountPath') || 'נתיב Mount מלא'}
                description={
                  <Text code className="ltr-field">
                    /mnt/nfs/{selectedNasDevice.Name.toLowerCase().replace(/\s+/g, '-')}{selectedNasDevice.ExportPath}
                    {form.getFieldValue('nasSubPath') || ''}
                  </Text>
                }
                type="info"
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          {/* ========== FILE-BASED PROTOCOLS (FTP, SFTP, S3) - NOT NAS ========== */}
          {effectiveConnectionType !== 'kafka' && effectiveConnectionType !== 'http' && effectiveConnectionType !== 'nas' && (
            <>
              <Divider>{t('datasources.sections.pathSettings') || 'הגדרות נתיב'}</Divider>

              <Form.Item
                name="filePath"
                label={effectiveConnectionType === 's3'
                  ? (t('datasources.fields.s3Bucket') || 'Bucket / Prefix')
                  : (t('datasources.fields.filePath') || 'נתיב (Path)')
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
                label={t('datasources.fields.filePattern') || 'תבנית קובץ (File Pattern)'}
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
              <Divider>{t('datasources.sections.httpSettings') || 'הגדרות HTTP'}</Divider>

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
              <Divider>{t('datasources.sections.kafkaSettings') || 'הגדרות Kafka'}</Divider>

              <Form.Item
                name="kafkaTopic"
                label={t('datasources.fields.kafkaTopic') || 'Topic'}
                rules={[{ required: true, message: t('errors.required') }]}
                tooltip="שם ה-Topic לצריכת הודעות"
              >
                <Input className="ltr-field" placeholder="sales-events" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaConsumerGroup"
                    label={t('datasources.fields.kafkaConsumerGroup') || 'Consumer Group'}
                    tooltip="Consumer Group ID - אם ריק, ישתמש בברירת המחדל של השרת"
                  >
                    <Input className="ltr-field" placeholder="dataprocessing-sales" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="kafkaOffsetReset"
                    label={t('datasources.fields.kafkaOffsetReset') || 'Auto Offset Reset'}
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

      {/* Archive Settings - Only for file-based protocols (not Kafka/HTTP), including NAS */}
      {(selectedServer || selectedNasDevice) && effectiveConnectionType !== 'kafka' && effectiveConnectionType !== 'http' && (
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
            disabled={!selectedServer && !selectedNasDevice}
          >
            {t('datasources.form.testConnection') || 'בדוק חיבור'}
          </Button>
          {connectionTestResult === 'success' && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              {t('datasources.form.connectionSuccess') || 'חיבור הצליח'}
            </Tag>
          )}
          {connectionTestResult === 'failed' && (
            <Tag icon={<CloseCircleOutlined />} color="error">
              {t('datasources.form.connectionFailed') || 'חיבור נכשל'}
            </Tag>
          )}
        </Space>
      </Form.Item>
    </>
  );
};
