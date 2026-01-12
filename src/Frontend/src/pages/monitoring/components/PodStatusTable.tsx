import React from 'react';
import { Table, Tag, Progress } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { PodStatus } from '../../../types/kubernetes.types';

interface PodStatusTableProps {
  pods: PodStatus[];
}

const PodStatusTable: React.FC<PodStatusTableProps> = ({ pods }) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'pending':
        return 'warning';
      case 'error':
        return 'error';
      case 'terminated':
        return 'default';
      default:
        return 'default';
    }
  };

  const getResourceColor = (value: number) => {
    if (value > 80) return '#ef4444';
    if (value > 60) return '#fbbf24';
    return '#10b981';
  };

  const columns: ColumnsType<PodStatus> = [
    {
      title: t('monitoring.podName'),
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text: string) => <span className="pod-name-cell">{text}</span>,
    },
    {
      title: t('monitoring.service'),
      dataIndex: 'service',
      key: 'service',
      width: 180,
    },
    {
      title: t('monitoring.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} className="pod-status-tag">
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: t('monitoring.restarts'),
      dataIndex: 'restarts',
      key: 'restarts',
      width: 100,
      align: 'center',
      render: (restarts: number) => (
        <span className={restarts > 3 ? 'restarts-high' : ''}>{restarts}</span>
      ),
    },
    {
      title: t('monitoring.cpu'),
      dataIndex: 'cpu',
      key: 'cpu',
      width: 150,
      render: (cpu: number) => (
        <div className="resource-cell">
          <Progress
            percent={cpu}
            strokeColor={getResourceColor(cpu)}
            size="small"
            format={(percent) => `${percent}%`}
          />
        </div>
      ),
    },
    {
      title: t('monitoring.memory'),
      dataIndex: 'memory',
      key: 'memory',
      width: 150,
      render: (memory: number) => (
        <div className="resource-cell">
          <Progress
            percent={memory}
            strokeColor={getResourceColor(memory)}
            size="small"
            format={(percent) => `${percent}%`}
          />
        </div>
      ),
    },
    {
      title: t('monitoring.age'),
      dataIndex: 'age',
      key: 'age',
      width: 100,
    },
    {
      title: t('monitoring.node'),
      dataIndex: 'node',
      key: 'node',
      width: 120,
    },
  ];

  return (
    <div className="pod-status-table-container">
      <Table
        columns={columns}
        dataSource={pods}
        rowKey="name"
        pagination={false}
        className="pod-status-table"
        scroll={{ y: 500 }}
      />
    </div>
  );
};

export default PodStatusTable;
