import React from 'react';
import { Card, Tabs, Typography } from 'antd';
import { SettingOutlined, TagsOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CategoryManagementTab from './tabs/CategoryManagementTab';
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
    // Future tabs can be added here:
    // {
    //   key: 'settings',
    //   label: (
    //     <span>
    //       <SettingOutlined />
    //       {t('admin.tabs.systemSettings') || 'הגדרות מערכת'}
    //     </span>
    //   ),
    //   children: <SystemSettingsTab />,
    // },
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
