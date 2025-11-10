import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  BellOutlined,
  WarningOutlined,
  RobotOutlined,
  MonitorOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('navigation.dashboard'),
    },
    {
      key: '/datasources',
      icon: <DatabaseOutlined />,
      label: t('navigation.datasources'),
    },
    {
      key: '/schema',
      icon: <FileTextOutlined />,
      label: t('navigation.schemaManagement'),
    },
    {
      key: '/metrics',
      icon: <BarChartOutlined />,
      label: t('navigation.metricsConfig'),
    },
    {
      key: '/invalid-records',
      icon: <WarningOutlined />,
      label: 'Invalid Records',
    },
    {
      key: '/ai-assistant',
      icon: <RobotOutlined />,
      label: 'AI Assistant',
    },
    {
      key: '/notifications',
      icon: <BellOutlined />,
      label: 'Notifications',
    },
    {
      key: '/monitoring',
      icon: <MonitorOutlined />,
      label: t('navigation.monitoring'),
    },
  ];

  const handleMenuClick = (e: any) => {
    navigate(e.key);
  };

  return (
    <Sider width={250} className="app-sidebar">
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

export default AppSidebar;
