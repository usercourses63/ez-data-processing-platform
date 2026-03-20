/**
 * NasDevicesTab - NAS Device Management Tab
 * v0.2.0: NAS/NFS Architecture Support
 */
import React, { useState } from 'react';
import { Button, Space, Badge, Typography, Alert, Modal } from 'antd';
import { PlusOutlined, HddOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getNasDevices,
  deleteNasDevice,
  provisionNasDevice,
  nasDeviceQueryKeys,
} from '../../../services/nas-devices-api-client';
import type { NasDevice } from '../../../services/nas-devices-api-client';
import NasDeviceTable from '../components/NasDeviceTable';
import NasDeviceModal from '../components/NasDeviceModal';

const NasDevicesTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<NasDevice | null>(null);

  // Fetch NAS devices
  const { data: devices = [], isLoading, error } = useQuery({
    queryKey: nasDeviceQueryKeys.list(),
    queryFn: () => getNasDevices(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteNasDevice,
    onSuccess: () => {
      showToast('success', t('common.delete') || 'Delete', t('admin.nas.deleteSuccess') || 'NAS device deleted successfully');
      queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
    },
    onError: (error: Error) => {
      showToast('error', t('common.error') || 'Error', error.message || t('admin.nas.deleteError') || 'Error deleting NAS device');
    },
  });

  // Provision — use async handler with explicit loading message
  const handleProvisionExec = async (id: string) => {
    const key = `provision-${id}`;
    showToast('info', t('admin.nas.provision') || 'Provisioning', t('admin.nas.provisioning') || 'Creating Kubernetes resources...');
    try {
      const result = await provisionNasDevice(id);
      if (result.Success) {
        showToast('success', t('admin.nas.provision') || 'Provisioning', t('admin.nas.provisionSuccess') || 'Kubernetes resources created successfully');
      } else {
        showToast('error', t('admin.nas.provision') || 'Provisioning', result.ErrorMessage || t('admin.nas.provisionError') || 'Error provisioning');
      }
      queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
    } catch (error: any) {
      showToast('error', t('admin.nas.provision') || 'Provisioning', error.message || t('admin.nas.provisionError') || 'Error provisioning');
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setIsModalVisible(true);
  };

  const handleEdit = (device: NasDevice) => {
    setEditingDevice(device);
    setIsModalVisible(true);
  };

  const handleDelete = (device: NasDevice) => {
    deleteMutation.mutate(device.ID);
  };

  const handleProvision = (device: NasDevice) => {
    Modal.confirm({
      title: t('admin.nas.confirmProvision') || 'Confirm Provisioning',
      content: t('admin.nas.provisionDescription', { name: device.Name }) ||
        `Create PersistentVolume and PersistentVolumeClaim for ${device.Name}?`,
      okText: t('common.yes') || 'Yes',
      cancelText: t('common.no') || 'No',
      onOk: () => handleProvisionExec(device.ID),
    });
  };

  const handleTestConnection = (device: NasDevice) => {
    // Test connection is handled in NasDeviceTable component
    // Test connection handled in NasDeviceTable component
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingDevice(null);
  };

  const handleModalSuccess = () => {
    setIsModalVisible(false);
    setEditingDevice(null);
    queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
  };

  // Calculate statistics
  const provisionedCount = devices.filter((d: NasDevice) => d.IsPvCreated && d.IsPvcBound).length;
  const pendingCount = devices.length - provisionedCount;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {error && (
        <Alert
          message={t('common.error') || 'Error'}
          description={error instanceof Error ? error.message : t('admin.nas.loadError') || 'Error loading NAS devices'}
          type="error"
          showIcon
          closable
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <HddOutlined /> {t('admin.nas.title') || 'NAS Device Management'}
          </Typography.Title>
          <Typography.Text type="secondary">
            <Badge
              status="success"
              text={`${provisionedCount} ${t('admin.nas.provisioned') || 'provisioned'}`}
            />
            {' | '}
            <Badge
              status="default"
              text={`${pendingCount} ${t('admin.nas.pending') || 'pending'}`}
            />
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          {t('admin.nas.addDevice') || 'Add NAS Device'}
        </Button>
      </div>

      {devices.length === 0 && !isLoading && (
        <Alert
          message={t('admin.nas.emptyTitle') || 'No NAS devices configured'}
          description={t('admin.nas.emptyHint') || 'Click "Add NAS Device" to configure a new NAS storage device'}
          type="info"
          showIcon
          icon={<HddOutlined />}
        />
      )}

      <NasDeviceTable
        devices={devices}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onProvision={handleProvision}
        onTestConnection={handleTestConnection}
      />

      <NasDeviceModal
        visible={isModalVisible}
        device={editingDevice}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </Space>
  );
};

export default NasDevicesTab;
