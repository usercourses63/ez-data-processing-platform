import React from 'react';
import { Row, Col, Spin, Alert, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getDeviceHealthStatus } from '../../../services/health-status-api-client';
import { DeviceHealthStatusResponse } from '../../../types/device-health.types';
import DeviceHealthSummaryBar from './DeviceHealthSummaryBar';
import DeviceHealthCard from './DeviceHealthCard';

const { Title, Paragraph, Text } = Typography;

interface DeviceHealthTabProps {
  signalRData?: DeviceHealthStatusResponse | null;
  isSignalRConnected?: boolean;
}

const DeviceHealthTab: React.FC<DeviceHealthTabProps> = ({ signalRData, isSignalRConnected }) => {
  const { t } = useTranslation();

  // Polling fallback: only poll when SignalR is disconnected
  const { data: polledData, isLoading, error } = useQuery<DeviceHealthStatusResponse>({
    queryKey: ['device-health-status'],
    queryFn: getDeviceHealthStatus,
    refetchInterval: isSignalRConnected ? false : 15000,
    enabled: !isSignalRConnected,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });

  const data = signalRData ?? polledData;

  if (isLoading && !signalRData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>{t('common.loading')}</Paragraph>
      </div>
    );
  }

  if (error && !signalRData) {
    return (
      <Alert
        message={t('common.error')}
        description={error instanceof Error ? error.message : String(error)}
        type="error"
        showIcon
        style={{ margin: 16 }}
      />
    );
  }

  if (!data || (data.NasDevices.length === 0 && data.AdminServers.length === 0)) {
    return (
      <Alert
        message={t('monitoring.deviceHealth.initializing')}
        type="info"
        showIcon
        style={{ margin: 16 }}
      />
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <DeviceHealthSummaryBar data={data} />

      {/* NAS Devices Section */}
      <Title level={5} style={{ marginBottom: 12, color: '#f1f5f9' }}>
        {t('monitoring.deviceHealth.nasDevices')}
      </Title>
      {data.NasDevices.length > 0 ? (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {data.NasDevices.map((device) => (
            <Col key={device.DeviceId} xs={24} sm={12} lg={8} xl={6}>
              <DeviceHealthCard device={device} />
            </Col>
          ))}
        </Row>
      ) : (
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          {t('monitoring.deviceHealth.noDevices')}
        </Text>
      )}

      {/* Admin Servers Section */}
      <Title level={5} style={{ marginBottom: 12, color: '#f1f5f9' }}>
        {t('monitoring.deviceHealth.adminServers')}
      </Title>
      {data.AdminServers.length > 0 ? (
        <Row gutter={[16, 16]}>
          {data.AdminServers.map((device) => (
            <Col key={device.DeviceId} xs={24} sm={12} lg={8} xl={6}>
              <DeviceHealthCard device={device} />
            </Col>
          ))}
        </Row>
      ) : (
        <Text type="secondary" style={{ display: 'block' }}>
          {t('monitoring.deviceHealth.noDevices')}
        </Text>
      )}
    </div>
  );
};

export default DeviceHealthTab;
