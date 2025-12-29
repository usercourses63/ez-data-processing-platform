import React from 'react';
import { Table, Tag, Button, Popconfirm, Space, Tooltip } from 'antd';
import { EditOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { DataSourceCategory } from '../../../services/categories-api-client';
import type { ColumnsType } from 'antd/es/table';
import DeleteCategoryButton from './DeleteCategoryButton';

interface CategoryTableProps {
  categories: DataSourceCategory[];
  loading: boolean;
  onEdit: (category: DataSourceCategory) => void;
  onDelete: (category: DataSourceCategory) => void;
  onToggleActive: (category: DataSourceCategory) => void;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
  categories,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const { t } = useTranslation();

  const columns: ColumnsType<DataSourceCategory> = [
    {
      title: t('admin.categories.columns.name') || 'שם (עברית)',
      dataIndex: 'Name',
      key: 'Name',
      className: 'category-name-cell',
      sorter: (a, b) => a.Name.localeCompare(b.Name, 'he'),
      defaultSortOrder: 'ascend',
    },
    {
      title: t('admin.categories.columns.nameEn') || 'שם (אנגלית)',
      dataIndex: 'NameEn',
      key: 'NameEn',
      className: 'ltr-field',
    },
    {
      title: t('admin.categories.columns.description') || 'תיאור',
      dataIndex: 'Description',
      key: 'Description',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: t('admin.categories.columns.status') || 'סטטוס',
      dataIndex: 'IsActive',
      key: 'IsActive',
      width: 120,
      align: 'center',
      filters: [
        { text: t('admin.categories.filters.active') || 'פעיל', value: true },
        { text: t('admin.categories.filters.inactive') || 'לא פעיל', value: false },
      ],
      onFilter: (value, record) => record.IsActive === value,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            {t('admin.categories.status.active') || 'פעיל'}
          </Tag>
        ) : (
          <Tag color="default" icon={<StopOutlined />}>
            {t('admin.categories.status.inactive') || 'לא פעיל'}
          </Tag>
        ),
    },
    {
      title: t('admin.categories.columns.actions') || 'פעולות',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space className="category-actions">
          <Tooltip title={t('admin.categories.actions.edit') || 'ערוך'}>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>

          <Popconfirm
            title={
              record.IsActive
                ? t('admin.categories.confirmToggleInactive') || 'האם לסמן כלא פעיל?'
                : t('admin.categories.confirmToggleActive') || 'האם להפעיל מחדש?'
            }
            description={
              record.IsActive
                ? 'קטגוריה זו תוסתר מרשימת הבחירה אך תישאר במערכת'
                : 'קטגוריה זו תופיע שוב ברשימת הבחירה'
            }
            onConfirm={() => onToggleActive(record)}
            okText={t('common.yes') || 'כן'}
            cancelText={t('common.no') || 'לא'}
          >
            <Tooltip
              title={
                record.IsActive
                  ? t('admin.categories.actions.deactivate') || 'סמן כלא פעיל'
                  : t('admin.categories.actions.activate') || 'הפעל מחדש'
              }
            >
              <Button
                type="link"
                icon={record.IsActive ? <StopOutlined /> : <CheckCircleOutlined />}
                style={{ color: record.IsActive ? '#faad14' : '#52c41a' }}
              />
            </Tooltip>
          </Popconfirm>

          <DeleteCategoryButton
            category={record}
            onDelete={onDelete}
          />
        </Space>
      ),
    },
  ];

  return (
    <Table<DataSourceCategory>
      columns={columns}
      dataSource={categories}
      loading={loading}
      rowKey="ID"
      rowClassName={(record) => (record.IsActive ? '' : 'inactive-row')}
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
        showTotal: (total) => `סך הכל ${total} קטגוריות`,
      }}
    />
  );
};

export default CategoryTable;
