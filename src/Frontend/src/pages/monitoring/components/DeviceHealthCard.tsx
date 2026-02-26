import React from 'react';
import { Card, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DeviceHealthInfo, DeviceHealthStatus } from '../../../types/device-health.types';

const { Text, Paragraph } = Typography;

const statusColorMap: Record<DeviceHealthStatus, string> = {
  Healthy: 'success',
  Degraded: 'warning',
  Down: 'error',
  Disabled: 'default',
};

interface DeviceHealthCardProps {
  device: DeviceHealthInfo;
}

/**
 * Formats a relative time string from an ISO date string
 */
const formatRelativeTime = (
  isoDate: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string => {
  if (!isoDate) {
    return t('monitoring.deviceHealth.notAvailable');
  }
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) {
    return t('monitoring.deviceHealth.secondsAgo', { count: diffSeconds });
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  return t('monitoring.deviceHealth.minutesAgo', { count: diffMinutes });
};

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  height: '100%',
};

const DeviceHealthCard: React.FC<DeviceHealthCardProps> = ({ device }) => {
  const { t } = useTranslation();

  const statusColor = statusColorMap[device.Status] || 'default';
  const statusText = t(`monitoring.deviceHealth.${device.Status.toLowerCase()}`);
  const subtitle = (device.DeviceSubType || device.DeviceType) + ' - ' + device.Role;
  const showError = device.Status === 'Degraded' || device.Status === 'Down';
  const showLatency = device.LatencyMs != null && device.Status !== 'Disabled';

  return (
    <Card
      hoverable
      style={cardStyle}
      bodyStyle={{ padding: 16 }}
    >
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Tag color={statusColor} style={{ fontSize: 13 }}>
          {statusText}
        </Tag>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 15, color: '#f1f5f9' }}>{device.DeviceName}</Text>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 12, color: '#94a3b8' }}>{subtitle}</Text>
      </div>

      {showLatency && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: '#94a3b8' }}>{t('monitoring.deviceHealth.latency')}:</Text>
          <Text style={{ color: '#f1f5f9' }}>{device.LatencyMs}ms</Text>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: '#94a3b8' }}>{t('monitoring.deviceHealth.uptime24h')}:</Text>
        <Text style={{ color: '#f1f5f9' }}>{device.UptimePercentage24h.toFixed(1)}%</Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: '#94a3b8' }}>{t('monitoring.deviceHealth.lastCheck')}:</Text>
        <Text style={{ color: '#f1f5f9' }}>{formatRelativeTime(device.LastCheckTime, t)}</Text>
      </div>

      {showError && device.ErrorMessage && (
        <div style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>
            {t('monitoring.deviceHealth.errorReason')}:
          </Text>
          <Tooltip title={device.ErrorMessage}>
            <Paragraph
              style={{ fontSize: 12, marginBottom: 0, marginTop: 2, color: '#ff4d4f' }}
              ellipsis={{ rows: 2 }}
            >
              {device.ErrorMessage}
            </Paragraph>
          </Tooltip>
        </div>
      )}
    </Card>
  );
};

export default DeviceHealthCard;
