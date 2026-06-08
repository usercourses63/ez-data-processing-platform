/**
 * DestinationEditorModal.tsx - Multi-Destination Output Editor
 * v0.2.0: Server-based configuration with AdminServer integration
 * Updated: January 2026
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Button,
  Select,
  Typography,
  message,
  Divider,
  Alert,
  Tag
} from 'antd';
import {
  CloudServerOutlined,
  ApiOutlined,
  WarningOutlined,
  HddOutlined
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { OutputDestination } from '../shared/types';
import { buildS3OutputConfig, s3ConfigToPath } from '../shared/helpers';
import { getOutputServers, serverQueryKeys, AdminServer } from '../../../services/servers-api-client';
import { getNasDevices, nasDeviceQueryKeys, NasDevice, testNasDeviceConnection } from '../../../services/nas-devices-api-client';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Simple UUID generator for browser compatibility
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
};

interface DestinationEditorModalProps {
  visible: boolean;
  destination: OutputDestination | null;
  onSave: (destination: OutputDestination) => void;
  onCancel: () => void;
}

// Server type icons
const serverTypeIcons: Record<string, React.ReactNode> = {
  ftp: <ApiOutlined />,
  sftp: <ApiOutlined />,
  s3: <CloudServerOutlined />,
  http: <ApiOutlined />,
  nas: <HddOutlined />,
  kafka: <CloudServerOutlined />,
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

export const DestinationEditorModal: React.FC<DestinationEditorModalProps> = ({
  visible,
  destination,
  onSave,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [destinationType, setDestinationType] = useState<string>(destination?.type?.toUpperCase() || 'NAS');

  // Fetch available output servers (for non-NAS protocols)
  const { data: outputServers = [], isLoading: loadingServers } = useQuery({
    queryKey: serverQueryKeys.list('output'),
    queryFn: getOutputServers,
    enabled: destinationType !== 'NAS',
  });

  // Fetch NAS devices (for NAS protocol)
  const { data: nasDevices = [], isLoading: loadingNasDevices } = useQuery({
    queryKey: nasDeviceQueryKeys.list(),
    queryFn: () => getNasDevices(),
    enabled: destinationType === 'NAS',
  });

  // Auto-test NAS device connection on selection
  const { mutateAsync: testNasConnection, isPending: testingNasConnection } = useMutation({
    mutationFn: testNasDeviceConnection,
  });

  // Watch form fields
  const outputServerId = Form.useWatch('outputServerId', form);
  const nasDeviceId = Form.useWatch('nasDeviceId', form);

  // Filter servers based on selected protocol (for non-NAS protocols)
  const compatibleServers = useMemo(() => {
    if (!destinationType || destinationType === 'NAS') return [];
    const serverType = protocolToServerType[destinationType]?.toLowerCase() || destinationType.toLowerCase();

    return outputServers.filter((server: AdminServer) =>
      server.IsActive &&
      server.ServerType?.toLowerCase() === serverType
    );
  }, [destinationType, outputServers]);

  // Get selected server details (for non-NAS protocols)
  const selectedServer = useMemo(() => {
    if (!outputServerId || destinationType === 'NAS') return null;
    return outputServers.find((s: AdminServer) => s.ID === outputServerId) || null;
  }, [outputServerId, outputServers, destinationType]);

  // Filter NAS devices - show output-capable devices
  const availableNasDevices = useMemo(() => {
    if (destinationType !== 'NAS') return [];
    // Filter devices that can be output destinations (Output, Backup, or Both roles)
    // Backend returns Role as numeric enum (0=Input, 1=Output, 2=Backup, 3=Both)
    const roleEnumToString: Record<number, string> = { 0: 'Input', 1: 'Output', 2: 'Backup', 3: 'Both' };
    return nasDevices.filter((device: NasDevice) => {
      const role = typeof device.Role === 'number' ? roleEnumToString[device.Role] : device.Role;
      return role === 'Output' || role === 'Both' || role === 'Backup';
    });
  }, [destinationType, nasDevices]);

  // Get selected NAS device details
  const selectedNasDevice = useMemo(() => {
    if (!nasDeviceId || destinationType !== 'NAS') return null;
    return nasDevices.find((d: NasDevice) => d.ID === nasDeviceId) || null;
  }, [nasDeviceId, nasDevices, destinationType]);

  // Check if NAS device is mounted (provisioned)
  const isNasDeviceMounted = (device: NasDevice): boolean => {
    return device.IsPvCreated && device.IsPvcBound;
  };

  // Auto-test NAS device connection when selected
  const handleNasDeviceChange = async (deviceId: string) => {
    form.setFieldValue('nasDeviceId', deviceId);

    if (!deviceId) return;

    try {
      const result = await testNasConnection(deviceId);
      if (result.Success) {
        message.success('NAS device connection successful');
      } else {
        message.warning(result.ErrorMessage || 'NAS device connection failed');
      }
    } catch (error) {
      message.error('Error testing NAS connection');
    }
  };

  // Check if servers/devices are available for the selected protocol
  const hasCompatibleServers = destinationType === 'NAS'
    ? availableNasDevices.length > 0
    : compatibleServers.length > 0;

  useEffect(() => {
    if (visible && destination) {
      // For NAS destinations, the NAS device ID may be stored in outputServerId
      const nasId = destination.type?.toLowerCase() === 'nas'
        ? (destination.nasDeviceId || destination.outputServerId)
        : destination.nasDeviceId;
      form.setFieldsValue({
        name: destination.name,
        description: destination.description,
        type: destination.type,
        enabled: destination.enabled,
        outputFormat: destination.outputFormat,
        includeInvalidRecords: destination.includeInvalidRecords,
        outputServerId: destination.outputServerId,
        nasDeviceId: nasId,
        // Applicative fields
        path: destination.type?.toLowerCase() === 's3'
          ? s3ConfigToPath(destination.s3Config)
          : (destination.folderConfig?.path || destination.kafkaConfig?.topic),
        fileNamePattern: destination.type?.toLowerCase() === 's3'
          ? destination.s3Config?.keyPattern
          : destination.folderConfig?.fileNamePattern,
        kafkaTopic: destination.kafkaConfig?.topic,
        kafkaMessageKey: destination.kafkaConfig?.messageKey,
      });
      setDestinationType(destination.type?.toUpperCase() || 'NAS');
    } else if (visible && !destination) {
      // New destination - default to NAS
      form.resetFields();
      form.setFieldsValue({
        type: 'NAS',
        enabled: true,
        outputFormat: null,
        includeInvalidRecords: null
      });
      setDestinationType('NAS');
    }
  }, [visible, destination, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate server/device selection
      if (!values.outputServerId && !values.nasDeviceId) {
        message.error('חובה לבחור שרת פלט או התקן NAS');
        return;
      }

      // Build destination object with server-based configuration
      const updatedDestination: OutputDestination = {
        id: destination?.id || generateUUID(),
        name: values.name,
        description: values.description,
        type: values.type,
        enabled: values.enabled,
        outputFormat: values.outputFormat,
        includeInvalidRecords: values.includeInvalidRecords,
        outputServerId: values.outputServerId, // v0.2.0: Server reference
        nasDeviceId: values.nasDeviceId, // v0.2.0: NAS device reference
      };

      // Add type-specific applicative configuration.
      // G9 (Phase 35): the protocol <Select> emits UPPERCASE values ('S3', 'Kafka',
      // 'FTP', 'SFTP', 'HTTP', 'NAS'), but these branches previously compared against
      // lowercase literals — so for S3 (and kafka/ftp/sftp/http) the branch never matched
      // and s3Config was never built. The bucket/prefix the user typed was silently dropped
      // (the backend then fell back to the server bucket with a null keyPrefix). Compare on
      // a lowercased key so the correct config object is always constructed.
      const typeKey = (values.type || '').toLowerCase();
      if (typeKey === 'kafka') {
        updatedDestination.kafkaConfig = {
          topic: values.kafkaTopic,
          messageKey: values.kafkaMessageKey,
        };
      } else if (typeKey === 'ftp' || typeKey === 'sftp' || typeKey === 'nas') {
        updatedDestination.folderConfig = {
          path: values.path,
          fileNamePattern: values.fileNamePattern,
        };
      } else if (typeKey === 's3') {
        // Build a write-ready s3Config from the typed "Bucket / Prefix" path.
        // Credentials/endpoint/region are intentionally omitted here — the backend
        // bridges them (decrypted) from the selected output AdminServer (outputServerId).
        updatedDestination.s3Config = {
          ...buildS3OutputConfig(values.path),
          keyPattern: values.fileNamePattern || undefined,
        };
      } else if (typeKey === 'http') {
        updatedDestination.httpConfig = {
          url: values.path, // Endpoint path
          method: 'POST',
        };
      }

      onSave(updatedDestination);
      message.success('יעד הפלט נשמר בהצלחה');
    } catch (err) {
      console.error('Validation failed:', err);
    }
  };

  const effectiveDestinationType = destinationType?.toLowerCase();

  return (
    <Modal
      title={destination ? 'ערוך יעד פלט' : 'הוסף יעד פלט חדש'}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="שמור"
      cancelText="ביטול"
      width={800}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Alert
          message="הגדרות יעד פלט"
          description="הגדר יעד פלט לשליחת נתונים מעובדים. בחר פרוטוקול (תיקייה, FTP, SFTP, Kafka, NAS) ושרת פלט מתוך השרתים שהוגדרו במערכת."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Basic Information */}
        <Form.Item
          name="name"
          label="שם יעד הפלט"
          rules={[{ required: true, message: 'נא להזין שם ליעד' }]}
          tooltip="שם זיהוי ליעד הפלט"
        >
          <Input placeholder="למשל: Kafka Production, Output Folder" />
        </Form.Item>

        <Form.Item
          name="description"
          label="תיאור / הערות"
          tooltip="תיאור אופציונלי המסביר את מטרת יעד הפלט"
        >
          <TextArea
            rows={2}
            placeholder="תיאור קצר של יעד הפלט ותפקידו"
            maxLength={200}
            showCount
          />
        </Form.Item>

        {/* Step 1: Protocol Selection */}
        <Form.Item
          name="type"
          label="סוג פרוטוקול"
          rules={[{ required: true, message: 'נא לבחור סוג פרוטוקול' }]}
          tooltip="בחר את סוג החיבור למקור היעד"
        >
          <Select
            placeholder="בחר סוג פרוטוקול..."
            onChange={(value) => {
              setDestinationType(value);
              // Reset server selection when protocol changes
              form.setFieldsValue({ outputServerId: undefined });
            }}
          >
            <Option value="Kafka">
              <Space>
                <CloudServerOutlined />
                Kafka - Message Queue
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
            <Option value="S3">
              <Space>
                <CloudServerOutlined />
                S3 - Object Storage (MinIO)
              </Space>
            </Option>
            <Option value="NAS">
              <Space>
                <HddOutlined />
                NAS - Network Attached Storage
              </Space>
            </Option>
          </Select>
        </Form.Item>

        {/* Step 2: Server/Device Selection - Only show after protocol selected */}
        {destinationType && (
          <>
            <Divider>
              {destinationType === 'NAS' ? 'בחירת התקן NAS' : 'בחירת שרת'}
            </Divider>

            {!hasCompatibleServers ? (
              <Alert
                message={destinationType === 'NAS'
                  ? 'אין התקני NAS לפלט זמינים'
                  : `אין שרתי ${destinationType} זמינים`
                }
                description={
                  <Space direction="vertical" size="small">
                    <Text>פנה למנהל המערכת להוספת שרת מתאים</Text>
                    <Text type="secondary">
                      הגדרות מערכת → {destinationType === 'NAS' ? 'התקני NAS' : 'שרתי פלט'}
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
                    onClick={() => window.open(
                      destinationType === 'NAS'
                        ? '/admin/settings?tab=nasDevices'
                        : '/admin/settings?tab=outputServers',
                      '_blank'
                    )}
                  >
                    עבור להגדרות מערכת
                  </Button>
                }
              />
            ) : destinationType === 'NAS' ? (
              /* NAS Device Selection */
              <Form.Item
                name="nasDeviceId"
                label={
                  <Space>
                    <HddOutlined />
                    התקן NAS
                    <Tag color="blue">
                      {availableNasDevices.filter(d => isNasDeviceMounted(d)).length} התקנים זמינים
                    </Tag>
                  </Space>
                }
                rules={[
                  {
                    required: true,
                    message: 'חובה לבחור התקן NAS'
                  }
                ]}
                tooltip="בחר התקן NAS שהוגדר על ידי מנהל המערכת"
              >
                <Select
                  placeholder={
                    loadingNasDevices
                      ? 'טוען התקני NAS...'
                      : 'בחר התקן NAS לפלט...'
                  }
                  loading={loadingNasDevices || testingNasConnection}
                  disabled={loadingNasDevices}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  onChange={handleNasDeviceChange}
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
                              לא מחובר
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
                name="outputServerId"
                label={
                  <Space>
                    <CloudServerOutlined />
                    שרת פלט
                    <Tag color="green">{compatibleServers.length} שרתים זמינים</Tag>
                  </Space>
                }
                rules={[
                  {
                    required: true,
                    message: 'חובה לבחור שרת'
                  }
                ]}
                tooltip="בחר שרת שהוגדר על ידי מנהל המערכת"
              >
                <Select
                  placeholder={
                    loadingServers
                      ? 'טוען שרתים...'
                      : `בחר שרת ${destinationType}...`
                  }
                  loading={loadingServers}
                  disabled={loadingServers}
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

            {/* Show server info when selected (non-NAS) */}
            {selectedServer && destinationType !== 'NAS' && (
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
            {selectedNasDevice && destinationType === 'NAS' && (
              <Alert
                message={`התקן NAS נבחר: ${selectedNasDevice.Name}`}
                description={
                  <Space direction="vertical" size={0}>
                    <Text>שרת: {selectedNasDevice.Host}:{selectedNasDevice.Port}</Text>
                    <Text>נתיב ייצוא: {selectedNasDevice.ExportPath}</Text>
                    <Text>
                      נתיב Mount:{' '}
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
            <Divider>הגדרות יעד</Divider>

            {/* FILE-BASED PROTOCOLS (Local, FTP, SFTP, S3, NAS) */}
            {effectiveDestinationType !== 'kafka' && effectiveDestinationType !== 'http' && (
              <>
                <Form.Item
                  name="path"
                  label={effectiveDestinationType === 's3'
                    ? 'Bucket / Prefix'
                    : 'נתיב (Path)'
                  }
                  tooltip="נתיב יחסי לנתיב הבסיס של השרת"
                  rules={[{ required: true, message: 'נא להזין נתיב' }]}
                >
                  <Input
                    className="ltr-field"
                    placeholder={
                      effectiveDestinationType === 's3' ? 'bucket-name/output/' :
                      effectiveDestinationType === 'local' ? '/data/output/processed/' :
                      '/path/to/output/'
                    }
                  />
                </Form.Item>

                <Form.Item
                  name="fileNamePattern"
                  label="תבנית שם קובץ (File Name Pattern)"
                  initialValue="output_{timestamp}.{format}"
                  tooltip="תבנית לשמות הקבצים. משתנים: {timestamp}, {format}, {datasource}"
                >
                  <Input
                    className="ltr-field"
                    placeholder="output_{timestamp}.{format}"
                  />
                </Form.Item>
              </>
            )}

            {/* HTTP PROTOCOL */}
            {effectiveDestinationType === 'http' && (
              <Form.Item
                name="path"
                label="נתיב Endpoint"
                rules={[{ required: true, message: 'נא להזין נתיב endpoint' }]}
                tooltip="נתיב יחסי ל-URL הבסיסי של השרת"
              >
                <Input className="ltr-field" placeholder="/api/data/processed" />
              </Form.Item>
            )}

            {/* KAFKA PROTOCOL */}
            {effectiveDestinationType === 'kafka' && (
              <>
                <Form.Item
                  name="kafkaTopic"
                  label="Topic"
                  rules={[{ required: true, message: 'נא להזין topic' }]}
                  tooltip="שם ה-Topic לפרסום הודעות"
                >
                  <Input className="ltr-field" placeholder="processed-data" />
                </Form.Item>

                <Form.Item
                  name="kafkaMessageKey"
                  label="Message Key (אופציונלי)"
                  tooltip="מפתח להודעות Kafka לחלוקת partitions"
                >
                  <Input className="ltr-field" placeholder="datasource-id" />
                </Form.Item>
              </>
            )}

            <Divider>הגדרות פורמט</Divider>

            <Form.Item
              name="outputFormat"
              label="פורמט פלט"
              tooltip="פורמט הפלט. null = ברירת מחדל גלובלית"
            >
              <Select allowClear placeholder="ברירת מחדל גלובלית">
                <Option value="original">פורמט מקורי</Option>
                <Option value="json">JSON</Option>
                <Option value="csv">CSV</Option>
                <Option value="xml">XML</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="includeInvalidRecords"
              label="כולל רשומות שגויות"
              tooltip="האם לכלול רשומות שלא עברו אימות. null = ברירת מחדל גלובלית"
            >
              <Select allowClear placeholder="ברירת מחדל גלובלית">
                <Option value={true}>כן</Option>
                <Option value={false}>לא</Option>
              </Select>
            </Form.Item>

            <Form.Item name="enabled" valuePropName="checked" initialValue={true}>
              <Space>
                <Switch defaultChecked />
                <Text>מופעל</Text>
              </Space>
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};
