/**
 * NAS Device Table Component for Admin Settings
 * v0.2.0: NAS/NFS Architecture Support
 */
import React, { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, Tooltip, message } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  DownloadOutlined,
  UploadOutlined,
  SwapOutlined,
  CloudServerOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { NasDevice, NasDeviceRole } from '../../../services/nas-devices-api-client';
import { testNasDeviceConnection, nasDeviceQueryKeys } from '../../../services/nas-devices-api-client';

interface NasDeviceTableProps {
  devices: NasDevice[];
  loading: boolean;
  onEdit: (device: NasDevice) => void;
  onDelete: (device: NasDevice) => void;
  onProvision: (device: NasDevice) => void;
  onTestConnection: (device: NasDevice) => void;
}

// Enum to string mapping (backend returns 0,1,2,3)
const roleEnumToString: Record<number, string> = {
  0: 'Input',
  1: 'Output',
  2: 'Backup',
  3: 'Both',
};

// Role display configuration
const roleConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Input: { label: 'Input', color: 'blue', icon: <DownloadOutlined /> },
  Output: { label: 'Output', color: 'green', icon: <UploadOutlined /> },
  Backup: { label: 'Backup', color: 'orange', icon: <CloudServerOutlined /> },
  Both: { label: 'Both', color: 'purple', icon: <SwapOutlined /> },
};

const NasDeviceTable: React.FC<NasDeviceTableProps> = ({
  devices,
  loading,
  onEdit,
  onDelete,
  onProvision,
  onTestConnection,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  // Test connection — use async/await with explicit message to survive re-renders
  const handleTestConnection = async (device: NasDevice) => {
    setTestingDeviceId(device.ID);
    const key = `test-conn-${device.ID}`;
    message.loading({ content: t('admin.nas.testingConnection') || 'Testing connection...', key, duration: 0 });

    try {
      const result = await testNasDeviceConnection(device.ID);
      if (result.Success) {
        message.success({ content: `${t('admin.nas.connectionSuccess') || 'Connection successful'} (${result.DurationMs}ms)`, key, duration: 5 });
      } else {
        message.error({ content: `${t('admin.nas.connectionFailed') || 'Connection failed'}: ${result.ErrorMessage}`, key, duration: 8 });
      }
      queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
    } catch (error: any) {
      message.error({ content: error.message || t('admin.nas.connectionFailed') || 'Connection failed', key, duration: 8 });
    } finally {
      setTestingDeviceId(null);
    }
  };

  const columns: ColumnsType<NasDevice> = [
    {
      title: t('admin.nas.fields.name') || 'Name',
      dataIndex: 'Name',
      key: 'name',
      width: 200,
      render: (name: string, record: NasDevice) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {record.IsPvCreated && record.IsPvcBound ? (
            <Tag color="success">{t('admin.nas.status.pvcBound')}</Tag>
          ) : record.IsPvCreated ? (
            <Tag color="processing">{t('admin.nas.status.pvCreated')}</Tag>
          ) : (
            <Tag color="default">{t('admin.nas.status.notProvisioned')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('admin.nas.fields.host') || 'Host:Port',
      key: 'hostPort',
      width: 180,
      render: (_: unknown, record: NasDevice) => (
        <span className="ltr-field" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {record.Host}:{record.Port || 2049}
        </span>
      ),
    },
    {
      title: t('admin.nas.fields.exportPath') || 'Export Path',
      dataIndex: 'ExportPath',
      key: 'exportPath',
      width: 150,
      render: (path: string) => (
        <span className="ltr-field" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {path}
        </span>
      ),
    },
    {
      title: t('admin.nas.fields.role') || 'Role',
      dataIndex: 'Role',
      key: 'role',
      width: 120,
      render: (role: NasDeviceRole) => {
        const roleName = typeof role === 'number' ? roleEnumToString[role] : role;
        const config = roleConfig[roleName] || { label: String(role), color: 'default', icon: null };
        return (
          <Tag color={config.color} icon={config.icon}>
            {t(`admin.nas.roles.${roleName}`) || config.label}
          </Tag>
        );
      },
    },
    {
      title: t('admin.nas.fields.storageCapacity') || 'Capacity',
      dataIndex: 'StorageCapacity',
      key: 'storageCapacity',
      width: 100,
      render: (capacity: string) => (
        <span className="ltr-field">{capacity}</span>
      ),
    },
    {
      title: t('admin.nas.fields.provisioningStatus') || 'Status',
      key: 'provisioningStatus',
      width: 150,
      render: (_: unknown, record: NasDevice) => (
        <Space direction="vertical" size="small">
          {record.IsPvCreated ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              {t('admin.nas.status.pvCreated')}
            </Tag>
          ) : (
            <Tag color="default">{t('admin.nas.status.pvPending')}</Tag>
          )}
          {record.IsPvcBound ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              {t('admin.nas.status.pvcBound')}
            </Tag>
          ) : record.IsPvCreated ? (
            <Tag color="processing">{t('admin.nas.status.pvcPending')}</Tag>
          ) : null}
          {record.ProvisioningError && (
            <Tag color="error" icon={<CloseCircleOutlined />}>
              {t('common.error')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('admin.nas.columns.actions') || 'Actions',
      key: 'actions',
      width: 200,
      align: 'center',
      render: (_: unknown, record: NasDevice) => (
        <Space size="small">
          <Tooltip title={t('admin.nas.testConnection') || 'Test Connection'}>
            <Button
              type="text"
              size="small"
              icon={testingDeviceId === record.ID ? <LoadingOutlined /> : <ApiOutlined />}
              onClick={() => handleTestConnection(record)}
              disabled={testingDeviceId === record.ID}
            />
          </Tooltip>
          <Tooltip title={!record.IsPvCreated ? t('admin.nas.provision') : t('admin.nas.reprovision')}>
            <Button
              type="text"
              size="small"
              icon={<CloudUploadOutlined />}
              onClick={() => onProvision(record)}
            />
          </Tooltip>
          <Tooltip title={t('common.edit') || 'Edit'}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('admin.nas.deleteDevice') || 'Delete NAS Device?'}
            description={t('admin.nas.deleteConfirm') || 'Are you sure you want to delete this device?'}
            onConfirm={() => onDelete(record)}
            okText={t('common.yes') || 'Yes'}
            cancelText={t('common.no') || 'No'}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t('common.delete') || 'Delete'}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={devices}
      rowKey="ID"
      loading={loading}
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (total) => `${t('common.total')} ${total} ${t('admin.nas.devices')}`,
      }}
      scroll={{ x: 1100 }}
    />
  );
};

export default NasDeviceTable;
