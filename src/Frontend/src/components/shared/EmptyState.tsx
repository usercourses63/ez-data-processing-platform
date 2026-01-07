import React from 'react';
import { Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface EmptyStateProps {
  description?: string;
  actionText?: string;
  onAction?: () => void;
  image?: React.ReactNode;
  showAction?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  description,
  actionText,
  onAction,
  image,
  showAction = true
}) => {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  const defaultDescription = description || (isHebrew ? 'אין נתונים להצגה' : 'No data available');
  const defaultActionText = actionText || (isHebrew ? 'הוסף חדש' : 'Add New');

  return (
    <div style={{
      padding: '40px 20px',
      textAlign: 'center'
    }}>
      <Empty
        image={image || Empty.PRESENTED_IMAGE_SIMPLE}
        description={defaultDescription}
      >
        {showAction && onAction && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAction}
          >
            {defaultActionText}
          </Button>
        )}
      </Empty>
    </div>
  );
};
