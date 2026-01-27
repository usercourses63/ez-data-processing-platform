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
  Radio,
  Switch,
  Space,
  Card,
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
  FolderOutlined,
  ApiOutlined,
  GlobalOutlined,
  FileOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { OutputDestination } from '../shared/types';
import { getOutputServers, serverQueryKeys, AdminServer } from '../../../services/servers-api-client';

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Simple UUID generator for browser compatibility
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
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
  local: <FileOutlined />,
  ftp: <ApiOutlined />,
  sftp: <ApiOutlined />,
  s3: <CloudServerOutlined />,
  http: <ApiOutlined />,
  nfs: <FileOutlined />,
  kafka: <CloudServerOutlined />,
  folder: <FolderOutlined />,
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
  'Folder': 'folder',
};

export const DestinationEditorModal: React.FC<DestinationEditorModalProps> = ({
  visible,
  destination,
  onSave,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [destinationType, setDestinationType] = useState<string>(destination?.type || 'kafka');

  // Fetch available output servers
  const { data: outputServers = [], isLoading: loadingServers } = useQuery({
    queryKey: serverQueryKeys.list('output'),
    queryFn: getOutputServers,
  });

  // Watch form fields
  const outputServerId = Form.useWatch('outputServerId', form);

  // Filter servers based on selected protocol
  const compatibleServers = useMemo(() => {
    if (!destinationType) return [];
    const serverType = protocolToServerType[destinationType]?.toLowerCase() || destinationType.toLowerCase();

    return outputServers.filter((server: AdminServer) =>
      server.IsActive &&
      server.ServerType?.toLowerCase() === serverType
    );
  }, [destinationType, outputServers]);

  // Get selected server details
  const selectedServer = useMemo(() => {
    if (!outputServerId) return null;
    return outputServers.find((s: AdminServer) => s.ID === outputServerId) || null;
  }, [outputServerId, outputServers]);

  // Check if servers are available for the selected protocol
  const hasCompatibleServers = compatibleServers.length > 0;

  useEffect(() => {
    if (visible && destination) {
      form.setFieldsValue({
        name: destination.name,
        description: destination.description,
        type: destination.type,
        enabled: destination.enabled,
        outputFormat: destination.outputFormat,
        includeInvalidRecords: destination.includeInvalidRecords,
        outputServerId: destination.outputServerId,
        // Applicative fields
        path: destination.folderConfig?.path || destination.kafkaConfig?.topic,
        fileNamePattern: destination.folderConfig?.fileNamePattern,
        kafkaTopic: destination.kafkaConfig?.topic,
        kafkaMessageKey: destination.kafkaConfig?.messageKey,
      });
      setDestinationType(destination.type);
    } else if (visible && !destination) {
      // New destination
      form.resetFields();
      form.setFieldsValue({
        type: 'kafka',
        enabled: true,
        outputFormat: null,
        includeInvalidRecords: null
      });
      setDestinationType('kafka');
    }
  }, [visible, destination, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate server selection
      if (!values.outputServerId) {
        message.error('חובה לבחור שרת פלט');
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
      };

      // Add type-specific applicative configuration
      if (values.type === 'kafka') {
        updatedDestination.kafkaConfig = {
          topic: values.kafkaTopic,
          messageKey: values.kafkaMessageKey,
        };
      } else if (values.type === 'folder' || values.type === 'local' || values.type === 'nfs') {
        updatedDestination.folderConfig = {
          path: values.path,
          fileNamePattern: values.fileNamePattern,
        };
      } else if (values.type === 's3') {
        updatedDestination.folderConfig = {
          path: values.path, // S3 bucket/prefix
          fileNamePattern: values.fileNamePattern,
        };
      } else if (values.type === 'http') {
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
          description="בחר את סוג הפרוטוקול ושרת שהוגדר על ידי מנהל המערכת"
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
        {destinationType && (
          <>
            <Divider>בחירת שרת</Divider>

            {!hasCompatibleServers ? (
              <Alert
                message={`אין שרתי ${destinationType} זמינים`}
                description={
                  <Space direction="vertical" size="small">
                    <Text>פנה למנהל המערכת להוספת שרת מתאים</Text>
                    <Text type="secondary">
                      הגדרות מערכת → שרתי פלט
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
                    onClick={() => window.open('/admin/settings?tab=output', '_blank')}
                  >
                    עבור להגדרות מערכת
                  </Button>
                }
              />
            ) : (
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
            <Divider>הגדרות יעד</Divider>

            {/* FILE-BASED PROTOCOLS (Local, FTP, SFTP, S3, NFS) */}
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
