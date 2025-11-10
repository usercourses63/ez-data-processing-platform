import React from 'react';
import { Layout, Button, Space } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Header } = Layout;

const AppHeader: React.FC = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(newLang);
  };

  return (
    <Header className="app-header">
      <div className="logo">
        <h2 style={{ margin: 0, color: 'white' }}>{t('app.title')}</h2>
      </div>
      <Space className="header-actions">
        <Button
          type="text"
          icon={<GlobalOutlined />}
          onClick={toggleLanguage}
          style={{ color: 'white' }}
        >
          {i18n.language === 'he' ? 'English' : 'עברית'}
        </Button>
      </Space>
    </Header>
  );
};

export default AppHeader;
