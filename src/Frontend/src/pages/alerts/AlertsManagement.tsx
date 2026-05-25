import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Button, Space, Card, Spin, message, Table, Tag, Empty, Modal, Form, Input, Select, Alert as AntAlert, Collapse, Checkbox, Divider, Tabs, Switch, Row, Col, Tooltip, notification } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, BellOutlined, InfoCircleOutlined, SearchOutlined, SettingOutlined, CodeOutlined } from '@ant-design/icons';
import metricsApi, {
  type MetricConfiguration,
  type GlobalAlertConfiguration,
  type CreateGlobalAlertRequest
} from '../../services/metrics-api-client';
import PromQLExpressionHelperDialog, {
  GLOBAL_BUSINESS_METRICS,
  SYSTEM_METRICS,
  BUSINESS_METRIC_CATEGORIES,
  SYSTEM_METRIC_CATEGORIES,
  type AvailableMetric
} from '../../components/metrics/PromQLExpressionHelperDialog';
import EnhancedLabelInput from '../../components/metrics/EnhancedLabelInput';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const Alert = AntAlert; // Alias to avoid conflict with AlertRule interface
const { Option } = Select;

interface AlertRule {
  id?: string;
  name: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  expression: string;
  for?: string;
  isEnabled: boolean;
  notificationRecipients?: string[];
  metricId: string;
  metricName?: string;
  metricDisplayName?: string;
  labels?: Record<string, string>;
}

interface AlertFormData {
  name: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  expression: string;
  for?: string;
  isEnabled: boolean;
  notificationRecipients?: string;
  // Separate metric selections for each category
  datasourceMetricIds?: string[];
  businessMetricIds?: string[];
  systemMetricIds?: string[];
  // Labels configuration for PromQL filtering
  labelNames?: string;
  labelsExpression?: string;
  labels?: { key: string; value: string }[];
}

// Extended AlertRule to track alert source type
interface ExtendedAlertRule extends AlertRule {
  sourceType: 'datasource' | 'business' | 'system';
  globalAlertId?: string; // ID from GlobalAlertConfiguration for business/system alerts
}

const AlertsManagement: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [allMetrics, setAllMetrics] = useState<MetricConfiguration[]>([]);
  const [alerts, setAlerts] = useState<ExtendedAlertRule[]>([]);
  const [globalAlerts, setGlobalAlerts] = useState<GlobalAlertConfiguration[]>([]);
  const [editingAlert, setEditingAlert] = useState<ExtendedAlertRule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('alerts');

  // Filters for alerts table
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [metricFilter, setMetricFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);  // enabled/disabled
  const [datasourceCategoryFilter, setDatasourceCategoryFilter] = useState<string | null>(null);
  const [datasourceSupplierFilter, setDatasourceSupplierFilter] = useState<string | null>(null);

  // Smart filters for metric selection in modal
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string | null>(null);
  const [modalTypeFilter, setModalTypeFilter] = useState<string | null>(null);
  const [modalDatasourceFilter, setModalDatasourceFilter] = useState<string | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  // Category filters for business and system metrics
  const [businessCategoryFilter, setBusinessCategoryFilter] = useState<string | null>(null);
  const [systemCategoryFilter, setSystemCategoryFilter] = useState<string | null>(null);
  // Validation errors state for displaying prominent error message
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // PromQL Helper Dialog state
  const [showPromQLHelper, setShowPromQLHelper] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all metrics and global alerts in parallel
      const [metrics, fetchedGlobalAlerts] = await Promise.all([
        metricsApi.getAll(),
        metricsApi.getGlobalAlerts()
      ]);

      setAllMetrics(metrics);
      setGlobalAlerts(fetchedGlobalAlerts);

      // Extract all alert rules from datasource metrics
      const allAlerts: ExtendedAlertRule[] = [];

      // 1. Datasource metric alerts (embedded in MetricConfiguration)
      metrics.forEach(metric => {
        const metricAlerts = (metric as any).alertRules || [];
        metricAlerts.forEach((alert: any, idx: number) => {
          allAlerts.push({
            id: alert.id || `${metric.id}-alert-${idx}`,
            name: alert.name || `Alert ${idx + 1}`,
            description: alert.description,
            severity: alert.severity || 'warning',
            expression: alert.expression || alert.condition,
            for: alert.for || alert.duration,
            isEnabled: alert.isEnabled !== false,
            notificationRecipients: alert.notificationRecipients,
            metricId: metric.id,
            metricName: metric.name,
            metricDisplayName: metric.displayName,
            sourceType: 'datasource',
            labels: alert.labels
          });
        });
      });

      // 2. Global alerts (business and system metrics)
      fetchedGlobalAlerts.forEach((globalAlert) => {
        allAlerts.push({
          id: globalAlert.id,
          name: globalAlert.alertName,
          description: globalAlert.description,
          severity: globalAlert.severity,
          expression: globalAlert.expression,
          for: globalAlert.for,
          isEnabled: globalAlert.isEnabled,
          notificationRecipients: globalAlert.notificationRecipients,
          metricId: `${globalAlert.metricType}:${globalAlert.metricName}`,
          metricName: globalAlert.metricName,
          metricDisplayName: globalAlert.metricName,
          sourceType: globalAlert.metricType as 'business' | 'system',
          globalAlertId: globalAlert.id,
          labels: globalAlert.labels
        });
      });

      setAlerts(allAlerts);
    } catch (error) {
      message.error(t('alerts.messages.loadError'));
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = () => {
    form.resetFields();
    form.setFieldsValue({
      severity: 'warning',
      isEnabled: true,
      for: '5m'
    });
    setEditingAlert(null);
    resetModalFilters();
    setValidationErrors([]); // Clear any previous validation errors
    setIsModalOpen(true);
  };

  const handleEditAlert = (alert: ExtendedAlertRule) => {
    // Use sourceType to determine metric category
    const isDatasourceMetric = alert.sourceType === 'datasource';
    const isBusinessMetric = alert.sourceType === 'business';
    const isSystemMetric = alert.sourceType === 'system';

    // For business/system alerts, extract the metric name from the metricId
    const metricName = isBusinessMetric || isSystemMetric
      ? alert.metricId.split(':')[1] || alert.metricName
      : null;

    // Convert labels Record to array format for form
    const labelsArray = alert.labels
      ? Object.entries(alert.labels).map(([key, value]) => ({ key, value }))
      : [];
    const labelNamesStr = alert.labels
      ? Object.keys(alert.labels).join(', ')
      : '';

    form.setFieldsValue({
      name: alert.name,
      description: alert.description,
      severity: alert.severity,
      expression: alert.expression,
      for: alert.for,
      isEnabled: alert.isEnabled,
      notificationRecipients: alert.notificationRecipients?.join(', '),
      datasourceMetricIds: isDatasourceMetric ? [alert.metricId] : [],
      businessMetricIds: isBusinessMetric && metricName ? [metricName] : [],
      systemMetricIds: isSystemMetric && metricName ? [metricName] : [],
      labels: labelsArray,
      labelNames: labelNamesStr
    });
    setEditingAlert(alert);
    setValidationErrors([]); // Clear any previous validation errors
    setIsModalOpen(true);
  };

  const handleDeleteAlert = async (alert: ExtendedAlertRule) => {
    if (!window.confirm(t('alerts.confirmDelete', { name: alert.name }))) {
      return;
    }

    try {
      // Check if this is a global alert (business/system metric)
      if (alert.globalAlertId && (alert.sourceType === 'business' || alert.sourceType === 'system')) {
        // Delete via global alerts API
        await metricsApi.deleteGlobalAlert(alert.globalAlertId);
        message.success(t('alerts.messages.deleteSuccess', { name: alert.name }));
        loadData();
        return;
      }

      // For datasource alerts, find the metric and remove the alert from it
      const metric = allMetrics.find(m => m.id === alert.metricId);
      if (metric) {
        const alertRules = ((metric as any).alertRules || []).filter((a: any) =>
          (a.id || a.name) !== (alert.id || alert.name)
        );

        await metricsApi.update(metric.id, {
          ...metric,
          alertRules
        } as any);

        message.success(t('alerts.messages.deleteSuccess', { name: alert.name }));
        loadData();
      }
    } catch (error) {
      message.error(t('alerts.messages.deleteError'));
      console.error('Error deleting alert:', error);
    }
  };

  // Debug handler for form validation failures
  const handleFormFailed = (errorInfo: any) => {
    console.log('=== Form validation FAILED ===');
    console.log('Error info:', JSON.stringify(errorInfo, null, 2));
    message.error(t('alerts.messages.formInvalid'));
  };

  // Manual form submission handler - bypasses potential onFinish issues
  const handleManualSubmit = async () => {
    console.log('=== handleManualSubmit called ===');
    try {
      const values = await form.validateFields();
      console.log('Validated values:', JSON.stringify(values, null, 2));
      await handleSaveAlert(values);
    } catch (errorInfo: any) {
      console.log('=== Manual validation FAILED ===');
      console.log('Error:', JSON.stringify(errorInfo, null, 2));
      // Show validation error message
      const errorFields = errorInfo?.errorFields || [];
      if (errorFields.length > 0) {
        const firstError = errorFields[0]?.errors?.[0] || t('alerts.messages.validationError');
        message.error(firstError);
      }
    }
  };

  const handleSaveAlert = async (values: AlertFormData) => {
    console.log('=== handleSaveAlert called ===');
    console.log('Form values:', JSON.stringify(values, null, 2));
    console.log('businessMetricIds:', values.businessMetricIds);
    console.log('systemMetricIds:', values.systemMetricIds);
    console.log('datasourceMetricIds:', values.datasourceMetricIds);
    try {
      const notificationRecipients = values.notificationRecipients
        ? values.notificationRecipients.split(',').map(r => r.trim()).filter(r => r)
        : [];

      // Note: Metric selection validation is now handled by form rules
      // The form will not submit if no metrics are selected

      // Build labels object from form values
      const labelsRecord: Record<string, string> = {};
      if (values.labels) {
        for (const label of values.labels) {
          labelsRecord[label.key] = label.value;
        }
      }

      // 1. Handle datasource metric alerts (embedded in MetricConfiguration)
      for (const metricId of (values.datasourceMetricIds || [])) {
        const metric = allMetrics.find(m => m.id === metricId);
        if (metric) {
          const alertData = {
            name: values.name,
            description: values.description,
            severity: values.severity,
            expression: values.expression,
            for: values.for,
            isEnabled: values.isEnabled,
            notificationRecipients,
            labels: Object.keys(labelsRecord).length > 0 ? labelsRecord : undefined
          };

          let alertRules = [...((metric as any).alertRules || [])];

          if (editingAlert && editingAlert.sourceType === 'datasource' && editingAlert.metricId === metricId) {
            // Update existing alert
            alertRules = alertRules.map((a: any) =>
              (a.id || a.name) === (editingAlert.id || editingAlert.name) ? alertData : a
            );
          } else {
            // Add new alert
            alertRules.push(alertData);
          }

          // Construct proper UpdateMetricRequest matching backend MetricConfiguration.cs:
          // - Status: int (0=Draft, 1=Active, 2=Inactive, 3=Error)
          // - FormulaType: FormulaType enum (0=Simple, 1=PromQL, 2=Recording)
          // - Retention: string | null (e.g., "30d")
          // - LabelNames: string | null (comma-separated)
          // - Labels: string[] | null (deprecated, kept for compatibility)
          const updateRequest = {
            displayName: metric.displayName || metric.name || '',
            description: metric.description || '',
            category: metric.category || t('alerts.types.general'),
            scope: metric.scope || 'global',
            dataSourceId: metric.dataSourceId || null,
            dataSourceName: metric.dataSourceName || null,
            prometheusType: metric.prometheusType || 'gauge',
            formula: metric.formula || '',
            formulaType: 0, // FormulaType enum: 0=Simple, 1=PromQL, 2=Recording
            fieldPath: metric.fieldPath || null,
            labelNames: null, // string (comma-separated) or null
            labelsExpression: null,
            labels: null, // string[] for backward compatibility
            alertRules,
            retention: '30d', // string like "30d"
            status: 1, // int: 0=Draft, 1=Active, 2=Inactive, 3=Error
            updatedBy: 'frontend-user'
          };
          await metricsApi.update(metric.id, updateRequest);
        }
      }

      // 2. Handle business metric alerts (via GlobalAlertConfiguration API)
      for (const metricName of (values.businessMetricIds || [])) {
        if (editingAlert && editingAlert.sourceType === 'business' && editingAlert.globalAlertId) {
          // Update existing global alert
          await metricsApi.updateGlobalAlert(editingAlert.globalAlertId, {
            alertName: values.name,
            description: values.description,
            expression: values.expression,
            for: values.for,
            severity: values.severity,
            isEnabled: values.isEnabled,
            notificationRecipients,
            labels: Object.keys(labelsRecord).length > 0 ? labelsRecord : undefined,
            updatedBy: 'frontend-user'
          });
        } else {
          // Create new global alert for business metric
          const request: CreateGlobalAlertRequest = {
            metricType: 'business',
            metricName,
            alertName: values.name,
            description: values.description,
            expression: values.expression,
            for: values.for,
            severity: values.severity,
            isEnabled: values.isEnabled,
            notificationRecipients,
            labels: Object.keys(labelsRecord).length > 0 ? labelsRecord : undefined,
            createdBy: 'frontend-user'
          };
          await metricsApi.createGlobalAlert(request);
        }
      }

      // 3. Handle system metric alerts (via GlobalAlertConfiguration API)
      for (const metricName of (values.systemMetricIds || [])) {
        if (editingAlert && editingAlert.sourceType === 'system' && editingAlert.globalAlertId) {
          // Update existing global alert
          await metricsApi.updateGlobalAlert(editingAlert.globalAlertId, {
            alertName: values.name,
            description: values.description,
            expression: values.expression,
            for: values.for,
            severity: values.severity,
            isEnabled: values.isEnabled,
            notificationRecipients,
            labels: Object.keys(labelsRecord).length > 0 ? labelsRecord : undefined,
            updatedBy: 'frontend-user'
          });
        } else {
          // Create new global alert for system metric
          const request: CreateGlobalAlertRequest = {
            metricType: 'system',
            metricName,
            alertName: values.name,
            description: values.description,
            expression: values.expression,
            for: values.for,
            severity: values.severity,
            isEnabled: values.isEnabled,
            notificationRecipients,
            labels: Object.keys(labelsRecord).length > 0 ? labelsRecord : undefined,
            createdBy: 'frontend-user'
          };
          await metricsApi.createGlobalAlert(request);
        }
      }

      message.success(editingAlert ? t('alerts.messages.updateSuccess') : t('alerts.messages.createSuccess'));
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      message.error(t('alerts.messages.saveError'));
      console.error('Error saving alert:', error);
    }
  };

  const getSeverityTag = (severity: string) => {
    const severityMap: Record<string, { text: string; color: string }> = {
      critical: { text: t('alerts.severity.critical'), color: 'red' },
      warning: { text: t('alerts.severity.warning'), color: 'orange' },
      info: { text: t('alerts.severity.info'), color: 'blue' }
    };
    const info = severityMap[severity] || { text: severity, color: 'default' };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  // Filter alerts with additional filters
  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter && alert.severity !== severityFilter) return false;
    if (metricFilter && alert.metricId !== metricFilter) return false;
    if (statusFilter !== null) {
      const isEnabled = statusFilter === 'enabled';
      if (alert.isEnabled !== isEnabled) return false;
    }
    // Filter by datasource category/supplier through metric
    if (datasourceCategoryFilter || datasourceSupplierFilter) {
      const metric = allMetrics.find(m => m.id === alert.metricId);
      if (metric) {
        if (datasourceCategoryFilter && metric.category !== datasourceCategoryFilter) return false;
        if (datasourceSupplierFilter && metric.dataSourceName !== datasourceSupplierFilter) return false;
      }
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        alert.name.toLowerCase().includes(query) ||
        alert.expression.toLowerCase().includes(query) ||
        (alert.description?.toLowerCase().includes(query)) ||
        (alert.metricDisplayName?.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Get unique categories for alert table filters (always show all)
  const uniqueAlertCategories = [...new Set(
    alerts.map(a => allMetrics.find(m => m.id === a.metricId)?.category).filter(Boolean)
  )] as string[];

  // Get unique datasources - filtered by category if selected (cascading filter)
  const uniqueAlertDatasources = [...new Set(
    alerts
      .map(a => allMetrics.find(m => m.id === a.metricId))
      .filter(Boolean)
      .filter(m => !datasourceCategoryFilter || m!.category === datasourceCategoryFilter)
      .map(m => m!.dataSourceName)
      .filter(Boolean)
  )] as string[];

  // Get unique metrics for filter - filtered by datasource if selected, by category if selected (cascading filter)
  const metricsWithAlerts = [...new Set(alerts.map(a => a.metricId))]
    .map(id => allMetrics.find(m => m.id === id))
    .filter(Boolean)
    .filter(m => !datasourceCategoryFilter || m!.category === datasourceCategoryFilter)
    .filter(m => !datasourceSupplierFilter || m!.dataSourceName === datasourceSupplierFilter) as MetricConfiguration[];

  // Get unique values for smart filters in modal
  const uniqueCategories = [...new Set(allMetrics.map(m => m.category).filter(Boolean))];
  const uniqueTypes = [...new Set(allMetrics.map(m => (m as any).prometheusType).filter(Boolean))];
  const uniqueDatasources = [...new Set(allMetrics.map(m => m.dataSourceName).filter(Boolean))];

  // Filter metrics for modal selection
  const filteredModalMetrics = allMetrics.filter(metric => {
    if (modalCategoryFilter && metric.category !== modalCategoryFilter) return false;
    if (modalTypeFilter && (metric as any).prometheusType !== modalTypeFilter) return false;
    if (modalDatasourceFilter && metric.dataSourceName !== modalDatasourceFilter) return false;
    if (modalSearchQuery) {
      const query = modalSearchQuery.toLowerCase();
      return (
        metric.name.toLowerCase().includes(query) ||
        metric.displayName.toLowerCase().includes(query) ||
        (metric.description?.toLowerCase().includes(query)) ||
        (metric.fieldPath?.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Reset modal filters when opening
  const resetModalFilters = () => {
    setModalCategoryFilter(null);
    setModalTypeFilter(null);
    setModalDatasourceFilter(null);
    setModalSearchQuery('');
    setBusinessCategoryFilter(null);
    setSystemCategoryFilter(null);
  };

  // Filter business metrics by category and search
  const filteredBusinessMetrics = GLOBAL_BUSINESS_METRICS.filter(m => {
    if (businessCategoryFilter && m.category !== businessCategoryFilter) return false;
    if (modalSearchQuery) {
      const query = modalSearchQuery.toLowerCase();
      return m.name.toLowerCase().includes(query) ||
             m.displayName.toLowerCase().includes(query) ||
             (m.description?.toLowerCase().includes(query));
    }
    return true;
  });

  // Filter system metrics by category and search
  const filteredSystemMetrics = SYSTEM_METRICS.filter(m => {
    if (systemCategoryFilter && m.category !== systemCategoryFilter) return false;
    if (modalSearchQuery) {
      const query = modalSearchQuery.toLowerCase();
      return m.name.toLowerCase().includes(query) ||
             m.displayName.toLowerCase().includes(query) ||
             (m.description?.toLowerCase().includes(query));
    }
    return true;
  });

  // Get selected metrics from form for PromQL helper - uses separate fields
  const getSelectedMetricsForHelper = (): {
    datasource: AvailableMetric[];
    business: AvailableMetric[];
    system: AvailableMetric[];
  } => {
    // Get selections from each separate dropdown
    const datasourceIds: string[] = form.getFieldValue('datasourceMetricIds') || [];
    const businessIds: string[] = form.getFieldValue('businessMetricIds') || [];
    const systemIds: string[] = form.getFieldValue('systemMetricIds') || [];

    // Datasource metrics
    const datasourceMetrics = allMetrics
      .filter(m => datasourceIds.includes(m.id))
      .map(m => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description,
        prometheusType: (m as any).prometheusType
      }));

    // Business metrics
    const businessMetrics = GLOBAL_BUSINESS_METRICS.filter(m => businessIds.includes(m.name));

    // System metrics
    const systemMetrics = SYSTEM_METRICS.filter(m => systemIds.includes(m.name));

    return { datasource: datasourceMetrics, business: businessMetrics, system: systemMetrics };
  };

  const columns = [
    {
      title: t('alerts.columns.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ExtendedAlertRule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 11 }}>{record.description}</Text>
          )}
        </Space>
      )
    },
    {
      title: 'Metric',
      key: 'metric',
      render: (_: any, record: ExtendedAlertRule) => {
        const colorMap = {
          datasource: 'blue',
          business: 'green',
          system: 'orange'
        };
        const labelMap = {
          datasource: t('alerts.columns.dataSource'),
          business: t('alerts.types.business'),
          system: t('alerts.types.system')
        };
        return (
          <Space direction="vertical" size={0}>
            <Tag color={colorMap[record.sourceType] || 'blue'}>
              {record.metricDisplayName || record.metricName}
            </Tag>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {labelMap[record.sourceType] || record.sourceType}
            </Text>
          </Space>
        );
      }
    },
    {
      title: t('alerts.columns.severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => getSeverityTag(severity)
    },
    {
      title: t('alerts.columns.expression'),
      dataIndex: 'expression',
      key: 'expression',
      render: (text: string) => (
        <Text code style={{ fontSize: 11, maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {text}
        </Text>
      )
    },
    {
      title: t('alerts.columns.status'),
      key: 'status',
      render: (_: any, record: AlertRule) => (
        <Tag color={record.isEnabled ? 'green' : 'default'}>
          {record.isEnabled ? t('alerts.status.enabled') : t('alerts.status.disabled')}
        </Tag>
      )
    },
    {
      title: t('alerts.columns.tags'),
      key: 'labels',
      render: (_: any, record: AlertRule) => {
        const labels = record.labels;
        if (!labels || Object.keys(labels).length === 0) {
          return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
        }
        return (
          <Space size={2} wrap>
            {Object.entries(labels).slice(0, 3).map(([key, value]) => (
              <Tooltip key={key} title={`${key}=${value}`}>
                <Tag style={{ fontSize: 10, margin: 1 }}>
                  {key}={value.length > 10 ? value.slice(0, 10) + '...' : value}
                </Tag>
              </Tooltip>
            ))}
            {Object.keys(labels).length > 3 && (
              <Tooltip title={Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(', ')}>
                <Tag style={{ fontSize: 10, margin: 1 }}>+{Object.keys(labels).length - 3}</Tag>
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: t('alerts.columns.actions'),
      key: 'actions',
      width: 120,
      render: (_: any, record: ExtendedAlertRule) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditAlert(record)}
            title={t('alerts.actions.edit')}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAlert(record)}
            title={t('alerts.actions.delete')}
          />
        </Space>
      )
    }
  ];

  // Generate expression helper from selected metrics - uses separate fields
  const generateExpressionHelper = () => {
    // Get selections from separate dropdowns
    const datasourceIds: string[] = form.getFieldValue('datasourceMetricIds') || [];
    const businessIds: string[] = form.getFieldValue('businessMetricIds') || [];
    const systemIds: string[] = form.getFieldValue('systemMetricIds') || [];

    // Parse selected metrics from different categories
    const datasourceMetrics = allMetrics.filter(m => datasourceIds.includes(m.id));
    const selectedBusinessMetrics = GLOBAL_BUSINESS_METRICS.filter(m => businessIds.includes(m.name));
    const selectedSystemMetrics = SYSTEM_METRICS.filter(m => systemIds.includes(m.name));

    const allSelectedMetrics = [
      ...datasourceMetrics.map(m => ({ name: m.name, displayName: m.displayName, type: 'datasource', prometheusType: (m as any).prometheusType })),
      ...selectedBusinessMetrics.map(m => ({ name: m.name, displayName: m.displayName, type: 'business', prometheusType: m.prometheusType })),
      ...selectedSystemMetrics.map(m => ({ name: m.name, displayName: m.displayName, type: 'system', prometheusType: m.prometheusType }))
    ];

    if (allSelectedMetrics.length === 0) return null;

    return (
      <Collapse size="small" style={{ marginTop: 8 }}>
        <Collapse.Panel header={t('alerts.helper.title')} key="1">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text type="secondary">{t('alerts.helper.availableMetrics')}</Text>
            {allSelectedMetrics.map((metric, idx) => (
              <Card
                key={`${metric.type}-${idx}`}
                size="small"
                style={{
                  backgroundColor: metric.type === 'business' ? '#f6ffed' :
                    metric.type === 'system' ? '#fff7e6' : '#fafafa'
                }}
              >
                <Space direction="vertical" size={0}>
                  <Space>
                    <Text strong>{metric.displayName}</Text>
                    <Tag
                      color={metric.type === 'business' ? 'green' :
                        metric.type === 'system' ? 'orange' : 'blue'}
                      style={{ fontSize: 9 }}
                    >
                      {metric.type === 'business' ? t('alerts.types.business') :
                        metric.type === 'system' ? t('alerts.types.system') : t('alerts.columns.dataSource')}
                    </Tag>
                  </Space>
                  <Text code copyable style={{ fontSize: 11 }}>{metric.name}</Text>
                  {metric.prometheusType && (
                    <Text type="secondary" style={{ fontSize: 10 }}>{t('alerts.helper.typePrefix')} {metric.prometheusType}</Text>
                  )}
                </Space>
              </Card>
            ))}
            <Divider style={{ margin: '8px 0' }} />
            <Text type="secondary">{t('alerts.helper.expressionExamples')}</Text>
            <Space direction="vertical" size={4}>
              <Text code style={{ fontSize: 11 }}>{`${allSelectedMetrics[0]?.name || 'metric_name'} > 100`}</Text>
              <Text code style={{ fontSize: 11 }}>{`rate(${allSelectedMetrics[0]?.name || 'metric_name'}[5m]) > 10`}</Text>
              {allSelectedMetrics.length > 1 && (
                <Text code style={{ fontSize: 11 }}>{`${allSelectedMetrics[0]?.name} > 100 OR ${allSelectedMetrics[1]?.name} > 50`}</Text>
              )}
            </Space>
          </Space>
        </Collapse.Panel>
      </Collapse>
    );
  };

  // Settings tab content
  const renderSettingsTab = () => (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>{t('alerts.settings.title')}</Title>
        <Form form={settingsForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={t('alerts.settings.defaultEmailRecipients')}
                name="defaultEmails"
              >
                <Input placeholder="admin@company.com, data-team@company.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Slack Webhook URL"
                name="slackWebhook"
              >
                <Input placeholder="https://hooks.slack.com/services/..." />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={t('alerts.settings.frequency')}
                name="frequency"
              >
                <Select defaultValue="immediate">
                  <Option value="immediate">{t('alerts.settings.immediate')}</Option>
                  <Option value="5min">{t('alerts.settings.every5min')}</Option>
                  <Option value="15min">{t('alerts.settings.every15min')}</Option>
                  <Option value="1hour">{t('alerts.settings.everyHour')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={t('alerts.settings.enableAlerts')}
                name="enabled"
                valuePropName="checked"
              >
                <Switch defaultChecked />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary">
              {t('alerts.settings.save')}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Email Templates */}
      <Card>
        <Title level={4}>{t('alerts.templates.title')}</Title>
        <Row gutter={16}>
          <Col span={12}>
            <Card size="small" title={t('alerts.templates.email')}>
              <div style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {t('alerts.templates.subject', { system: t('alerts.templates.systemName') })}<br />
                  <br />
                  {t('alerts.templates.greeting')}<br />
                  <br />
                  {t('alerts.templates.alertReceived')}<br />
                  {t('alerts.templates.ruleLine')}<br />
                  {t('alerts.templates.conditionLine')}<br />
                  {t('alerts.templates.timeLine')}<br />
                  <br />
                  {t('alerts.templates.signoff')}<br />
                  {t('alerts.templates.systemName')}
                </Text>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title={t('alerts.templates.slack')}>
              <div style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                  {t('alerts.templates.slackAlert')}<br />
                  {t('alerts.templates.slackCondition')}<br />
                  {t('alerts.templates.slackTime')}<br />
                  {t('alerts.templates.dashboardLink')}
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );

  // Alerts tab content
  const renderAlertsTab = () => (
    <Spin spinning={loading}>
      {/* Info alert */}
      <Alert
        message={t('alerts.section.title')}
        description={t('alerts.section.description')}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder={t('alerts.searchShort')}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 180 }}
            allowClear
          />
          <Select
            placeholder={t('alerts.columns.status')}
            style={{ width: 120 }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="enabled">{t('alerts.status.enabled')}</Option>
            <Option value="disabled">{t('alerts.status.disabled')}</Option>
          </Select>
          <Select
            placeholder={t('alerts.columns.severity')}
            style={{ width: 120 }}
            allowClear
            value={severityFilter}
            onChange={setSeverityFilter}
          >
            <Option value="critical">{t('alerts.severity.critical')}</Option>
            <Option value="warning">{t('alerts.severity.warning')}</Option>
            <Option value="info">{t('alerts.severity.info')}</Option>
          </Select>
          <Select
            placeholder={t('alerts.columns.category')}
            style={{ width: 140 }}
            allowClear
            showSearch
            optionFilterProp="children"
            value={datasourceCategoryFilter}
            onChange={(value) => {
              setDatasourceCategoryFilter(value);
              // Reset child filters when category changes (cascading)
              setDatasourceSupplierFilter(null);
              setMetricFilter(null);
            }}
          >
            {uniqueAlertCategories.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
          </Select>
          <Select
            placeholder={t('alerts.columns.dataSource')}
            style={{ width: 160 }}
            allowClear
            showSearch
            optionFilterProp="children"
            value={datasourceSupplierFilter}
            onChange={(value) => {
              setDatasourceSupplierFilter(value);
              // Reset metric filter when datasource changes (cascading)
              setMetricFilter(null);
            }}
          >
            {uniqueAlertDatasources.map(ds => (
              <Option key={ds} value={ds}>{ds}</Option>
            ))}
          </Select>
          <Select
            placeholder="Metric"
            style={{ width: 160 }}
            allowClear
            showSearch
            optionFilterProp="children"
            value={metricFilter}
            onChange={setMetricFilter}
          >
            {metricsWithAlerts.map(metric => (
              <Option key={metric.id} value={metric.id}>{metric.displayName}</Option>
            ))}
          </Select>
          {(severityFilter || metricFilter || searchQuery || statusFilter || datasourceCategoryFilter || datasourceSupplierFilter) && (
            <Button
              type="link"
              onClick={() => {
                setSeverityFilter(null);
                setMetricFilter(null);
                setSearchQuery('');
                setStatusFilter(null);
                setDatasourceCategoryFilter(null);
                setDatasourceSupplierFilter(null);
              }}
            >
              {t('alerts.clearFilters')}
            </Button>
          )}
        </Space>
      </Card>

      {/* Alerts table */}
      <Card
        title={
          <Space>
            <BellOutlined />
            <span>{t('alerts.tabs.alerts')} ({filteredAlerts.length})</span>
          </Space>
        }
      >
        {filteredAlerts.length === 0 ? (
          <Empty
            description={alerts.length === 0 ? t('alerts.empty') : t('alerts.noFilterMatch')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {alerts.length === 0 && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateAlert}>
                {t('alerts.createFirst')}
              </Button>
            )}
          </Empty>
        ) : (
          <Table
            dataSource={filteredAlerts}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="middle"
          />
        )}
      </Card>
    </Spin>
  );

  return (
    <div>
      {/* Style to make validation errors more prominent */}
      <style>{`
        .ant-form-item-explain-error {
          font-weight: bold !important;
          font-size: 14px !important;
        }
      `}</style>
      <div className="page-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {t('alerts.title')}
          </Title>
          <Paragraph className="page-subtitle">
            {t('alerts.subtitle')}
          </Paragraph>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            {t('alerts.refresh')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateAlert}
          >
            {t('alerts.create')}
          </Button>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'alerts',
            label: (
              <Space>
                <BellOutlined />
                {t('alerts.tabs.alerts')}
              </Space>
            ),
            children: renderAlertsTab()
          },
          {
            key: 'settings',
            label: (
              <Space>
                <SettingOutlined />
                {t('alerts.tabs.settings')}
              </Space>
            ),
            children: renderSettingsTab()
          }
        ]}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingAlert ? t('alerts.edit') : t('alerts.createNew')}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveAlert}
          onFinishFailed={handleFormFailed}
          scrollToFirstError
        >

          {/* Smart Filters for Metric Selection */}
          <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fafafa' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text type="secondary" style={{ fontSize: 12 }}>{t('alerts.helper.filterMetrics')}</Text>
              <Row gutter={8}>
                <Col span={6}>
                  <Input
                    placeholder={t('alerts.searchPlaceholder')}
                    prefix={<SearchOutlined />}
                    value={modalSearchQuery}
                    onChange={e => setModalSearchQuery(e.target.value)}
                    allowClear
                    size="small"
                  />
                </Col>
                <Col span={5}>
                  <Select
                    placeholder={t('alerts.columns.category')}
                    style={{ width: '100%' }}
                    allowClear
                    value={modalCategoryFilter}
                    onChange={setModalCategoryFilter}
                    size="small"
                  >
                    {uniqueCategories.map(cat => (
                      <Option key={cat} value={cat}>{cat}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <Select
                    placeholder={t('alerts.helper.prometheusType')}
                    style={{ width: '100%' }}
                    allowClear
                    value={modalTypeFilter}
                    onChange={setModalTypeFilter}
                    size="small"
                  >
                    {uniqueTypes.map(type => (
                      <Option key={type} value={type}>{type}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={5}>
                  <Select
                    placeholder={t('alerts.columns.dataSource')}
                    style={{ width: '100%' }}
                    allowClear
                    value={modalDatasourceFilter}
                    onChange={setModalDatasourceFilter}
                    size="small"
                  >
                    {uniqueDatasources.map(ds => (
                      <Option key={ds} value={ds}>{ds}</Option>
                    ))}
                  </Select>
                </Col>
                <Col span={3}>
                  {(modalCategoryFilter || modalTypeFilter || modalDatasourceFilter || modalSearchQuery) && (
                    <Button type="link" size="small" onClick={resetModalFilters}>
                      {t('alerts.clearShort')}
                    </Button>
                  )}
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('alerts.helper.modalSubtitle', { shown: filteredModalMetrics.length, total: allMetrics.length })}
              </Text>
            </Space>
          </Card>

          {/* 1. Datasource-specific Metrics Dropdown */}
          <Form.Item
            name="datasourceMetricIds"
            label={<span style={{ color: '#1890ff', fontWeight: 500 }}>{t('alerts.helper.datasourceHeader')}</span>}
            extra={t('alerts.helper.datasourceMetricsExtra', { count: filteredModalMetrics.length })}
            dependencies={['businessMetricIds', 'systemMetricIds']}
            rules={[{
              validator: async (_, value) => {
                const businessIds = form.getFieldValue('businessMetricIds') || [];
                const systemIds = form.getFieldValue('systemMetricIds') || [];
                console.log('=== Validator running ===');
                console.log('datasourceMetricIds value:', value);
                console.log('businessMetricIds from form:', businessIds);
                console.log('systemMetricIds from form:', systemIds);
                if ([...(value || []), ...businessIds, ...systemIds].length === 0) {
                  throw new Error(t('alerts.validation.atLeastOneMetric'));
                }
              }
            }]}
          >
            <Select
              mode="multiple"
              placeholder={t('alerts.helper.selectDatasource')}
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
              allowClear
            >
              {filteredModalMetrics.map(metric => (
                <Option key={metric.id} value={metric.id}>
                  <Space>
                    <span>{metric.displayName} ({metric.name})</span>
                    {metric.category && <Tag color="blue" style={{ fontSize: 10 }}>{metric.category}</Tag>}
                    {metric.dataSourceName && <Tag style={{ fontSize: 10 }}>{metric.dataSourceName}</Tag>}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 2. Global Business Metrics Dropdown */}
          <Form.Item
            name="businessMetricIds"
            dependencies={['datasourceMetricIds', 'systemMetricIds']}
            label={
              <Space>
                <span style={{ color: '#52c41a', fontWeight: 500 }}>{t('alerts.helper.businessHeader')}</span>
                <Select
                  size="small"
                  placeholder={t('alerts.filterByCategory')}
                  style={{ width: 140, fontSize: 10 }}
                  allowClear
                  value={businessCategoryFilter}
                  onChange={setBusinessCategoryFilter}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Object.entries(BUSINESS_METRIC_CATEGORIES).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Space>
            }
            extra={t('alerts.helper.businessMetricsExtra', { count: filteredBusinessMetrics.length })}
          >
            <Select
              mode="multiple"
              placeholder={t('alerts.helper.selectBusiness')}
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
              allowClear
            >
              {filteredBusinessMetrics.map(metric => (
                <Option key={metric.name} value={metric.name}>
                  <Tooltip
                    title={
                      <div>
                        <div><strong>{metric.description}</strong></div>
                        {metric.labels && metric.labels.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <span>Labels: </span>
                            {metric.labels.map((l, i) => (
                              <Tag key={i} style={{ fontSize: 9, margin: 2 }}>{l}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                    placement="left"
                  >
                    <Space>
                      <span>{metric.displayName}</span>
                      {metric.category && (
                        <Tag color="green" style={{ fontSize: 9 }}>
                          {BUSINESS_METRIC_CATEGORIES[metric.category] || metric.category}
                        </Tag>
                      )}
                      {metric.prometheusType && <Tag style={{ fontSize: 9 }}>{metric.prometheusType}</Tag>}
                    </Space>
                  </Tooltip>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 3. System Metrics Dropdown */}
          <Form.Item
            name="systemMetricIds"
            dependencies={['datasourceMetricIds', 'businessMetricIds']}
            label={
              <Space>
                <span style={{ color: '#fa8c16', fontWeight: 500 }}>{t('alerts.helper.systemHeader')}</span>
                <Select
                  size="small"
                  placeholder={t('alerts.filterByCategory')}
                  style={{ width: 140, fontSize: 10 }}
                  allowClear
                  value={systemCategoryFilter}
                  onChange={setSystemCategoryFilter}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Object.entries(SYSTEM_METRIC_CATEGORIES).map(([key, label]) => (
                    <Option key={key} value={key}>{label}</Option>
                  ))}
                </Select>
              </Space>
            }
            extra={t('alerts.helper.systemMetricsExtra', { count: filteredSystemMetrics.length })}
          >
            <Select
              mode="multiple"
              placeholder={t('alerts.helper.selectSystem')}
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
              allowClear
            >
              {filteredSystemMetrics.map(metric => (
                <Option key={metric.name} value={metric.name}>
                  <Tooltip
                    title={
                      <div>
                        <div><strong>{metric.description}</strong></div>
                        {metric.labels && metric.labels.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <span>Labels: </span>
                            {metric.labels.map((l, i) => (
                              <Tag key={i} style={{ fontSize: 9, margin: 2 }}>{l}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                    placement="left"
                  >
                    <Space>
                      <span>{metric.displayName}</span>
                      {metric.category && (
                        <Tag color="orange" style={{ fontSize: 9 }}>
                          {SYSTEM_METRIC_CATEGORIES[metric.category] || metric.category}
                        </Tag>
                      )}
                      {metric.prometheusType && <Tag style={{ fontSize: 9 }}>{metric.prometheusType}</Tag>}
                    </Space>
                  </Tooltip>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {generateExpressionHelper()}

          <Form.Item
            name="name"
            label={t('alerts.modal.name')}
            rules={[{ required: true, message: t('alerts.validation.nameRequired') }]}
          >
            <Input placeholder={t('alerts.modal.descriptionPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('alerts.modal.descriptionLabel')}
          >
            <TextArea rows={2} placeholder={t('alerts.modal.description')} />
          </Form.Item>

          <Form.Item
            name="severity"
            label={t('alerts.modal.severityLevel')}
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="critical">{t('alerts.severity.criticalDesc')}</Option>
              <Option value="warning">{t('alerts.severity.warningDesc')}</Option>
              <Option value="info">{t('alerts.severity.infoDesc')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="expression"
            label={
              <Space>
                <span>{t('alerts.modal.promqlExpression')}</span>
                <Tooltip title={t('alerts.modal.promqlHelperTitle')}>
                  <Button
                    type="link"
                    size="small"
                    icon={<CodeOutlined />}
                    onClick={() => setShowPromQLHelper(true)}
                    style={{ padding: '0 4px' }}
                  >
                    {t('alerts.modal.promqlHelper')}
                  </Button>
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: t('alerts.validation.expressionRequired') }]}
            extra={
              <Space direction="vertical" size={0}>
                <Text type="secondary">{t('alerts.modal.promqlHint')}</Text>
                {(() => {
                  // Get selections from separate dropdowns
                  const datasourceIds: string[] = form.getFieldValue('datasourceMetricIds') || [];
                  const businessIds: string[] = form.getFieldValue('businessMetricIds') || [];
                  const systemIds: string[] = form.getFieldValue('systemMetricIds') || [];

                  if (datasourceIds.length === 0 && businessIds.length === 0 && systemIds.length === 0) return null;

                  // Parse metrics from all categories
                  const datasourceMetrics = allMetrics.filter(m => datasourceIds.includes(m.id));
                  const selectedBusinessMetrics = GLOBAL_BUSINESS_METRICS.filter(m => businessIds.includes(m.name));
                  const selectedSystemMetrics = SYSTEM_METRICS.filter(m => systemIds.includes(m.name));

                  const allSelectedMetrics = [
                    ...datasourceMetrics.map(m => ({ name: m.name, type: 'datasource' })),
                    ...selectedBusinessMetrics.map(m => ({ name: m.name, type: 'business' })),
                    ...selectedSystemMetrics.map(m => ({ name: m.name, type: 'system' }))
                  ];

                  if (allSelectedMetrics.length > 0) {
                    return (
                      <Space wrap size={4} style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('alerts.helper.availableMetricsClick')}</Text>
                        {allSelectedMetrics.map((m, idx) => (
                          <Tag
                            key={`${m.type}-${idx}`}
                            color={m.type === 'business' ? 'green' : m.type === 'system' ? 'orange' : 'blue'}
                            style={{ fontSize: 10, cursor: 'pointer' }}
                            onClick={() => {
                              const currentExpr = form.getFieldValue('expression') || '';
                              form.setFieldValue('expression', currentExpr + (currentExpr ? ' ' : '') + m.name);
                            }}
                          >
                            {m.name}
                          </Tag>
                        ))}
                      </Space>
                    );
                  }
                  return null;
                })()}
              </Space>
            }
          >
            <TextArea
              rows={3}
              placeholder={t('alerts.modal.promqlPlaceholder')}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="for"
            label={t('alerts.modal.forDuration')}
            extra={t('alerts.modal.forDurationHint')}
          >
            <Input placeholder={t('alerts.modal.forDurationPlaceholder')} style={{ width: 120 }} />
          </Form.Item>

          {/* Labels Configuration - Optional */}
          <Form.Item
            label={
              <Space>
                <span>{t('alerts.modal.labelsLabel')}</span>
                <Tooltip title={t('alerts.modal.labelsHint')}>
                  <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              </Space>
            }
          >
            <EnhancedLabelInput
              value={form.getFieldValue('labelNames')}
              onChange={(labelNames, promqlExpr, labels) => {
                form.setFieldsValue({
                  labelNames,
                  labelsExpression: promqlExpr,
                  labels: labels.map(l => ({ key: l.name, value: l.value }))
                });
              }}
            />
          </Form.Item>

          <Form.Item
            name="notificationRecipients"
            label={t('alerts.templates.recipients')}
            extra={t('alerts.settings.emailHint')}
          >
            <Input placeholder="user1@example.com, user2@example.com" />
          </Form.Item>

          <Form.Item
            name="isEnabled"
            valuePropName="checked"
          >
            <Checkbox>{t('alerts.status.alertActive')}</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'left' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>
                {t('alerts.actions.cancel')}
              </Button>
              <Button
                type="primary"
                htmlType="button"
                onClick={handleManualSubmit}
              >
                {editingAlert ? t('alerts.actions.update') : t('alerts.actions.create')} {t('alerts.alertWord')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* PromQL Expression Helper Dialog - shows only selected metrics */}
      <PromQLExpressionHelperDialog
        visible={showPromQLHelper}
        onClose={() => setShowPromQLHelper(false)}
        onSelect={(expression) => {
          form.setFieldValue('expression', expression);
          setShowPromQLHelper(false);
        }}
        currentExpression={form.getFieldValue('expression') || ''}
        metricName={(() => {
          // Get first selected metric name to use as placeholder replacement
          const datasourceIds = form.getFieldValue('datasourceMetricIds') || [];
          const businessIds = form.getFieldValue('businessMetricIds') || [];
          const systemIds = form.getFieldValue('systemMetricIds') || [];

          // Priority: datasource > business > system
          if (datasourceIds.length > 0) {
            const firstMetric = allMetrics.find(m => m.id === datasourceIds[0]);
            return firstMetric?.name || 'metric';
          }
          if (businessIds.length > 0) {
            return businessIds[0];
          }
          if (systemIds.length > 0) {
            return systemIds[0];
          }
          return 'metric';
        })()}
        availableMetrics={(() => {
          // Pass only SELECTED datasource metrics to the helper
          const selected = getSelectedMetricsForHelper();
          return selected.datasource;
        })()}
        selectedBusinessMetrics={(() => {
          // Pass only SELECTED business metrics
          const selected = getSelectedMetricsForHelper();
          return selected.business;
        })()}
        selectedSystemMetrics={(() => {
          // Pass only SELECTED system metrics
          const selected = getSelectedMetricsForHelper();
          return selected.system;
        })()}
        showSystemMetrics={false}  // Don't show all system metrics, only selected
      />
    </div>
  );
};

export default AlertsManagement;
