import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Select, Space, Typography, Card } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import type { WizardData } from '../../pages/metrics/MetricConfigurationWizard';

const { Text, Title } = Typography;
const { Option } = Select;

interface WizardStepDataSourceProps {
  value: WizardData;
  onChange: (data: Partial<WizardData>) => void;
}

interface DataSource {
  ID: string;
  Name: string;
  Category: string;
  IsActive: boolean;
}

interface ApiResponse<T> {
  IsSuccess: boolean;
  Data: T;
  Error: any;
}

interface PagedResult<T> {
  Items: T[];
  TotalItems: number;
}

/**
 * WizardStepDataSource Component
 *
 * Step 1 of the metric configuration wizard.
 * Users select a data source for the metric - field extraction metrics
 * are always tied to a specific data source's schema.
 *
 * NOTE: Global/operational metrics (like records_processed, jobs_completed, etc.)
 * are hardcoded in BusinessMetrics.cs and NOT configured through this wizard.
 * This wizard is ONLY for field extraction metrics that extract values from data content.
 */
const WizardStepDataSource: React.FC<WizardStepDataSourceProps> = ({ value, onChange }) => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDataSources = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/datasource?page=1&size=100');
      const data: ApiResponse<PagedResult<DataSource>> = await response.json();
      if (data.IsSuccess && data.Data) {
        setDataSources(data.Data.Items || []);
      }
    } catch (error) {
      console.error('Error loading data sources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDataSources();
  }, [loadDataSources]);

  // Ensure scope is always datasource-specific
  useEffect(() => {
    if (value.scope !== 'datasource-specific') {
      onChange({ scope: 'datasource-specific' });
    }
  }, [value.scope, onChange]);

  const handleDataSourceSelect = useCallback((dataSourceId: string) => {
    const selectedDs = dataSources.find(ds => ds.ID === dataSourceId);
    onChange({
      dataSourceId,
      dataSourceName: selectedDs?.Name || null,
    });
  }, [onChange, dataSources]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Space>
              <DatabaseOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Title level={4} style={{ margin: 0 }}>בחירת מקור נתונים</Title>
            </Space>
          </div>

          <Alert
            message="מדד חילוץ שדות"
            description={
              <Space direction="vertical" size={4}>
                <Text>מדד זה יחלץ ערכים משדות ברשומות המעובדות של מקור הנתונים שתבחר.</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  המערכת תחלץ את הערך מכל רשומה שעוברת אימות בהצלחה ותשלח אותו ל-Prometheus.
                </Text>
              </Space>
            }
            type="info"
            showIcon
          />

          <div>
            <Text strong>בחר מקור נתונים:</Text>
            <Text type="danger"> *</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="בחר מקור נתונים"
              value={value.dataSourceId || undefined}
              onChange={handleDataSourceSelect}
              loading={loading}
              showSearch
              size="large"
              filterOption={(input, option) => {
                const label = option?.label;
                if (typeof label === 'string') {
                  return label.toLowerCase().includes(input.toLowerCase());
                }
                return false;
              }}
            >
              {dataSources.map(ds => (
                <Option key={ds.ID} value={ds.ID} label={ds.Name}>
                  {ds.Name} ({ds.Category})
                </Option>
              ))}
            </Select>
          </div>

          {value.dataSourceId && (
            <Alert
              message={`מקור נתונים נבחר: ${value.dataSourceName}`}
              type="success"
              showIcon
            />
          )}
        </Space>
      </Card>

      <Alert
        message="הערה על מדדים תפעוליים"
        description={
          <Space direction="vertical" size={4}>
            <Text style={{ fontSize: 12 }}>
              מדדים תפעוליים כלליים (כמו רשומות מעובדות, משימות שהושלמו, שגיאות וכו')
              מוגדרים אוטומטית במערכת ואינם דורשים הגדרה ידנית.
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              אשף זה מיועד רק להגדרת מדדי חילוץ שדות ממקור נתונים ספציפי.
            </Text>
          </Space>
        }
        type="warning"
        showIcon
      />
    </Space>
  );
};

export default WizardStepDataSource;
