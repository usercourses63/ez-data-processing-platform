import React from 'react';
import { Card, Tabs, Typography } from 'antd';
import { SettingOutlined, TagsOutlined, CloudServerOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CategoryManagementTab from './tabs/CategoryManagementTab';
import ServerConfigurationTab from './tabs/ServerConfigurationTab';
import './AdminSettings.css';

const { Title } = Typography;

const AdminSettings: React.FC = () => {
  const { t } = useTranslation();

  const items = [
    {
      key: 'categories',
      label: (
        <span>
          <TagsOutlined />
          {t('admin.tabs.categories') || 'קטגוריות'}
        </span>
      ),
      children: <CategoryManagementTab />,
    },
    {
      key: 'servers',
      label: (
        <span>
          <CloudServerOutlined />
          {t('admin.tabs.servers') || 'שרתי קבצים'}
        </span>
      ),
      children: <ServerConfigurationTab />,
    },
  ];

  return (
    <div className="admin-settings" style={{ padding: '24px' }}>
      <Card>
        <Title level={2} style={{ marginBottom: 24 }}>
          <SettingOutlined /> {t('admin.title') || 'הגדרות מערכת'}
        </Title>

        <Tabs
          defaultActiveKey="categories"
          items={items}
          size="large"
        />
      </Card>
    </div>
  );
};

export default AdminSettings;
