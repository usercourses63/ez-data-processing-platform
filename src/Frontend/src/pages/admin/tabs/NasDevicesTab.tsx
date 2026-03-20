/**
 * NasDevicesTab - NAS Device Management Tab
 * v0.2.0: NAS/NFS Architecture Support
 */
import React, { useState } from 'react';
import { Button, message, Space, Badge, Typography, Alert, Modal } from 'antd';
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
      message.success(t('admin.nas.deleteSuccess') || 'NAS device deleted successfully');
      queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.nas.deleteError') || 'Error deleting NAS device');
    },
  });

  // Provision — use async handler with explicit loading message
  const handleProvisionExec = async (id: string) => {
    const key = `provision-${id}`;
    message.loading({ content: t('admin.nas.provisioning') || 'Provisioning Kubernetes resources...', key, duration: 0 });
    try {
      const result = await provisionNasDevice(id);
      if (result.Success) {
        message.success({ content: t('admin.nas.provisionSuccess') || 'Kubernetes resources created successfully', key, duration: 5 });
      } else {
        message.error({ content: result.ErrorMessage || t('admin.nas.provisionError') || 'Error provisioning', key, duration: 8 });
      }
      queryClient.invalidateQueries({ queryKey: nasDeviceQueryKeys.all });
    } catch (error: any) {
      message.error({ content: error.message || t('admin.nas.provisionError') || 'Error provisioning', key, duration: 8 });
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
    message.info(t('admin.nas.testingConnection') || 'Testing connection...');
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
