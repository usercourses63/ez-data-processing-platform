/**
 * Server Table Component for Admin Settings
 * v0.2.0: External File Access Support
 */
import React, { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, Switch, Tooltip, message } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { AdminServer } from '../../../services/servers-api-client';
import { testServerConnection, serverQueryKeys } from '../../../services/servers-api-client';

interface ServerTableProps {
  servers: AdminServer[];
  loading: boolean;
  onEdit: (server: AdminServer) => void;
  onDelete: (server: AdminServer) => void;
  onToggleActive: (server: AdminServer) => void;
}

// Server type display names and colors
const serverTypeConfig: Record<string, { label: string; color: string }> = {
  local: { label: 'Local', color: 'default' },
  ftp: { label: 'FTP', color: 'blue' },
  sftp: { label: 'SFTP', color: 'cyan' },
  s3: { label: 'S3/MinIO', color: 'orange' },
  http: { label: 'HTTP', color: 'green' },
  nfs: { label: 'NFS', color: 'purple' },
  kafka: { label: 'Kafka', color: 'red' },
  folder: { label: 'Folder', color: 'default' },
};

// Direction display (backend returns numeric enum: 0=Input, 1=Output, 2=Both)
const directionConfig: Record<string | number, { label: string; color: string }> = {
  0: { label: 'קלט', color: 'blue' },
  1: { label: 'פלט', color: 'green' },
  2: { label: 'דו-כיווני', color: 'purple' },
  Input: { label: 'קלט', color: 'blue' },
  Output: { label: 'פלט', color: 'green' },
  Both: { label: 'דו-כיווני', color: 'purple' },
};

const ServerTable: React.FC<ServerTableProps> = ({
  servers,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [testingServerId, setTestingServerId] = useState<string | null>(null);

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: testServerConnection,
    onSuccess: (result, serverId) => {
      if (result.Success) {
        message.success(`חיבור הצליח (${result.TestDuration})`);
      } else {
        message.error(`חיבור נכשל: ${result.ErrorMessage}`);
      }
      queryClient.invalidateQueries({ queryKey: serverQueryKeys.detail(serverId) });
      setTestingServerId(null);
    },
    onError: (error: Error) => {
      message.error(error.message || 'שגיאה בבדיקת חיבור');
      setTestingServerId(null);
    },
  });

  const handleTestConnection = (server: AdminServer) => {
    setTestingServerId(server.ID);
    testConnectionMutation.mutate(server.ID);
  };

  const columns: ColumnsType<AdminServer> = [
    {
      title: t('admin.servers.columns.name') || 'שם',
      dataIndex: 'Name',
      key: 'name',
      width: 200,
      render: (name: string, record: AdminServer) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {!record.IsActive && <Tag color="default">לא פעיל</Tag>}
        </Space>
      ),
    },
    {
      title: t('admin.servers.columns.type') || 'סוג',
      dataIndex: 'ServerType',
      key: 'serverType',
      width: 120,
      render: (type: string) => {
        const config = serverTypeConfig[type.toLowerCase()] || { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t('admin.servers.columns.direction') || 'כיוון',
      dataIndex: 'Direction',
      key: 'direction',
      width: 120,
      render: (direction: string) => {
        const config = directionConfig[direction] || { label: direction, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t('admin.servers.columns.host') || 'כתובת',
      key: 'host',
      width: 200,
      render: (_: unknown, record: AdminServer) => {
        if (record.ServerType === 'kafka' && record.KafkaConfig) {
          return (
            <span className="ltr-field" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {record.KafkaConfig.BootstrapServers}
            </span>
          );
        }
        if (record.Host) {
          return (
            <span className="ltr-field" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {record.Host}:{record.Port || '-'}
            </span>
          );
        }
        if (record.BasePath) {
          return (
            <span className="ltr-field" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {record.BasePath}
            </span>
          );
        }
        return '-';
      },
    },
    {
      title: t('admin.servers.columns.lastTest') || 'בדיקה אחרונה',
      key: 'lastTest',
      width: 150,
      render: (_: unknown, record: AdminServer) => {
        if (record.LastConnectionTest) {
          const date = new Date(record.LastConnectionTest);
          const icon = record.LastConnectionSuccess ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          );
          return (
            <Space>
              {icon}
              <span>{date.toLocaleDateString('he-IL')}</span>
            </Space>
          );
        }
        return <span style={{ color: '#999' }}>לא נבדק</span>;
      },
    },
    {
      title: t('admin.servers.columns.active') || 'פעיל',
      key: 'active',
      width: 80,
      align: 'center',
      render: (_: unknown, record: AdminServer) => (
        <Switch
          checked={record.IsActive}
          onChange={() => onToggleActive(record)}
          size="small"
        />
      ),
    },
    {
      title: t('admin.servers.columns.actions') || 'פעולות',
      key: 'actions',
      width: 180,
      align: 'center',
      render: (_: unknown, record: AdminServer) => (
        <Space size="small">
          <Tooltip title={t('admin.servers.testConnection') || 'בדוק חיבור'}>
            <Button
              type="text"
              size="small"
              icon={testingServerId === record.ID ? <LoadingOutlined /> : <ApiOutlined />}
              onClick={() => handleTestConnection(record)}
              disabled={testingServerId === record.ID}
            />
          </Tooltip>
          <Tooltip title={t('common.edit') || 'ערוך'}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('admin.servers.deleteConfirm') || 'האם למחוק שרת זה?'}
            description={t('admin.servers.deleteWarning') || 'פעולה זו לא ניתנת לביטול'}
            onConfirm={() => onDelete(record)}
            okText={t('common.yes') || 'כן'}
            cancelText={t('common.no') || 'לא'}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t('common.delete') || 'מחק'}>
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
      dataSource={servers}
      rowKey="ID"
      loading={loading}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `סה"כ ${total} שרתים`,
      }}
      scroll={{ x: 1000 }}
    />
  );
};

export default ServerTable;
