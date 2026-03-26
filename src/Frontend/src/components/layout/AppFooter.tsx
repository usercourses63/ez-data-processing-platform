import React from 'react';
import { Layout, Typography, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { VERSION_INFO, getFullVersionInfo } from '../../config/version';
import { getDocsUrl } from '../../utils/docs-url';
import './AppFooter.css';

const { Footer } = Layout;
const { Text, Link } = Typography;

const AppFooter: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Footer className="app-footer">
      <div className="footer-content">
        <Space size="large" wrap>
          <Text className="footer-text">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </Text>

          <Tooltip title={getFullVersionInfo()} placement="top">
            <Space size="small" className="footer-version">
              <InfoCircleOutlined />
              <Text className="footer-text">
                {t('footer.version')}: {VERSION_INFO.version}
              </Text>
              <Text type="secondary" className="footer-build-date">
                ({VERSION_INFO.buildDate})
              </Text>
            </Space>
          </Tooltip>

          {VERSION_INFO.environment !== 'production' && (
            <Text type="warning" className="footer-env">
              {t('footer.environment')}: {VERSION_INFO.environment.toUpperCase()}
            </Text>
          )}

          <Link
            href={getDocsUrl('docs/user-guide/')}
            target="_blank"
            className="footer-link"
          >
            {t('footer.documentation')}
          </Link>
        </Space>
      </div>
    </Footer>
  );
};

export default AppFooter;
