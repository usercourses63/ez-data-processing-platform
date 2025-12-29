import React from 'react';
// Force recompile - sidebar menu order updated
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
  BellOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

interface AppSidebarProps {
  collapsed?: boolean;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/datasources',
      icon: <DatabaseOutlined />,
      label: t('navigation.datasources'),
    },
    {
      key: '/invalid-records',
      icon: <ExclamationCircleOutlined />,
      label: t('navigation.invalidRecords'),
    },
    {
      key: '/alerts',
      icon: <BellOutlined />,
      label: 'התרעות',
    },
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('navigation.dashboard'),
    },
    {
      key: '/ai-assistant',
      icon: <RobotOutlined />,
      label: t('navigation.aiAssistant'),
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: t('navigation.adminSettings') || 'הגדרות מערכת',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const selectedKeys = [location.pathname];

  return (
    <Sider
      className="app-sidebar"
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={256}
      collapsedWidth={64}
      style={{
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
      }}
    >
      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          height: '100%',
          borderRight: 0,
        }}
      />
    </Sider>
  );
};

export default AppSidebar;
