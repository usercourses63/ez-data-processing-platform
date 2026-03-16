import React, { useState } from 'react';
import { Row, Col, Typography, Spin, Alert as AntAlert, Tabs } from 'antd';
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

  const hubUrl = `${window.location.protocol}//${window.location.host}/hubs/monitoring`;

  const {
    connectionState, isConnected,
    deviceHealth, services, pods, metrics, queues, alerts, trace, clusterInfo, events, lastUpdate
  } = useMonitoringHub(hubUrl);

  // Loading state: only show spinner on initial connection before any data arrives
  if (connectionState === 'connecting' && !lastUpdate) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>{t('monitoring.connection.connecting')}</Paragraph>
      </div>
    );
  }

  // Error state: disconnected and never received data
  if (connectionState === 'disconnected' && !lastUpdate) {
    return (
      <AntAlert
        message={t('monitoring.connection.error')}
        description={t('monitoring.connection.errorBody')}
        type="error"
        showIcon
        style={{ margin: 24 }}
      />
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
          {/* Pipeline Flow + Event Stream */}
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} xl={16}>
              <PipelineFlow services={services} />
            </Col>
            <Col xs={24} xl={8}>
              <EventStream events={events} />
            </Col>
          </Row>

          {/* Service Health Grid */}
          <ServiceHealthGrid services={services} />

          {/* Performance Charts */}
          <PerformanceCharts metrics={metrics} />
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
      children: <PodStatusTable pods={pods} />,
    },
    {
      key: 'traces',
      label: (
        <span>
          <BarChartOutlined />
          {t('monitoring.traces')}
        </span>
      ),
      children: trace && <DistributedTracing trace={trace} />,
    },
    {
      key: 'queues',
      label: (
        <span>
          <InboxOutlined />
          {t('monitoring.queues')}
        </span>
      ),
      children: <MessageQueues queues={queues} />,
    },
    {
      key: 'alerts',
      label: (
        <span>
          <BellOutlined />
          {t('monitoring.alerts')}
        </span>
      ),
      children: <RecentAlerts alerts={alerts} />,
    },
  ];

  return (
    <div className="monitoring-dashboard">
      {/* Cluster Header - Common section */}
      {clusterInfo && <ClusterHeader clusterInfo={clusterInfo} lastUpdate={lastUpdate ?? new Date()} connectionState={connectionState} />}

      {/* Top-level Metrics Overview - Common section */}
      <MetricsOverviewCards metrics={metrics} />

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
