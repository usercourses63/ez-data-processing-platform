import React from 'react';
import { Card, Statistic, Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { ThunderboltOutlined, TeamOutlined, InboxOutlined } from '@ant-design/icons';
import { MessageQueue } from '../../../types/kubernetes.types';

interface MessageQueuesProps {
  queues: MessageQueue[];
}

const MessageQueues: React.FC<MessageQueuesProps> = ({ queues }) => {
  const { t } = useTranslation();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge status="success" text={t('monitoring.healthy')} />;
      case 'warning':
        return <Badge status="warning" text={t('monitoring.warning')} />;
      case 'error':
        return <Badge status="error" text={t('monitoring.error')} />;
      default:
        return <Badge status="default" text={t('monitoring.unknown')} />;
    }
  };

  const getCardClassName = (status: string) => {
    return `queue-card queue-card-${status}`;
  };

  return (
    <div className="message-queues-grid">
      {queues.map((queue) => (
        <Card
          key={queue.name}
          className={getCardClassName(queue.status)}
          hoverable
        >
          <div className="queue-card-header">
            <h4 className="queue-name">{queue.topic}</h4>
            {getStatusBadge(queue.status)}
          </div>
          <div className="queue-topic-name">{queue.name}</div>
          <div className="queue-stats">
            <Statistic
              title={t('monitoring.queueDepth')}
              value={queue.depth}
              prefix={<InboxOutlined />}
              valueStyle={{ color: queue.depth > 200 ? '#ef4444' : '#3b82f6' }}
            />
            <Statistic
              title={t('monitoring.rate')}
              value={queue.rate}
              suffix="/s"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
            <Statistic
              title={t('monitoring.consumers')}
              value={queue.consumers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#a855f7' }}
            />
          </div>
        </Card>
      ))}
    </div>
  );
};

export default MessageQueues;
