import React from 'react';
import { Row, Col, Card } from 'antd';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { DashboardMetrics } from '../../../types/monitoring.types';
import { generateLatencyDistribution, generateSuccessFailureMetrics } from '../../../services/monitoring-mock-data';
import { format } from 'date-fns';

interface PerformanceChartsProps {
  metrics: DashboardMetrics | null;
}

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ metrics }) => {
  const { t } = useTranslation();

  if (!metrics) {
    return null;
  }

  // Get latency distribution
  const latencyDist = generateLatencyDistribution();
  const latencyData = [
    { name: 'P50', latency: latencyDist.p50, fill: '#52c41a' },
    { name: 'P75', latency: latencyDist.p75, fill: '#52c41a' },
    { name: 'P90', latency: latencyDist.p90, fill: '#faad14' },
    { name: 'P95', latency: latencyDist.p95, fill: '#faad14' },
    { name: 'P99', latency: latencyDist.p99, fill: '#ff4d4f' },
  ];

  // Get success/failure metrics
  const successFailure = generateSuccessFailureMetrics();
  const pieData = [
    { name: 'Success', value: successFailure.successCount, color: '#52c41a' },
    { name: 'Failure', value: successFailure.failureCount, color: '#ff4d4f' },
  ];

  // Format throughput data for chart
  const throughputData = metrics.throughputHistory.map(point => ({
    time: format(point.timestamp, 'HH:mm'),
    value: point.value,
  }));

  // Format latency data for chart
  const latencyHistoryData = metrics.latencyHistory.map(point => ({
    time: format(point.timestamp, 'HH:mm'),
    value: point.value,
  }));

  // Format error data for chart
  const errorData = metrics.errorHistory.map(point => ({
    time: format(point.timestamp, 'HH:mm'),
    value: point.value,
  }));

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 16, fontSize: '1.2rem', fontWeight: 600 }}>
        {t('monitoring.performanceMetrics', 'Performance Metrics')}
      </h3>
      <Row gutter={[24, 24]}>
        {/* Throughput Line Chart */}
        <Col xs={24} lg={12}>
          <Card title={t('monitoring.throughputTrend', 'Throughput Trend (records/sec)')}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={throughputData}>
                <defs>
                  <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} rec/s`, 'Throughput']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1890ff"
                  strokeWidth={2}
                  dot={{ fill: '#1890ff', r: 3 }}
                  activeDot={{ r: 5 }}
                  fill="url(#colorThroughput)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Latency Distribution Bar Chart */}
        <Col xs={24} lg={12}>
          <Card title={t('monitoring.latencyDistribution', 'Latency Distribution (ms)')}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                  }}
                  formatter={(value: number) => [`${value}ms`, 'Latency']}
                />
                <Bar dataKey="latency" radius={[8, 8, 0, 0]}>
                  {latencyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Latency History Line Chart */}
        <Col xs={24} lg={12}>
          <Card title={t('monitoring.latencyTrend', 'Latency Trend (ms)')}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={latencyHistoryData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#722ed1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#722ed1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                  }}
                  formatter={(value: number) => [`${value}ms`, 'Latency']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#722ed1"
                  strokeWidth={2}
                  dot={{ fill: '#722ed1', r: 3 }}
                  activeDot={{ r: 5 }}
                  fill="url(#colorLatency)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Error Rate Area Chart */}
        <Col xs={24} lg={12}>
          <Card title={t('monitoring.errorRateTrend', 'Error Rate Trend (%)')}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={errorData}>
                <defs>
                  <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Error Rate']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#ff4d4f"
                  strokeWidth={2}
                  fill="url(#colorError)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Success vs Failure Pie Chart */}
        <Col xs={24} lg={12}>
          <Card title={t('monitoring.successVsFailure', 'Success vs Failure')}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${entry.value.toLocaleString()}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 4,
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '0.9rem' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: '1.2rem', fontWeight: 600 }}>
              {successFailure.successRate.toFixed(2)}% Success Rate
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PerformanceCharts;
