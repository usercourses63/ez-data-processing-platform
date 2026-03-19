import React, { useState } from 'react';
import { Row, Col, Typography, Spin, Tabs, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DashboardOutlined,
  HeartOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  InboxOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useMonitoringHub } from '../../hooks/useMonitoringHub';
import ClusterHeader from './components/ClusterHeader';
import MetricsOverviewCards from './components/MetricsOverviewCards';
import PipelineFlow from './components/PipelineFlow';
import EventStream from './components/EventStream';
import ServiceHealthGrid from './components/ServiceHealthGrid';
import PerformanceCharts from './components/PerformanceCharts';
import PodStatusTable from './components/PodStatusTable';
import DistributedTracing from './components/DistributedTracing';
import MessageQueues from './components/MessageQueues';
import RecentAlerts from './components/RecentAlerts';
import DeviceHealthTab from './components/DeviceHealthTab';
import './SystemMonitoring.css';

const { Paragraph } = Typography;

const SystemMonitoring: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // SignalR real-time data
  const hubUrl = `${window.location.protocol}//${window.location.host}/hubs/monitoring`;
  const {
    connectionState, isConnected,
    deviceHealth,
    services,
    pods,
    metrics,
    queues,
    alerts,
    trace,
    clusterInfo,
    events,
    lastUpdate
  } = useMonitoringHub(hubUrl);

  // Data is "loading" until first SignalR broadcast arrives
  const hasReceivedData = services.length > 0 || metrics !== null || pods.length > 0;

  // Show initial connecting state only if not connected AND no data yet
  if (connectionState === 'connecting' && !hasReceivedData) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>{t('common.loading')}</Paragraph>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined />
          {t('monitoring.overview')}
        </span>
      ),
      children: (
        <>
          {services.length === 0 && !hasReceivedData ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <>
              <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                <Col xs={24} xl={16}>
                  <PipelineFlow services={services} />
                </Col>
                <Col xs={24} xl={8}>
                  <EventStream events={events} />
                </Col>
              </Row>
              <ServiceHealthGrid services={services} />
              <PerformanceCharts metrics={metrics} />
            </>
          )}
        </>
      ),
    },
    {
      key: 'deviceHealth',
      label: (
        <span>
          <HeartOutlined />
          {t('monitoring.deviceHealth.title')}
        </span>
      ),
      children: <DeviceHealthTab signalRData={deviceHealth} isSignalRConnected={isConnected} />,
    },
    {
      key: 'pods',
      label: (
        <span>
          <AppstoreOutlined />
          {t('monitoring.pods')}
        </span>
      ),
      children: pods.length === 0 && !hasReceivedData ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <PodStatusTable pods={pods} />
      ),
    },
    {
      key: 'traces',
      label: (
        <span>
          <BarChartOutlined />
          {t('monitoring.traces')}
        </span>
      ),
      children: trace === null && !hasReceivedData ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        trace && <DistributedTracing trace={trace} />
      ),
    },
    {
      key: 'queues',
      label: (
        <span>
          <InboxOutlined />
          {t('monitoring.queues')}
        </span>
      ),
      children: queues.length === 0 && !hasReceivedData ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <MessageQueues queues={queues} />
      ),
    },
    {
      key: 'alerts',
      label: (
        <span>
          <BellOutlined />
          {t('monitoring.alerts')}
        </span>
      ),
      children: alerts.length === 0 && !hasReceivedData ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <RecentAlerts alerts={alerts} />
      ),
    },
  ];

  return (
    <div className="monitoring-dashboard">
      {/* Cluster Header - Common section */}
      {clusterInfo ? (
        <ClusterHeader clusterInfo={clusterInfo} lastUpdate={lastUpdate ?? new Date()} connectionState={connectionState} />
      ) : (
        <Skeleton active paragraph={{ rows: 2 }} />
      )}

      {/* Top-level Metrics Overview - Common section */}
      {metrics ? <MetricsOverviewCards metrics={metrics} /> : <Skeleton active paragraph={{ rows: 1 }} />}

      {/* Tabbed Content */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="monitoring-tabs"
        size="large"
      />
    </div>
  );
};

export default SystemMonitoring;
