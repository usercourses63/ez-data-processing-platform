import React from 'react';
import { Card, Tabs, Typography } from 'antd';
import { SettingOutlined, TagsOutlined, DownloadOutlined, UploadOutlined, HddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CategoryManagementTab from './tabs/CategoryManagementTab';
import InputServersTab from './tabs/InputServersTab';
import OutputServersTab from './tabs/OutputServersTab';
import NasDevicesTab from './tabs/NasDevicesTab';
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
      key: 'inputServers',
      label: (
        <span>
          <DownloadOutlined />
          {t('admin.tabs.inputServers') || 'שרתי קלט'}
        </span>
      ),
      children: <InputServersTab />,
    },
    {
      key: 'outputServers',
      label: (
        <span>
          <UploadOutlined />
          {t('admin.tabs.outputServers') || 'שרתי פלט'}
        </span>
      ),
      children: <OutputServersTab />,
    },
    {
      key: 'nasDevices',
      label: (
        <span>
          <HddOutlined />
          {t('admin.tabs.nasDevices') || 'התקני NAS'}
        </span>
      ),
      children: <NasDevicesTab />,
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
