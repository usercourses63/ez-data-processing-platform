/**
 * Server Modal Component for Creating/Editing Servers
 * v0.2.0: External File Access Support
 */
import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Divider,
  message,
  Space,
  Typography,
} from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminServer, CreateServerRequest, UpdateServerRequest, ServerDirection } from '../../../services/servers-api-client';
import { createServer, updateServer, getServerTypes, serverQueryKeys } from '../../../services/servers-api-client';

const { Option } = Select;
const { TextArea } = Input;

/**
 * Sentinel the API returns in place of a real SecretKey (write-only field, see 34-02).
 * If the admin leaves the Secret Key field as this value on edit, it is sent back
 * unchanged and the backend keep-existing logic retains the stored secret.
 */
const MASKED_SECRET_SENTINEL = '********';

interface ServerModalProps {
  visible: boolean;
  server: AdminServer | null;
  defaultDirection?: ServerDirection;
  onClose: () => void;
  onSuccess: () => void;
}

const ServerModal: React.FC<ServerModalProps> = ({
  visible,
  server,
  defaultDirection,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditing = !!server;

  // Fetch server types
  const { data: serverTypes = [] } = useQuery({
    queryKey: serverQueryKeys.types(),
    queryFn: getServerTypes,
  });

  // Watch for server type changes to show/hide fields
  const serverType = Form.useWatch('ServerType', form);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createServer,
    onSuccess: () => {
      message.success(t('admin.servers.createSuccess') || 'שרת נוצר בהצלחה');
      onSuccess();
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.servers.createError') || 'שגיאה ביצירת שרת');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServerRequest }) =>
      updateServer(id, data),
    onSuccess: () => {
      message.success(t('admin.servers.updateSuccess') || 'שרת עודכן בהצלחה');
      onSuccess();
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.servers.updateError') || 'שגיאה בעדכון שרת');
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      if (server) {
        form.setFieldsValue({
          ...server,
          // Flatten Kafka config if present
          KafkaBootstrapServers: server.KafkaConfig?.BootstrapServers,
          KafkaSecurityProtocol: server.KafkaConfig?.SecurityProtocol || 'PLAINTEXT',
          KafkaSaslMechanism: server.KafkaConfig?.SaslMechanism,
          KafkaEnableSsl: server.KafkaConfig?.EnableSsl || false,
          KafkaDefaultConsumerGroup: server.KafkaConfig?.DefaultConsumerGroup,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          Direction: defaultDirection || 'Both',
          IsActive: true,
          ConnectionTimeoutSeconds: 30,
          RetryCount: 3,
          KafkaSecurityProtocol: 'PLAINTEXT',
        });
      }
    }
  }, [visible, server, form, defaultDirection]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Build the request object
      const requestData: CreateServerRequest | UpdateServerRequest = {
        Name: values.Name,
        Description: values.Description,
        ServerType: values.ServerType,
        Direction: values.Direction as ServerDirection,
        Host: values.Host,
        Port: values.Port,
        BasePath: values.BasePath,
        CredentialSecretRef: values.CredentialSecretRef,
        ConnectionTimeoutSeconds: values.ConnectionTimeoutSeconds,
        RetryCount: values.RetryCount,
        ...(isEditing && { IsActive: values.IsActive }),
      };

      // Add Kafka config if server type is kafka
      if (values.ServerType === 'kafka') {
        requestData.KafkaConfig = {
          BootstrapServers: values.KafkaBootstrapServers,
          SecurityProtocol: values.KafkaSecurityProtocol,
          SaslMechanism: values.KafkaSaslMechanism,
          EnableSsl: values.KafkaEnableSsl || false,
          SslCaLocation: values.KafkaSslCaLocation,
          AcksRequired: values.KafkaAcksRequired || 1,
          DefaultConsumerGroup: values.KafkaDefaultConsumerGroup,
        };
      }

      if (isEditing) {
        updateMutation.mutate({ id: server.ID, data: requestData as UpdateServerRequest });
      } else {
        createMutation.mutate(requestData as CreateServerRequest);
      }
    } catch {
      // Form validation failed
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Get default port for selected server type
  const selectedTypeInfo = serverTypes.find(t => t.Type === serverType);
  const defaultPort = selectedTypeInfo?.DefaultPort;

  // Check if type requires host/port vs base path
  const requiresHostPort = ['ftp', 'sftp', 's3', 'http'].includes(serverType?.toLowerCase() || '');
  const requiresBasePath = ['local', 'nfs', 'folder'].includes(serverType?.toLowerCase() || '');
  const isKafka = serverType?.toLowerCase() === 'kafka';
  const isS3 = serverType?.toLowerCase() === 's3';

  return (
    <Modal
      title={isEditing
        ? (t('admin.servers.editTitle') || 'עריכת שרת')
        : (t('admin.servers.createTitle') || 'יצירת שרת חדש')
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={isLoading}
      okText={isEditing ? (t('common.save') || 'שמור') : (t('common.create') || 'צור')}
      cancelText={t('common.cancel') || 'ביטול'}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
      >
        {/* Basic Info */}
        <Form.Item
          name="Name"
          label={t('admin.servers.fields.name') || 'שם שרת'}
          rules={[{ required: true, message: 'שם שרת הוא שדה חובה' }]}
        >
          <Input placeholder="Production FTP Server" />
        </Form.Item>

        <Form.Item
          name="Description"
          label={t('admin.servers.fields.description') || 'תיאור'}
        >
          <TextArea rows={2} placeholder="תיאור השרת (אופציונלי)" />
        </Form.Item>

        <Space style={{ width: '100%' }} size="middle">
          <Form.Item
            name="ServerType"
            label={t('admin.servers.fields.type') || 'סוג שרת'}
            rules={[{ required: true, message: 'סוג שרת הוא שדה חובה' }]}
            style={{ flex: 1 }}
          >
            <Select placeholder="בחר סוג שרת">
              {serverTypes.map(type => (
                <Option key={type.Type} value={type.Type}>
                  {type.DisplayName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {!defaultDirection && (
            <Form.Item
              name="Direction"
              label={t('admin.servers.fields.direction') || 'כיוון'}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select>
                <Option value="Input">קלט (Input)</Option>
                <Option value="Output">פלט (Output)</Option>
                <Option value="Both">קלט + פלט (Both)</Option>
              </Select>
            </Form.Item>
          )}
        </Space>

        {/* Host/Port fields for FTP, SFTP, S3, HTTP */}
        {requiresHostPort && (
          <>
            <Divider>{t('admin.servers.sections.connection') || 'הגדרות חיבור'}</Divider>
            <Space style={{ width: '100%' }} size="middle">
              <Form.Item
                name="Host"
                label={t('admin.servers.fields.host') || 'כתובת (Host)'}
                rules={[{ required: true, message: 'כתובת היא שדה חובה' }]}
                style={{ flex: 2 }}
              >
                <Input className="ltr-field" placeholder="ftp.example.com" />
              </Form.Item>

              <Form.Item
                name="Port"
                label={t('admin.servers.fields.port') || 'פורט'}
                style={{ flex: 1 }}
                initialValue={defaultPort}
              >
                <InputNumber
                  className="ltr-field"
                  min={1}
                  max={65535}
                  style={{ width: '100%' }}
                  placeholder={defaultPort?.toString()}
                />
              </Form.Item>
            </Space>

            <Form.Item
              name="CredentialSecretRef"
              label={t('admin.servers.fields.credentials') || 'הפניה לסוד (K8s Secret)'}
            >
              <Input
                className="ltr-field"
                placeholder="ez-platform/ftp-credentials"
              />
            </Form.Item>
          </>
        )}

        {/* S3 / MinIO credential fields */}
        {isS3 && (
          <>
            <Divider>{t('admin.servers.sections.s3') || 'הגדרות S3 / MinIO'}</Divider>
            <Form.Item
              name="AccessKey"
              label={t('admin.servers.fields.accessKey') || 'Access Key (מפתח גישה)'}
              rules={[{ required: true, message: 'Access Key הוא שדה חובה' }]}
            >
              <Input className="ltr-field" placeholder="AKIAIOSFODNN7EXAMPLE" autoComplete="off" />
            </Form.Item>

            <Form.Item
              name="SecretKey"
              label={t('admin.servers.fields.secretKey') || 'Secret Key (מפתח סודי)'}
              rules={[{ required: true, message: 'Secret Key הוא שדה חובה' }]}
            >
              <Input.Password
                className="ltr-field"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                autoComplete="new-password"
                visibilityToggle
              />
            </Form.Item>

            <Space style={{ width: '100%' }} size="middle">
              <Form.Item
                name="Bucket"
                label={t('admin.servers.fields.bucket') || 'Bucket (דלי)'}
                rules={[{ required: true, message: 'Bucket הוא שדה חובה' }]}
                style={{ flex: 2 }}
              >
                <Input className="ltr-field" placeholder="my-bucket" />
              </Form.Item>

              <Form.Item
                name="Region"
                label={t('admin.servers.fields.region') || 'Region (אזור)'}
                style={{ flex: 1 }}
                initialValue="us-east-1"
              >
                <Input className="ltr-field" placeholder="us-east-1" />
              </Form.Item>
            </Space>

            <Space style={{ width: '100%' }} size="large">
              <Form.Item
                name="UsePathStyle"
                label={t('admin.servers.fields.usePathStyle') || 'כתובות Path-Style (מומלץ ל-MinIO)'}
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="UseHttp"
                label={t('admin.servers.fields.useHttp') || 'השתמש ב-HTTP (לא HTTPS)'}
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>
            </Space>
          </>
        )}

        {/* Base Path for Local, NFS, Folder */}
        {requiresBasePath && (
          <>
            <Divider>{t('admin.servers.sections.path') || 'הגדרות נתיב'}</Divider>
            <Form.Item
              name="BasePath"
              label={t('admin.servers.fields.basePath') || 'נתיב בסיס'}
              rules={[{ required: true, message: 'נתיב בסיס הוא שדה חובה' }]}
            >
              <Input className="ltr-field" placeholder="/data/input" />
            </Form.Item>
          </>
        )}

        {/* Kafka-specific fields */}
        {isKafka && (
          <>
            <Divider>{t('admin.servers.sections.kafka') || 'הגדרות Kafka'}</Divider>
            <Form.Item
              name="KafkaBootstrapServers"
              label={t('admin.servers.fields.bootstrapServers') || 'Bootstrap Servers'}
              rules={[{ required: true, message: 'Bootstrap Servers הוא שדה חובה' }]}
            >
              <Input className="ltr-field" placeholder="kafka:9092,kafka2:9092" />
            </Form.Item>

            <Space style={{ width: '100%' }} size="middle">
              <Form.Item
                name="KafkaSecurityProtocol"
                label={t('admin.servers.fields.securityProtocol') || 'Security Protocol'}
                style={{ flex: 1 }}
              >
                <Select>
                  <Option value="PLAINTEXT">PLAINTEXT</Option>
                  <Option value="SSL">SSL</Option>
                  <Option value="SASL_PLAINTEXT">SASL_PLAINTEXT</Option>
                  <Option value="SASL_SSL">SASL_SSL</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="KafkaSaslMechanism"
                label={t('admin.servers.fields.saslMechanism') || 'SASL Mechanism'}
                style={{ flex: 1 }}
              >
                <Select allowClear placeholder="ללא">
                  <Option value="PLAIN">PLAIN</Option>
                  <Option value="SCRAM-SHA-256">SCRAM-SHA-256</Option>
                  <Option value="SCRAM-SHA-512">SCRAM-SHA-512</Option>
                </Select>
              </Form.Item>
            </Space>

            <Form.Item
              name="KafkaDefaultConsumerGroup"
              label={t('admin.servers.fields.defaultConsumerGroup') || 'Default Consumer Group'}
            >
              <Input className="ltr-field" placeholder="dataprocessing-group" />
            </Form.Item>

            <Form.Item
              name="KafkaEnableSsl"
              label={t('admin.servers.fields.enableSsl') || 'הפעל SSL'}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </>
        )}

        {/* Advanced Settings */}
        <Divider>{t('admin.servers.sections.advanced') || 'הגדרות מתקדמות'}</Divider>
        <Space style={{ width: '100%' }} size="middle">
          <Form.Item
            name="ConnectionTimeoutSeconds"
            label={t('admin.servers.fields.timeout') || 'Timeout (שניות)'}
            style={{ flex: 1 }}
          >
            <InputNumber min={1} max={300} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="RetryCount"
            label={t('admin.servers.fields.retries') || 'ניסיונות חוזרים'}
            style={{ flex: 1 }}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        {isEditing && (
          <Form.Item
            name="IsActive"
            label={t('admin.servers.fields.active') || 'פעיל'}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        )}

        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
          {t('admin.servers.credentialsNote') || 'הערה: אישורים מאוחסנים ב-Kubernetes Secrets ומוזכרים באמצעות CredentialSecretRef'}
        </Typography.Text>
      </Form>
    </Modal>
  );
};

export default ServerModal;
