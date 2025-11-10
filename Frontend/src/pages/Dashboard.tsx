import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FileOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PercentageOutlined
} from '@ant-design/icons';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('dashboard.title')}</h1>
          <p className="page-subtitle">{t('dashboard.overview')}</p>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalFiles')}
              value={1250}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#3498db' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.validRecords')}
              value={11893}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#27ae60' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.invalidRecords')}
              value={107}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#e74c3c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.errorRate')}
              value={0.89}
              prefix={<PercentageOutlined />}
              suffix="%"
              precision={2}
              valueStyle={{ color: '#f39c12' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
