import React from 'react';
import { Row, Col, Card, Statistic, Progress, Tag, Tooltip } from 'antd';
import {
  ThunderboltOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ServiceStatus } from '../../../types/monitoring.types';

interface ServiceHealthGridProps {
  services: ServiceStatus[];
}

const ServiceHealthGrid: React.FC<ServiceHealthGridProps> = ({ services }) => {
  const { t } = useTranslation();

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'unknown':
      default:
        return 'default';
    }
  };

  // Get CPU status for progress bar
  const getCpuStatus = (cpu: number): 'success' | 'normal' | 'exception' | 'active' => {
    if (cpu > 80) return 'exception';
    if (cpu > 60) return 'active';
    return 'success';
  };

  // Get memory status for progress bar
  const getMemoryStatus = (memory: number): 'success' | 'normal' | 'exception' | 'active' => {
    if (memory > 80) return 'exception';
    if (memory > 60) return 'active';
    return 'success';
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 16, fontSize: '1.2rem', fontWeight: 600 }}>
        {t('monitoring.serviceHealth', 'Service Health Matrix')}
      </h3>
      <Row gutter={[16, 16]}>
        {services.map(service => (
          <Col xs={24} sm={12} md={8} lg={6} key={service.id}>
            <Card
              className={`service-card service-${service.status}`}
              hoverable
              style={{
                height: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                transition: 'all 0.3s ease',
              }}
              bodyStyle={{ padding: 16 }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{service.icon}</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
                  {service.displayName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  Port {service.port}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Statistic
                  title={<span style={{ fontSize: '0.75rem' }}>{t('monitoring.throughput', 'Throughput')}</span>}
                  value={service.throughput}
                  suffix="items/s"
                  prefix={<ThunderboltOutlined />}
                  valueStyle={{ fontSize: '1.2rem' }}
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                    <DatabaseOutlined /> {t('monitoring.cpu', 'CPU')}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{service.cpu}%</span>
                </div>
                <Progress
                  percent={service.cpu}
                  status={getCpuStatus(service.cpu)}
                  showInfo={false}
                  strokeColor={{
                    '0%': '#1890ff',
                    '100%': service.cpu > 80 ? '#ff4d4f' : service.cpu > 60 ? '#faad14' : '#52c41a',
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                    <DatabaseOutlined /> {t('monitoring.memory', 'Memory')}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{service.memory}%</span>
                </div>
                <Progress
                  percent={service.memory}
                  status={getMemoryStatus(service.memory)}
                  showInfo={false}
                  strokeColor={{
                    '0%': '#722ed1',
                    '100%': service.memory > 80 ? '#ff4d4f' : service.memory > 60 ? '#faad14' : '#52c41a',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <Tag color={getStatusColor(service.status)} style={{ marginRight: 0 }}>
                    {service.status.toUpperCase()}
                  </Tag>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: '#888' }}>
                  <Tooltip title={t('monitoring.latency', 'Latency')}>
                    <span>
                      <ClockCircleOutlined /> {service.latency}ms
                    </span>
                  </Tooltip>
                  {service.queueDepth !== undefined && (
                    <Tooltip title={t('monitoring.queueDepth', 'Queue Depth')}>
                      <span>
                        <InboxOutlined /> {service.queueDepth}
                      </span>
                    </Tooltip>
                  )}
                  {service.restarts > 0 && (
                    <Tooltip title={t('monitoring.restarts', 'Restarts')}>
                      <span style={{ color: service.restarts > 2 ? '#ff4d4f' : '#faad14' }}>
                        <ReloadOutlined /> {service.restarts}
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default ServiceHealthGrid;
