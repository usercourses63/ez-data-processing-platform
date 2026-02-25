/**
 * ServerListTab - Reusable Server List Component
 * v0.2.0: Parameterized by direction (input/output)
 * Used by both InputServersTab and OutputServersTab
 */
import React, { useState } from 'react';
import { Button, message, Space, Badge, Typography, Alert } from 'antd';
import { PlusOutlined, CloudServerOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getInputServers,
  getOutputServers,
  deleteServer,
  toggleServerActive,
  serverQueryKeys,
} from '../../../services/servers-api-client';
import type { AdminServer, ServerDirection } from '../../../services/servers-api-client';
import ServerTable from '../components/ServerTable';
import ServerModal from '../components/ServerModal';

interface ServerListTabProps {
  direction: 'input' | 'output';
}

const ServerListTab: React.FC<ServerListTabProps> = ({ direction }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<AdminServer | null>(null);

  // Configuration based on direction
  const config = {
    input: {
      icon: <DownloadOutlined />,
      title: t('admin.servers.inputTitle') || 'ניהול שרתי קלט',
      addButton: t('admin.servers.addInputServer') || 'הוסף שרת קלט',
      emptyText: t('admin.servers.noInputServers') || 'אין שרתי קלט מוגדרים',
      defaultDirection: 'Input' as ServerDirection,
    },
    output: {
      icon: <UploadOutlined />,
      title: t('admin.servers.outputTitle') || 'ניהול שרתי פלט',
      addButton: t('admin.servers.addOutputServer') || 'הוסף שרת פלט',
      emptyText: t('admin.servers.noOutputServers') || 'אין שרתי פלט מוגדרים',
      defaultDirection: 'Output' as ServerDirection,
    },
  }[direction];

  // Fetch servers based on direction (Input, Output, or Both)
  const { data: servers = [], isLoading, error } = useQuery({
    queryKey: serverQueryKeys.list(direction),
    queryFn: () => direction === 'input' ? getInputServers() : getOutputServers(),
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

  // Calculate statistics
  const activeCount = servers.filter((s: AdminServer) => s.IsActive).length;
  const inactiveCount = servers.length - activeCount;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {error && (
        <Alert
          message={t('common.error') || 'שגיאה'}
          description={error instanceof Error ? error.message : t('admin.servers.loadError')}
          type="error"
          showIcon
          closable
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {config.icon} {config.title}
          </Typography.Title>
          <Typography.Text type="secondary">
            <Badge
              status="success"
              text={`${activeCount} ${t('admin.servers.active') || 'פעילים'}`}
            />
            {' | '}
            <Badge
              status="default"
              text={`${inactiveCount} ${t('admin.servers.inactive') || 'לא פעילים'}`}
            />
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          {config.addButton}
        </Button>
      </div>

      {servers.length === 0 && !isLoading && (
        <Alert
          message={config.emptyText}
          description={t('admin.servers.emptyHint') || 'לחץ על כפתור "הוסף" ליצירת שרת חדש'}
          type="info"
          showIcon
          icon={<CloudServerOutlined />}
        />
      )}

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
        defaultDirection={config.defaultDirection}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </Space>
  );
};

export default ServerListTab;
