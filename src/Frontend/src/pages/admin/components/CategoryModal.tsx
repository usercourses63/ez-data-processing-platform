import React, { useEffect } from 'react';
import { Modal, Form, Input, message, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { createCategory, updateCategory } from '../../../services/categories-api-client';
import type { DataSourceCategory, CreateCategoryRequest, UpdateCategoryRequest } from '../../../services/categories-api-client';

interface CategoryModalProps {
  visible: boolean;
  category: DataSourceCategory | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  visible,
  category,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditMode = category !== null;

  useEffect(() => {
    if (visible && category) {
      form.setFieldsValue({
        Name: category.Name,
        NameEn: category.NameEn,
        Description: category.Description,
      });
    } else if (visible) {
      form.resetFields();
    }
  }, [visible, category, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryRequest) => createCategory(data),
    onSuccess: () => {
      message.success(t('admin.categories.createSuccess') || 'קטגוריה נוצרה בהצלחה');
      onSuccess();
    },
    onError: (error: any) => {
      message.error(error.message || t('admin.categories.createError') || 'שגיאה ביצירת קטגוריה');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) =>
      updateCategory(id, data),
    onSuccess: () => {
      message.success(t('admin.categories.updateSuccess') || 'קטגוריה עודכנה בהצלחה');
      onSuccess();
    },
    onError: (error: any) => {
      message.error(error.message || t('admin.categories.updateError') || 'שגיאה בעדכון קטגוריה');
    },
  });

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      if (isEditMode && category) {
        // Update existing category
        const updateData: UpdateCategoryRequest = {
          Name: values.Name,
          NameEn: values.NameEn,
          Description: values.Description,
          SortOrder: category.SortOrder,
          IsActive: category.IsActive,
        };
        updateMutation.mutate({ id: category.ID, data: updateData });
      } else {
        // Create new category
        const createData: CreateCategoryRequest = {
          Name: values.Name,
          NameEn: values.NameEn,
          Description: values.Description,
          IsActive: true,
        };
        createMutation.mutate(createData);
      }
    } catch (error) {
      // Form validation failed
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        isEditMode
          ? t('admin.categories.editTitle') || 'עריכת קטגוריה'
          : t('admin.categories.addTitle') || 'הוספת קטגוריה חדשה'
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={t('common.save') || 'שמור'}
      cancelText={t('common.cancel') || 'ביטול'}
      width={600}
    >
      {isEditMode && (
        <Alert
          message={t('admin.categories.renameWarning') || 'שים לב'}
          description={
            t('admin.categories.renameWarningText') ||
            'שינוי שם הקטגוריה יעדכן אוטומטית את כל מקורות הנתונים הקיימים שמשתמשים בקטגוריה זו.'
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Form.Item
          name="Name"
          label={t('admin.categories.form.nameHebrew') || 'שם בעברית'}
          rules={[
            { required: true, message: t('admin.categories.form.nameRequired') || 'שם בעברית נדרש' },
            { max: 100, message: t('admin.categories.form.nameMaxLength') || 'שם לא יכול להיות ארוך מ-100 תווים' },
          ]}
        >
          <Input placeholder="לדוגמה: מכירות, כספים, מלאי" />
        </Form.Item>

        <Form.Item
          name="NameEn"
          label={t('admin.categories.form.nameEnglish') || 'שם באנגלית'}
          rules={[
            { required: true, message: t('admin.categories.form.nameEnRequired') || 'שם באנגלית נדרש' },
            { max: 100, message: t('admin.categories.form.nameEnMaxLength') || 'שם לא יכול להיות ארוך מ-100 תווים' },
          ]}
        >
          <Input className="ltr-field" placeholder="Example: Sales, Finance, Inventory" />
        </Form.Item>

        <Form.Item
          name="Description"
          label={t('admin.categories.form.description') || 'תיאור (אופציונלי)'}
          rules={[
            { max: 500, message: t('admin.categories.form.descriptionMaxLength') || 'תיאור לא יכול להיות ארוך מ-500 תווים' },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="תיאור אופציונלי של הקטגוריה"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CategoryModal;
