import React, { useState } from 'react';
import { Button, message, Space, Badge, Typography, Alert } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAllCategories, deleteCategory, toggleCategoryActive } from '../../../services/categories-api-client';
import type { DataSourceCategory } from '../../../services/categories-api-client';
import CategoryTable from '../components/CategoryTable';
import CategoryModal from '../components/CategoryModal';

const CategoryManagementTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DataSourceCategory | null>(null);

  // Fetch all categories (including inactive)
  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => getAllCategories(true), // Include inactive
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success(t('admin.categories.deleteSuccess') || 'קטגוריה נמחקה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: any) => {
      message.error(error.message || t('admin.categories.deleteError') || 'שגיאה במחיקת קטגוריה');
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleCategoryActive(id, isActive),
    onSuccess: () => {
      message.success(t('admin.categories.toggleSuccess') || 'סטטוס קטגוריה עודכן בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: any) => {
      message.error(error.message || t('admin.categories.toggleError') || 'שגיאה בשינוי סטטוס קטגוריה');
    },
  });

  const handleAdd = () => {
    setEditingCategory(null);
    setIsModalVisible(true);
  };

  const handleEdit = (category: DataSourceCategory) => {
    setEditingCategory(category);
    setIsModalVisible(true);
  };

  const handleDelete = (category: DataSourceCategory) => {
    deleteMutation.mutate(category.ID);
  };

  const handleToggleActive = (category: DataSourceCategory) => {
    toggleActiveMutation.mutate({
      id: category.ID,
      isActive: !category.IsActive,
    });
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
    setEditingCategory(null);
  };

  const handleModalSuccess = () => {
    setIsModalVisible(false);
    setEditingCategory(null);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  if (error) {
    return (
      <Alert
        message="שגיאה בטעינת קטגוריות"
        description={(error as any).message}
        type="error"
        showIcon
      />
    );
  }

  // Count active vs inactive
  const activeCount = categories.filter(c => c.IsActive).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('admin.categories.subtitle') || 'ניהול קטגוריות מקורות נתונים'}
          </Typography.Title>
          <Typography.Text type="secondary">
            <Badge status="success" text={`${activeCount} פעילות`} />
            {' | '}
            <Badge status="default" text={`${inactiveCount} לא פעילות`} />
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          {t('admin.categories.addButton') || 'הוסף קטגוריה'}
        </Button>
      </div>

      <CategoryTable
        categories={categories}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      <CategoryModal
        visible={isModalVisible}
        category={editingCategory}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </Space>
  );
};

export default CategoryManagementTab;
