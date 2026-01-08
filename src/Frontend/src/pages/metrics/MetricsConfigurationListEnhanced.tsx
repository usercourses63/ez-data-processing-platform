import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Card, Spin, message, Collapse, Tag, Empty, Modal, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, EyeOutlined, BellOutlined, InfoCircleOutlined } from '@ant-design/icons';
import metricsApi, { type MetricConfiguration } from '../../services/metrics-api-client';

// NOTE: Global/operational metrics tab removed - operational metrics are now hardcoded in BusinessMetrics.cs
// This page now only shows field-extraction metrics that are tied to specific data sources
const { Title, Paragraph, Text } = Typography;

interface DataSource {
  ID: string;
  Name: string;
}

interface GroupedMetrics {
  [dataSourceId: string]: {
    dataSource: DataSource | null;
    metrics: MetricConfiguration[];
  };
}

const MetricsConfigurationListEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // NOTE: globalMetrics removed - operational metrics are now hardcoded in BusinessMetrics.cs
  const [specificMetrics, setSpecificMetrics] = useState<MetricConfiguration[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [viewingMetric, setViewingMetric] = useState<MetricConfiguration | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all metrics
      const allMetrics = await metricsApi.getAll();

      // Load data sources
      const dsResponse = await fetch('/api/v1/datasource?page=1&size=100');
      const dsData = await dsResponse.json();
      if (dsData.IsSuccess && dsData.Data) {
        setDataSources(dsData.Data.Items || []);
      }

      // Only show datasource-specific metrics (field extraction metrics)
      // NOTE: Global/operational metrics are hardcoded in BusinessMetrics.cs
      const specific = allMetrics.filter(m => m.scope === 'datasource-specific' || !m.scope);
      setSpecificMetrics(specific);
    } catch (error) {
      message.error('שגיאה בטעינת מדדים');
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await metricsApi.delete(id);
      message.success(`המדד "${name}" נמחק בהצלחה`);
      loadData();
    } catch (error) {
      message.error('שגיאה במחיקת המדד');
      console.error('Error deleting metric:', error);
    }
  };

  const getStatusTag = (status: number) => {
    const statusMap: Record<number, { text: string; color: string }> = {
      0: { text: 'טיוטה', color: 'default' },
      1: { text: 'פעיל', color: 'green' },
      2: { text: 'לא פעיל', color: 'red' },
      3: { text: 'שגיאה', color: 'orange' }
    };
    const info = statusMap[status] || { text: 'לא ידוע', color: 'default' };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const getPrometheusTypeTag = (type?: string) => {
    if (!type) return null; // Don't show tag if no type
    
    const typeMap: Record<string, string> = {
      gauge: 'Gauge',
      counter: 'Counter',
      histogram: 'Histogram',
      summary: 'Summary'
    };
    return <Tag color="blue">{typeMap[type] || type}</Tag>;
  };

  const renderMetricCard = (metric: MetricConfiguration) => {
    const alertRules = (metric as any).alertRules || [];
    const hasAlerts = alertRules.length > 0;
    const dataSourceName = (metric as any).dataSourceName;

    return (
      <Card
        key={metric.id}
        size="small"
        style={{ marginBottom: 4 }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space direction="vertical" size={2} style={{ flex: 1 }}>
            <Space size="small" wrap>
              <Text strong style={{ fontSize: 13 }}>{metric.displayName}</Text>
              {dataSourceName && (
                <Tag color="blue" icon={<DatabaseOutlined />} style={{ fontSize: 10 }}>
                  {dataSourceName}
                </Tag>
              )}
              {getStatusTag(metric.status)}
              {getPrometheusTypeTag(metric.prometheusType)}
              {metric.category && <Tag color="purple" style={{ fontSize: 10 }}>{metric.category}</Tag>}
              {hasAlerts && (
                <Tag color="orange" icon={<BellOutlined />} style={{ fontSize: 10 }}>
                  {alertRules.length} התראות
                </Tag>
              )}
            </Space>
            <Space size="small" wrap style={{ fontSize: 11 }}>
              <Tag style={{ fontFamily: 'monospace', fontSize: 10, margin: 0 }}>{metric.name}</Tag>
              {metric.fieldPath && <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>{metric.fieldPath}</Tag>}
              {metric.labels && metric.labels.length > 0 && (
                <Text type="secondary" style={{ fontSize: 10 }}>
                  תוויות: {metric.labels.join(', ')}
                </Text>
              )}
            </Space>
            {metric.description && (
              <Text type="secondary" style={{ fontSize: 11 }}>{metric.description}</Text>
            )}
          </Space>
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setViewingMetric(metric)}
              title="צפה"
            />
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/metrics/edit/${metric.id}`)}
              title="ערוך"
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (window.confirm(`האם למחוק את המדד "${metric.displayName}"?`)) {
                  handleDelete(metric.id, metric.displayName);
                }
              }}
              title="מחק"
            />
          </Space>
        </div>
      </Card>
    );
  };

  const groupMetricsByDataSource = (): GroupedMetrics => {
    const grouped: GroupedMetrics = {};

    specificMetrics.forEach(metric => {
      const dsId = metric.dataSourceId || 'unknown';
      if (!grouped[dsId]) {
        const ds = dataSources.find(d => d.ID === dsId);
        grouped[dsId] = {
          dataSource: ds || null,
          metrics: []
        };
      }
      grouped[dsId].metrics.push(metric);
    });

    return grouped;
  };

  const groupedMetrics = groupMetricsByDataSource();

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            הגדרת מדדים
          </Title>
          <Paragraph className="page-subtitle">
            נהל מדדים עסקיים ומדדי מערכת
          </Paragraph>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadData}
            loading={loading}
          >
            רענן
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => navigate('/metrics/new')}
          >
            יצירת מדד
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* Info alert about operational metrics */}
        <Alert
          message="מדדים תפעוליים"
          description="מדדים תפעוליים כלליים (רשומות מעובדות, משימות שהושלמו, שגיאות וכו') מוגדרים אוטומטית במערכת ומוצגים בדשבורד Grafana. דף זה מיועד להגדרת מדדי חילוץ שדות ממקורות נתונים ספציפיים."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        {/* Field Extraction Metrics by Data Source */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>מדדי חילוץ שדות ({specificMetrics.length})</span>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">
              מדדים המחלצים ערכים משדות ברשומות מעובדות, מקושרים למקור נתונים ספציפי
            </Text>
            {Object.keys(groupedMetrics).length === 0 ? (
              <Empty description="אין מדדי חילוץ שדות מוגדרים" />
            ) : (
              <Collapse
                items={Object.entries(groupedMetrics).map(([dsId, group]) => ({
                  key: dsId,
                  label: (
                    <Space>
                      <DatabaseOutlined />
                      <Text strong>
                        {group.dataSource?.Name || 'מקור נתונים לא ידוע'}
                      </Text>
                      <Tag color="blue">{group.metrics.length} מדדים</Tag>
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {group.metrics.map(renderMetricCard)}
                    </Space>
                  )
                }))}
              />
            )}
          </Space>
        </Card>
      </Spin>

      {/* View Metric Details Modal */}
      <Modal
        title={viewingMetric ? viewingMetric.displayName : ''}
        open={!!viewingMetric}
        onCancel={() => setViewingMetric(null)}
        footer={[
          <Button key="close" onClick={() => setViewingMetric(null)}>
            סגור
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              if (viewingMetric) {
                navigate(`/metrics/edit/${viewingMetric.id}`);
              }
            }}
          >
            ערוך
          </Button>
        ]}
        width={700}
      >
        {viewingMetric && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" title="פרטי מדד">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">שם Prometheus:</Text><br />
                  <Tag style={{ fontFamily: 'monospace' }}>{viewingMetric.name}</Tag>
                </div>
                <div>
                  <Text type="secondary">סוג:</Text><br />
                  {getPrometheusTypeTag(viewingMetric.prometheusType)}
                </div>
                <div>
                  <Text type="secondary">סטטוס:</Text><br />
                  {getStatusTag(viewingMetric.status)}
                </div>
                {viewingMetric.description && (
                  <div>
                    <Text type="secondary">תיאור:</Text><br />
                    <Text>{viewingMetric.description}</Text>
                  </div>
                )}
                {viewingMetric.fieldPath && (
                  <div>
                    <Text type="secondary">שדה למדידה:</Text><br />
                    <Tag color="cyan">{viewingMetric.fieldPath}</Tag>
                  </div>
                )}
                {viewingMetric.category && (
                  <div>
                    <Text type="secondary">קטגוריה:</Text><br />
                    <Tag color="purple">{viewingMetric.category}</Tag>
                  </div>
                )}
                {viewingMetric.labels && viewingMetric.labels.length > 0 && (
                  <div>
                    <Text type="secondary">תוויות:</Text><br />
                    <Space wrap>
                      {viewingMetric.labels.map((label, idx) => (
                        <Tag key={idx}>{label}</Tag>
                      ))}
                    </Space>
                  </div>
                )}
                {viewingMetric.scope && (
                  <div>
                    <Text type="secondary">היקף:</Text><br />
                    <Tag>{viewingMetric.scope === 'global' ? 'גלובלי' : 'פרטני'}</Tag>
                  </div>
                )}
                {viewingMetric.dataSourceName && (
                  <div>
                    <Text type="secondary">מקור נתונים:</Text><br />
                    <Tag color="blue">{viewingMetric.dataSourceName}</Tag>
                  </div>
                )}
              </Space>
            </Card>

            {/* Alert Rules */}
            {(viewingMetric as any).alertRules && (viewingMetric as any).alertRules.length > 0 && (
              <Card 
                size="small" 
                title={
                  <Space>
                    <BellOutlined />
                    <span>כללי התראה ({(viewingMetric as any).alertRules.length})</span>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {(viewingMetric as any).alertRules.map((rule: any, idx: number) => (
                    <Card key={idx} size="small" type="inner">
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space>
                          <Text strong>{rule.name}</Text>
                          <Tag color={rule.severity === 'critical' ? 'red' : rule.severity === 'warning' ? 'orange' : 'blue'}>
                            {rule.severity}
                          </Tag>
                          {!rule.isEnabled && <Tag>מושבת</Tag>}
                        </Space>
                        <Text type="secondary" style={{ fontSize: 11 }}>{rule.description}</Text>
                        <Card size="small" style={{ backgroundColor: '#f6f8fa' }}>
                          <pre style={{ 
                            margin: 0, 
                            fontSize: 10, 
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {rule.expression}
                          </pre>
                        </Card>
                        {rule.for && (
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            For: {rule.for}
                          </Text>
                        )}
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default MetricsConfigurationListEnhanced;
