/**
 * NAS Device Table Component for Admin Settings
 * v0.2.0: NAS/NFS Architecture Support
 */
import React, { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, Tooltip } from 'antd';
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

  // Custom toast — Ant Design 5.x static message/notification API broken without App wrapper
  const showToast = (type: 'success' | 'error' | 'info', title: string, desc: string) => {
    const colors = { success: '#52c41a', error: '#ff4d4f', info: '#1677ff' };
    const icons = { success: '✓', error: '✗', info: '⏳' };
    const existing = document.getElementById('nas-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'nas-toast';
    el.style.cssText = `position:fixed;top:24px;right:24px;z-index:99999;min-width:320px;max-width:450px;background:white;border-radius:8px;padding:16px 20px;box-shadow:0 6px 16px rgba(0,0,0,0.15);border-right:4px solid ${colors[type]};font-family:inherit;direction:rtl;animation:slideIn 0.3s ease`;
    el.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px"><span style="font-size:20px;color:${colors[type]}">${icons[type]}</span><div><strong style="font-size:14px">${title}</strong><br/><span style="font-size:13px;color:#666">${desc}</span></div></div>`;
    document.body.appendChild(el);
    if (type !== 'info') setTimeout(() => el.remove(), 6000);
  };

  // Test connection — use async/await with explicit message to survive re-renders
  const handleTestConnection = async (device: NasDevice) => {
    console.log('[NAS] Test connection clicked:', device.Name, device.ID);
    setTestingDeviceId(device.ID);
    showToast('info', device.Name, t('admin.nas.testingConnection') || 'Testing connection...');

    try {
      const result = await testNasDeviceConnection(device.ID);
      if (result.Success) {
        const isNetworkOnly = result.Message?.includes('בדיקת רשת') || result.Message?.includes('network');
        showToast(isNetworkOnly ? 'info' : 'success', device.Name, `${result.Message || t('admin.nas.connectionSuccess') || 'Connection OK'} (${result.DurationMs}ms)`);
      } else {
        showToast('error', device.Name, result.ErrorMessage || t('admin.nas.connectionFailed') || 'Connection failed');
      }
      queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
    } catch (error: any) {
      showToast('error', device.Name, error.message || 'Connection failed');
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
          <Popconfirm
            title={!record.IsPvCreated ? t('admin.nas.provision') || 'Allocate' : t('admin.nas.reprovision') || 'Re-allocate'}
            description={`Create PV/PVC for ${record.Name}?`}
            onConfirm={() => onProvision(record)}
            okText={t('common.yes') || 'Yes'}
            cancelText={t('common.no') || 'No'}
          >
            <Button
              type="text"
              size="small"
              icon={<CloudUploadOutlined />}
            />
          </Popconfirm>
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
