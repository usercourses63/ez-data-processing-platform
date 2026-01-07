import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, Steps, Button, Space, message, Typography, Alert, Skeleton } from 'antd';
import { SaveOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { metricsApi } from '../../services/metrics-api-client';
import type { AlertRule } from '../../components/metrics/AlertRuleBuilder';

// Lazy load wizard step components for better performance
const WizardStepField = lazy(() => import('../../components/metrics/WizardStepField'));
const WizardStepDetails = lazy(() => import('../../components/metrics/WizardStepDetails'));
const WizardStepLabels = lazy(() => import('../../components/metrics/WizardStepLabels'));
const WizardStepAlerts = lazy(() => import('../../components/metrics/WizardStepAlerts'));

const { Title } = Typography;

interface WizardData {
  // Step 1: Data Source
  scope: 'global' | 'datasource-specific';
  dataSourceId: string | null;
  dataSourceName: string | null;
  
  // Step 2: Field Selection
  fieldPath: string;
  
  // Step 3: Metric Details
  name: string;
  displayName: string;
  description: string;
  category: string;
  prometheusType: 'gauge' | 'counter' | 'histogram' | 'summary';
  
  // Step 4: Labels
  labelNames: string;
  labelsExpression: string;
  
  // Step 5: Alert Rules
  alertRules: AlertRule[];
  
  // Additional fields
  formula: string;
  // NOTE: FormulaType is always 'simple' (0) - JSON path extraction during file processing
  // PromQL expressions are NOT supported for metric extraction (only for alerts)
  // FormulaType is NOT stored in wizard state, hardcoded to 0 in handleSubmit
  retention: string;
  status: number;
}

const MetricConfigurationWizard: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;

  // Get dataSourceId from URL query parameter (e.g., /metrics/new?dataSourceId=xxx)
  const dataSourceIdFromUrl = searchParams.get('dataSourceId');

  const [current, setCurrent] = useState(0); // Always start at field selection (step 0)
  const [loading, setLoading] = useState(false);
  const [dataSourcePreloaded, setDataSourcePreloaded] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    scope: 'datasource-specific', // Always datasource-specific - operational metrics are in BusinessMetrics.cs
    dataSourceId: dataSourceIdFromUrl,
    dataSourceName: null,
    fieldPath: '',
    name: '',
    displayName: '',
    description: '',
    category: 'business',
    prometheusType: 'gauge',
    labelNames: '',
    labelsExpression: '',
    alertRules: [],
    formula: '',
    retention: '30d',
    status: 0
  });

  // Load datasource name if dataSourceId is provided via URL
  const loadDataSourceName = useCallback(async (dsId: string) => {
    try {
      const response = await fetch(`http://localhost:5001/api/v1/datasource/${dsId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.IsSuccess && data.Data) {
          setWizardData(prev => ({
            ...prev,
            dataSourceId: dsId,
            dataSourceName: data.Data.Name
          }));
          setDataSourcePreloaded(true);
        }
      }
    } catch (error) {
      console.error('Error loading datasource:', error);
    }
  }, []);

  useEffect(() => {
    if (dataSourceIdFromUrl && !dataSourcePreloaded && !isEditMode) {
      loadDataSourceName(dataSourceIdFromUrl);
    }
  }, [dataSourceIdFromUrl, dataSourcePreloaded, isEditMode, loadDataSourceName]);

  const loadMetric = useCallback(async (metricId: string) => {
    setLoading(true);
    try {
      const metric = await metricsApi.getById(metricId);
      setWizardData({
        scope: metric.scope || 'global',
        dataSourceId: metric.dataSourceId || null,
        dataSourceName: metric.dataSourceName || null,
        fieldPath: metric.fieldPath || '',
        name: metric.name || '',
        displayName: metric.displayName || '',
        description: metric.description || '',
        category: metric.category || 'business',
        prometheusType: (metric as any).prometheusType || 'gauge',
        labelNames: (metric as any).labelNames || '',
        labelsExpression: (metric as any).labelsExpression || '',
        alertRules: (metric as any).alertRules || [],
        formula: metric.formula || '',
        retention: metric.retention || '30d',
        status: metric.status || 0
      });
    } catch (error) {
      message.error('שגיאה בטעינת המדד');
      console.error('Error loading metric:', error);
      navigate('/metrics');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Load existing metric for edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadMetric(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, id]); // loadMetric excluded to prevent infinite loop

  const updateWizardData = useCallback((data: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...data }));
  }, []); // Empty deps since we use functional setState

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Field Selection (always required)
        if (!wizardData.fieldPath) {
          message.warning('יש לבחור שדה - זהו שדה חובה');
          return false;
        }
        return true;

      case 1: // Metric Details
        if (!wizardData.name) {
          message.warning('יש להזין שם מדד');
          return false;
        }
        if (!/^[a-z][a-z0-9_]*$/.test(wizardData.name)) {
          message.warning('שם המדד חייב להתחיל באות קטנה ולהכיל רק אותיות קטנות, מספרים וקו תחתון');
          return false;
        }
        if (!wizardData.displayName) {
          message.warning('יש להזין שם תצוגה');
          return false;
        }
        if (!wizardData.prometheusType) {
          message.warning('יש לבחור סוג Prometheus');
          return false;
        }
        return true;

      case 2: // Labels
        // Labels are optional, so always valid
        return true;

      case 3: // Alert Rules
        // Alert rules are optional, so always valid
        return true;

      default:
        return true;
    }
  };

  const next = () => {
    if (validateStep(current)) {
      setCurrent(current + 1);
    }
  };

  const prev = () => {
    setCurrent(current - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(current)) {
      console.log('Validation failed for current step:', current);
      return;
    }

    console.log('=== Starting handleSubmit ===');
    console.log('Edit mode:', isEditMode, 'ID:', id);
    setLoading(true);
    let success = false;
    
    try {
      // FormulaType is always 0 (Simple) - JSON path extraction
      // PromQL (1) and Recording (2) are NOT supported for metric extraction
      const formulaTypeNumber = 0; // Always Simple
      
      const payload = {
        name: wizardData.name,
        displayName: wizardData.displayName,
        description: wizardData.description,
        category: wizardData.category,
        scope: wizardData.scope,
        dataSourceId: wizardData.dataSourceId,
        dataSourceName: wizardData.dataSourceName,
        formula: wizardData.formula,
        formulaType: formulaTypeNumber,
        fieldPath: wizardData.fieldPath,
        prometheusType: wizardData.prometheusType,
        labelNames: wizardData.labelNames,
        labelsExpression: wizardData.labelsExpression,
        labels: wizardData.labelNames ? wizardData.labelNames.split(',').map(l => l.trim()).filter(Boolean) : [],
        alertRules: wizardData.alertRules,
        retention: wizardData.retention,
        status: wizardData.status,
        createdBy: 'User',
        updatedBy: 'User'
      };

      console.log('Submitting metric payload:', payload);

      if (isEditMode && id) {
        console.log('Updating existing metric with ID:', id);
        const result = await metricsApi.update(id, payload);
        console.log('Update API result:', result);
        message.success('המדד עודכן בהצלחה');
        success = true;
        console.log('Success flag set to true after update');
      } else {
        console.log('Creating new metric');
        const result = await metricsApi.create(payload);
        console.log('Create API result:', result);
        message.success('המדד נוצר בהצלחה');
        success = true;
        console.log('Success flag set to true after create');
      }
    } catch (error: any) {
      console.error('=== ERROR in handleSubmit ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      message.error('שגיאה בשמירת המדד: ' + (error.message || 'Unknown error'));
    } finally {
      console.log('=== Finally block - success:', success, '===');
      setLoading(false);
      
      // Navigate back on success
      if (success) {
        console.log('Success is true, scheduling navigation in 800ms');
        setTimeout(() => {
          // Navigate back to datasource page if we came from there, otherwise go to alerts
          const backUrl = dataSourceIdFromUrl
            ? `/datasources/${dataSourceIdFromUrl}/edit`
            : '/alerts';
          console.log('Executing navigation to', backUrl);
          try {
            navigate(backUrl, { replace: true });
            console.log('Navigate called successfully');
          } catch (navError) {
            console.error('Navigation error:', navError);
          }
        }, 800);
      } else {
        console.log('Success is false, NOT navigating back to list');
      }
    }
  };

  const steps = [
    {
      title: 'בחירת שדה',
      description: 'שדה חובה לחילוץ ערכים',
      content: (
        <Suspense fallback={<Skeleton active />}>
          <WizardStepField
            value={wizardData}
            onChange={updateWizardData}
          />
        </Suspense>
      )
    },
    {
      title: 'פרטי מדד',
      description: 'שם, תיאור וסוג המדד',
      content: (
        <Suspense fallback={<Skeleton active />}>
          <WizardStepDetails
            value={wizardData}
            onChange={updateWizardData}
          />
        </Suspense>
      )
    },
    {
      title: 'תוויות',
      description: 'הגדרת תוויות למדד (אופציונלי)',
      content: (
        <Suspense fallback={<Skeleton active />}>
          <WizardStepLabels
            value={wizardData}
            onChange={updateWizardData}
          />
        </Suspense>
      )
    },
    {
      title: 'כללי התראה',
      description: 'הוספת התראות (אופציונלי)',
      content: (
        <Suspense fallback={<Skeleton active />}>
          <WizardStepAlerts
            value={wizardData}
            onChange={updateWizardData}
          />
        </Suspense>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={2}>
              {isEditMode ? 'עריכת מדד' : 'יצירת מדד חדש'}
            </Title>
          </div>

          {/* Edit Mode Context Banner */}
          {isEditMode && wizardData.name && (
            <Alert
              message="מדד בעריכה"
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text><strong>שם מדד:</strong> {wizardData.displayName} ({wizardData.name})</Typography.Text>
                  <Typography.Text><strong>שדה:</strong> {wizardData.fieldPath}</Typography.Text>
                  {wizardData.dataSourceName && (
                    <Typography.Text><strong>מקור נתונים:</strong> {wizardData.dataSourceName}</Typography.Text>
                  )}
                  {wizardData.scope && (
                    <Typography.Text><strong>היקף:</strong> {wizardData.scope === 'global' ? 'גלובלי' : 'פרטני'}</Typography.Text>
                  )}
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    ניתן לנווט בין השלבים באמצעות לחיצה על השלבים למעלה
                  </Typography.Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Steps
            current={current}
            items={steps.map(step => ({
              title: step.title,
              description: step.description
            }))}
            onChange={(step) => {
              // Allow clicking on any step to navigate freely
              setCurrent(step);
            }}
          />

          <div style={{ minHeight: 400, marginTop: 24 }}>
            {steps[current].content}
          </div>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {current > 0 && (
                <Button onClick={prev} icon={<LeftOutlined />}>
                  הקודם
                </Button>
              )}
            </div>
            <div>
              <Space>
                <Button onClick={() => navigate(dataSourceIdFromUrl ? `/datasources/${dataSourceIdFromUrl}/edit` : '/alerts')}>
                  ביטול
                </Button>
                {current < steps.length - 1 && (
                  <Button type="primary" onClick={next}>
                    הבא
                    <RightOutlined />
                  </Button>
                )}
                {current === steps.length - 1 && (
                  <Button
                    type="primary"
                    onClick={handleSubmit}
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    שמור
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default MetricConfigurationWizard;
export type { WizardData };
