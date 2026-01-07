import React from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogOptions {
  title?: string;
  content?: string;
  okText?: string;
  cancelText?: string;
  okType?: 'primary' | 'danger' | 'default';
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
}

export const useConfirmDialog = () => {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  const showConfirm = (options: ConfirmDialogOptions) => {
    const {
      title = isHebrew ? 'אישור פעולה' : 'Confirm Action',
      content = isHebrew ? 'האם אתה בטוח?' : 'Are you sure?',
      okText = isHebrew ? 'אישור' : 'OK',
      cancelText = isHebrew ? 'ביטול' : 'Cancel',
      okType = 'primary',
      onOk,
      onCancel
    } = options;

    Modal.confirm({
      title,
      content,
      icon: <ExclamationCircleOutlined />,
      okText,
      cancelText,
      okType,
      onOk,
      onCancel,
      centered: true,
      direction: isHebrew ? 'rtl' : 'ltr'
    });
  };

  const showDeleteConfirm = (options: Omit<ConfirmDialogOptions, 'okType'>) => {
    showConfirm({
      ...options,
      title: options.title || (isHebrew ? 'אישור מחיקה' : 'Confirm Delete'),
      content: options.content || (isHebrew ? 'האם אתה בטוח שברצונך למחוק?' : 'Are you sure you want to delete?'),
      okText: options.okText || (isHebrew ? 'מחק' : 'Delete'),
      okType: 'danger'
    });
  };

  return {
    showConfirm,
    showDeleteConfirm
  };
};
