import React from 'react';
import { Typography, Breadcrumb, Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export interface BreadcrumbItem {
  title: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  onBack?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  onBack
}) => {
  return (
    <div className="page-header" style={{ marginBottom: 24 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={breadcrumbs.map(bc => ({
            title: bc.title,
            href: bc.href
          }))}
        />
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              type="text"
            />
          )}
          <div>
            <Title level={2} style={{ margin: 0 }}>
              {title}
            </Title>
            {subtitle && (
              <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                {subtitle}
              </Text>
            )}
          </div>
        </div>

        {actions && (
          <Space size="middle">
            {actions}
          </Space>
        )}
      </div>
    </div>
  );
};
