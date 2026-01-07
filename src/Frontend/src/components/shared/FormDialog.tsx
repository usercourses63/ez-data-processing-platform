import React from 'react';
import { Modal, Form } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { useTranslation } from 'react-i18next';

export interface FormDialogProps {
  title: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  form: FormInstance;
  children: React.ReactNode;
  width?: number;
  okText?: string;
  cancelText?: string;
  loading?: boolean;
  destroyOnClose?: boolean;
}

export const FormDialog: React.FC<FormDialogProps> = ({
  title,
  visible,
  onClose,
  onSubmit,
  form,
  children,
  width = 600,
  okText,
  cancelText,
  loading = false,
  destroyOnClose = true
}) => {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  const defaultOkText = okText || (isHebrew ? 'שמור' : 'Save');
  const defaultCancelText = cancelText || (isHebrew ? 'ביטול' : 'Cancel');

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
      form.resetFields();
      onClose();
    } catch (error) {
      console.error('Form validation failed:', error);
      // Validation errors will be shown in the form automatically
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      okText={defaultOkText}
      cancelText={defaultCancelText}
      confirmLoading={loading}
      width={width}
      destroyOnClose={destroyOnClose}
      centered
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        {children}
      </Form>
    </Modal>
  );
};
