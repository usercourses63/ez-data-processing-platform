import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  InboxOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DashboardMetrics } from '../../../types/monitoring.types';

interface MetricsOverviewCardsProps {
  metrics: DashboardMetrics | null;
}

const MetricsOverviewCards: React.FC<MetricsOverviewCardsProps> = ({ metrics }) => {
  const { t } = useTranslation();

  if (!metrics) {
    return null;
  }

  // Determine success rate color
  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 99) return '#52c41a';  // green
    if (rate >= 95) return '#faad14';  // yellow
    return '#ff4d4f';                   // red
  };

  // Determine error rate color
  const getErrorRateColor = (rate: number): string => {
    if (rate < 0.5) return '#52c41a';  // green
    if (rate < 2) return '#faad14';    // yellow
    return '#ff4d4f';                   // red
  };

  // Determine latency color
  const getLatencyColor = (latency: number): string => {
    if (latency < 100) return '#52c41a';  // green
    if (latency < 200) return '#faad14';  // yellow
    return '#ff4d4f';                      // red
  };

  return (
    <Row gutter={[16, 16]} className="metrics-overview" style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Statistic
            title={t('monitoring.totalThroughput', 'Total Throughput')}
            value={(metrics.totalThroughput ?? 0).toLocaleString()}
            suffix="rec/s"
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 600 }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Statistic
            title={t('monitoring.successRate', 'Success Rate')}
            value={metrics.successRate}
            suffix="%"
            precision={1}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: getSuccessRateColor(metrics.successRate ?? 0) }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Statistic
            title={t('monitoring.avgLatency', 'Avg Latency')}
            value={Math.round((metrics.avgLatency ?? 0) * 100) / 100}
            suffix="ms"
            precision={1}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: getLatencyColor(metrics.avgLatency ?? 0) }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Statistic
            title={t('monitoring.activeJobs', 'Active Jobs')}
            value={metrics.activeJobs}
            prefix={<CodeOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Statistic
            title={t('monitoring.queueDepth', 'Queue Depth')}
            value={(metrics.queueDepth ?? 0).toLocaleString()}
            prefix={<InboxOutlined />}
            valueStyle={{ color: '#13c2c2' }}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={8} lg={4}>
        <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <Statistic
            title={t('monitoring.errorRate', 'Error Rate')}
            value={metrics.errorRate}
            suffix="%"
            precision={2}
            prefix={<WarningOutlined />}
            valueStyle={{ color: getErrorRateColor(metrics.errorRate) }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default MetricsOverviewCards;
