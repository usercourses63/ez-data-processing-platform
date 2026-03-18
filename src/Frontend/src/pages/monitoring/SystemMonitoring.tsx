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

  // Mock data state — used as fallback until SignalR provides real data
  const [mockServices, setMockServices] = useState<ServiceStatus[]>([]);
  const [mockMetrics, setMockMetrics] = useState<DashboardMetrics | null>(null);
  const [mockEvents, setMockEvents] = useState<PipelineEvent[]>([]);
  const [mockPods, setMockPods] = useState<PodStatus[]>([]);
  const [mockTrace, setMockTrace] = useState<DistributedTrace | null>(null);
  const [mockQueues, setMockQueues] = useState<MessageQueue[]>([]);
  const [mockAlerts, setMockAlerts] = useState<Alert[]>([]);
  const [mockClusterInfo, setMockClusterInfo] = useState<ClusterInfo | null>(null);
  const [mockLastUpdate, setMockLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SignalR real-time data
  const hubUrl = `${window.location.protocol}//${window.location.host}/hubs/monitoring`;
  const {
    connectionState, isConnected,
    deviceHealth,
    services: signalRServices,
    pods: signalRPods,
    metrics: signalRMetrics,
    queues: signalRQueues,
    alerts: signalRAlerts,
    trace: signalRTrace,
    clusterInfo: signalRClusterInfo,
    events: signalREvents,
    lastUpdate: signalRLastUpdate
  } = useMonitoringHub(hubUrl);

  // Use SignalR data when available, fall back to mock data
  const services = signalRServices.length > 0 ? signalRServices : mockServices;
  const metrics = signalRMetrics ?? mockMetrics;
  const events = signalREvents.length > 0 ? signalREvents : mockEvents;
  const pods = signalRPods.length > 0 ? signalRPods : mockPods;
  const trace = signalRTrace ?? mockTrace;
  const queues = signalRQueues.length > 0 ? signalRQueues : mockQueues;
  const alerts = signalRAlerts.length > 0 ? signalRAlerts : mockAlerts;
  const clusterInfo = signalRClusterInfo ?? mockClusterInfo;
  const lastUpdate = signalRLastUpdate ?? mockLastUpdate;

  // Load mock data as initial fallback
  const loadDashboardData = () => {
    try {
      setError(null);

      const newServices = generateServiceStatuses();
      setMockServices(newServices);

      const newMetrics = generateDashboardMetrics();
      setMockMetrics(newMetrics);

      setMockEvents(prev => {
        const newEvents = generatePipelineEvents(2);
        return [...newEvents, ...prev].slice(0, 50);
      });

      const newPods = generatePodStatuses();
      setMockPods(newPods);

      const newTrace = generateDistributedTrace();
      setMockTrace(newTrace);

      const newQueues = generateMessageQueues();
      setMockQueues(newQueues);

      const newAlerts = generateRecentAlerts();
      setMockAlerts(newAlerts);

      const newClusterInfo = generateClusterInfo();
      setMockClusterInfo(newClusterInfo);

      setMockLastUpdate(new Date());

      if (loading) {
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
      console.error('Error loading monitoring data:', err);
      setLoading(false);
    }
  };

  // Initialize mock data immediately, refresh as fallback when SignalR is disconnected
  useEffect(() => {
    loadDashboardData();

    // Only run mock refresh interval when SignalR is NOT connected
    if (!isConnected) {
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

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
      {clusterInfo && <ClusterHeader clusterInfo={clusterInfo} lastUpdate={lastUpdate} connectionState={connectionState} />}

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
