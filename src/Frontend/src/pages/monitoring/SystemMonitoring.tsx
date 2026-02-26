import React, { useEffect, useState } from 'react';
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
import {
  ServiceStatus,
  PipelineEvent,
  DashboardMetrics,
} from '../../types/monitoring.types';
import {
  PodStatus,
  DistributedTrace,
  MessageQueue,
  Alert,
  ClusterInfo,
} from '../../types/kubernetes.types';
import {
  generateServiceStatuses,
  generatePipelineEvents,
  generateDashboardMetrics,
} from '../../services/monitoring-mock-data';
import {
  generatePodStatuses,
  generateDistributedTrace,
  generateMessageQueues,
  generateRecentAlerts,
  generateClusterInfo,
} from '../../services/kubernetes-mock-data';
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

const { Title, Paragraph } = Typography;

const SystemMonitoring: React.FC = () => {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [pods, setPods] = useState<PodStatus[]>([]);
  const [trace, setTrace] = useState<DistributedTrace | null>(null);
  const [queues, setQueues] = useState<MessageQueue[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Load dashboard data
  const loadDashboardData = () => {
    try {
      setError(null);

      // Generate service statuses
      const newServices = generateServiceStatuses();
      setServices(newServices);

      // Generate dashboard metrics
      const newMetrics = generateDashboardMetrics();
      setMetrics(newMetrics);

      // Add new events (keep last 50)
      setEvents(prev => {
        const newEvents = generatePipelineEvents(2); // Add 2 new events per refresh
        return [...newEvents, ...prev].slice(0, 50);
      });

      // Generate Kubernetes data
      const newPods = generatePodStatuses();
      setPods(newPods);

      const newTrace = generateDistributedTrace();
      setTrace(newTrace);

      const newQueues = generateMessageQueues();
      setQueues(newQueues);

      const newAlerts = generateRecentAlerts();
      setAlerts(newAlerts);

      const newClusterInfo = generateClusterInfo();
      setClusterInfo(newClusterInfo);

      setLastUpdate(new Date());

      if (loading) {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
      console.error('Error loading monitoring data:', err);
      setLoading(false);
    }
  };

  // Initialize and set up auto-refresh
  useEffect(() => {
    // Initial load
    loadDashboardData();

    // Refresh every 30 seconds (matching existing Dashboard pattern)
    const interval = setInterval(loadDashboardData, 30000);

    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>{t('common.loading')}</Paragraph>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <AntAlert
        message="Error Loading Monitoring Dashboard"
        description={error}
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
      children: <DeviceHealthTab />,
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
      {clusterInfo && <ClusterHeader clusterInfo={clusterInfo} lastUpdate={lastUpdate} />}

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
