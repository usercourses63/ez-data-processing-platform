/**
 * Server Configuration Tab for Admin Settings
 * v0.2.0: External File Access Support
 * Manages Input and Output file servers
 */
import React, { useState } from 'react';
import { Button, message, Space, Badge, Typography, Alert, Segmented } from 'antd';
import { PlusOutlined, CloudServerOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getAllServers,
  getInputServers,
  getOutputServers,
  deleteServer,
  toggleServerActive,
  serverQueryKeys,
} from '../../../services/servers-api-client';
import type { AdminServer } from '../../../services/servers-api-client';
import ServerTable from '../components/ServerTable';
import ServerModal from '../components/ServerModal';

type ServerFilter = 'all' | 'input' | 'output';

const ServerConfigurationTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<AdminServer | null>(null);
  const [filter, setFilter] = useState<ServerFilter>('all');

  // Fetch servers based on filter
  const { data: servers = [], isLoading, error } = useQuery({
    queryKey: serverQueryKeys.list(filter === 'all' ? undefined : filter),
    queryFn: () => {
      switch (filter) {
        case 'input':
          return getInputServers();
        case 'output':
          return getOutputServers();
        default:
          return getAllServers();
      }
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: deleteServer,
    onSuccess: () => {
      message.success(t('admin.servers.deleteSuccess') || 'שרת נמחק בהצלחה');
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.servers.deleteError') || 'שגיאה במחיקת שרת');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleServerActive(id, isActive),
    onSuccess: () => {
      message.success(t('admin.servers.toggleSuccess') || 'סטטוס שרת עודכן בהצלחה');
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.servers.toggleError') || 'שגיאה בשינוי סטטוס שרת');
    },
  });

  const handleAdd = () => {
    setEditingServer(null);
    setIsModalVisible(true);
  };

  const handleEdit = (server: AdminServer) => {
    setEditingServer(server);
    setIsModalVisible(true);
  };

  const handleDelete = (server: AdminServer) => {
    deleteMutation.mutate(server.ID);
  };

  const handleToggleActive = (server: AdminServer) => {
    toggleActiveMutation.mutate({
      id: server.ID,
      isActive: !server.IsActive,
    });
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingServer(null);
  };

  const handleModalSuccess = () => {
    setIsModalVisible(false);
    setEditingServer(null);
    queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
  };

  if (error) {
    return (
      <Alert
        message="שגיאה בטעינת שרתים"
        description={(error as Error).message}
        type="error"
        showIcon
      />
    );
  }

  // Count by direction and status
  const activeCount = servers.filter(s => s.IsActive).length;
  const inactiveCount = servers.length - activeCount;
  const inputCount = servers.filter(s => s.Direction === 'Input' || s.Direction === 'Both').length;
  const outputCount = servers.filter(s => s.Direction === 'Output' || s.Direction === 'Both').length;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <CloudServerOutlined /> {t('admin.servers.subtitle') || 'ניהול שרתי קבצים'}
          </Typography.Title>
          <Typography.Text type="secondary">
            <Badge status="success" text={`${activeCount} פעילים`} />
            {' | '}
            <Badge status="default" text={`${inactiveCount} לא פעילים`} />
            {' | '}
            <DownloadOutlined /> {`${inputCount} קלט`}
            {' | '}
            <UploadOutlined /> {`${outputCount} פלט`}
          </Typography.Text>
        </div>
        <Space>
          <Segmented
            value={filter}
            onChange={(value) => setFilter(value as ServerFilter)}
            options={[
              { label: t('admin.servers.filterAll') || 'הכל', value: 'all' },
              { label: t('admin.servers.filterInput') || 'קלט', value: 'input', icon: <DownloadOutlined /> },
              { label: t('admin.servers.filterOutput') || 'פלט', value: 'output', icon: <UploadOutlined /> },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            {t('admin.servers.addButton') || 'הוסף שרת'}
          </Button>
        </Space>
      </div>

      <ServerTable
        servers={servers}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      <ServerModal
        visible={isModalVisible}
        server={editingServer}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </Space>
  );
};

export default ServerConfigurationTab;
