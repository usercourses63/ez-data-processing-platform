import React from 'react';
import { Tag, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { DeviceHealthStatusResponse } from '../../../types/device-health.types';

interface DeviceHealthSummaryBarProps {
  data: DeviceHealthStatusResponse;
}

const DeviceHealthSummaryBar: React.FC<DeviceHealthSummaryBarProps> = ({ data }) => {
  const { t } = useTranslation();

  const activeDevices = (data.TotalDevices ?? 0) - (data.DisabledCount ?? 0);

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
        {data.HealthyCount}/{activeDevices} {t('monitoring.deviceHealth.healthy')}
      </Tag>

      {data.DegradedCount > 0 && (
        <Tag color="warning" style={{ fontSize: 14, padding: '4px 12px' }}>
          {data.DegradedCount} {t('monitoring.deviceHealth.degraded')}
        </Tag>
      )}

      {data.DownCount > 0 && (
        <Tag color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
          {data.DownCount} {t('monitoring.deviceHealth.down')}
        </Tag>
      )}

      {data.DisabledCount > 0 && (
        <Tag color="default" style={{ fontSize: 14, padding: '4px 12px' }}>
          {data.DisabledCount} {t('monitoring.deviceHealth.disabled')}
        </Tag>
      )}
    </div>
  );
};

export default DeviceHealthSummaryBar;
