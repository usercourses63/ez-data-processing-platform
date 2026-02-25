import React from 'react';
import { Layout, Button, Switch, Space, Typography, Divider, Tooltip } from 'antd';
import {
  GlobalOutlined,
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { openDocsInNewTab } from '../../utils/docs-url';

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  collapsed?: boolean;
  onCollapse?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ collapsed = false, onCollapse }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'he';

  const toggleLanguage = () => {
    const newLanguage = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(newLanguage);
    
    // Update document direction
    document.documentElement.dir = newLanguage === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLanguage;
  };

  const MenuIcon = collapsed ? MenuUnfoldOutlined : MenuFoldOutlined;

  const menuToggleSection = onCollapse ? (
    <div style={{
      position: 'absolute',
      left: 0,
      paddingLeft: 16,
      display: 'flex',
      alignItems: 'center',
      height: '100%',
    }}>
      <Button
        type="text"
        icon={<MenuIcon />}
        onClick={onCollapse}
        style={{
          fontSize: '16px',
          width: 48,
          height: 48,
        }}
      />
    </div>
  ) : null;

  const titleSection = (
    <div style={{
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      height: '100%',
    }}>
      <Text style={{
        fontSize: '18px',
        fontWeight: 600,
        color: '#ffffff',
        whiteSpace: 'nowrap',
      }}>
        {t('app.title')}
      </Text>
    </div>
  );

  const actionsSection = (
    <div style={{
      position: 'absolute',
      right: 0,
      paddingRight: 16,
      display: 'flex',
      alignItems: 'center',
      height: '100%',
    }}>
      <Space size="middle">
        {/* Language Toggle */}
        <Space>
          <GlobalOutlined style={{ color: '#8c8c8c' }} />
          <Switch
            checkedChildren="עב"
            unCheckedChildren="EN"
            checked={isRTL}
            onChange={toggleLanguage}
            size="small"
          />
        </Space>

        {/* Help - Opens Docusaurus documentation portal in new tab */}
        <Tooltip title={isRTL ? 'עזרה' : 'Help'}>
          <Button
            type="text"
            icon={<QuestionCircleOutlined />}
            onClick={() => openDocsInNewTab()}
            aria-label={isRTL ? 'פתח תיעוד במעבר חדש' : 'Open documentation in new tab'}
            style={{
              fontSize: '16px',
              width: 40,
              height: 40,
            }}
          />
        </Tooltip>

        {/* Notifications */}
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{
            fontSize: '16px',
            width: 40,
            height: 40,
          }}
        />

        {/* User Profile */}
        <Button
          type="text"
          icon={<UserOutlined />}
          style={{
            fontSize: '16px',
            width: 40,
            height: 40,
          }}
        />
      </Space>
    </div>
  );

  return (
    <Header className="app-header">
      {menuToggleSection}
      {titleSection}
      {actionsSection}
    </Header>
  );
};

export default AppHeader;
