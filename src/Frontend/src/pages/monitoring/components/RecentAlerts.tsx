import React from 'react';
import { List, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../../types/kubernetes.types';
import { formatTimeAgo } from '../../../services/kubernetes-mock-data';

interface RecentAlertsProps {
  alerts: Alert[];
}

const RecentAlerts: React.FC<RecentAlertsProps> = ({ alerts }) => {
  const { t } = useTranslation();

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const getAlertBorderColor = (type: string) => {
    switch (type) {
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#fbbf24';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="recent-alerts-container">
      <List
        className="alerts-list"
        dataSource={alerts}
        renderItem={(alert) => (
          <List.Item
            className="alert-item"
            style={{ borderLeft: `4px solid ${getAlertBorderColor(alert.type)}` }}
          >
            <div className="alert-item-content">
              <div className="alert-icon">{alert.icon}</div>
              <div className="alert-content">
                <div className="alert-header">
                  <h4 className="alert-title">{alert.title}</h4>
                  <Tag color={getAlertColor(alert.type)} className="alert-type-tag">
                    {alert.type.toUpperCase()}
                  </Tag>
                </div>
                <p className="alert-message">{alert.message}</p>
                {alert.service && (
                  <span className="alert-service">
                    {t('monitoring.service')}: {alert.service}
                  </span>
                )}
              </div>
              <div className="alert-time">{formatTimeAgo(alert.timestamp)}</div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
};

export default RecentAlerts;
