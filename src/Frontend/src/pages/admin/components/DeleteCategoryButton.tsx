import React, { useState } from 'react';
import { Button, Modal, Tooltip, Spin, Alert } from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getCategoryUsageCount } from '../../../services/categories-api-client';
import type { DataSourceCategory } from '../../../services/categories-api-client';

interface DeleteCategoryButtonProps {
  category: DataSourceCategory;
  onDelete: (category: DataSourceCategory) => void;
}

const DeleteCategoryButton: React.FC<DeleteCategoryButtonProps> = ({
  category,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usageCount, setUsageCount] = useState<number>(0);
  const [canHardDelete, setCanHardDelete] = useState(false);

  const handleClick = async () => {
    setModalVisible(true);
    setLoading(true);

    try {
      const usageInfo = await getCategoryUsageCount(category.ID);
      setUsageCount(usageInfo.usageCount);
      setCanHardDelete(usageInfo.canHardDelete);
    } catch (error) {
      console.error('Error fetching usage count:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    setModalVisible(false);
    onDelete(category);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  return (
    <>
      <Tooltip title={t('admin.categories.actions.delete') || 'מחק'}>
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={handleClick}
        />
      </Tooltip>

      <Modal
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#faad14', marginLeft: 8 }} />
            {t('admin.categories.confirmDelete') || 'אישור מחיקת קטגוריה'}
          </span>
        }
        open={modalVisible}
        onOk={handleConfirm}
        onCancel={handleCancel}
        okText={canHardDelete ? 'מחק לצמיתות' : 'סמן כלא פעיל'}
        cancelText={t('common.cancel') || 'ביטול'}
        okButtonProps={{ danger: true }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin tip="בודק שימוש..." />
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '16px', marginBottom: 16 }}>
              <strong>{category.Name}</strong> ({category.NameEn})
            </p>

            {canHardDelete ? (
              <Alert
                message="מחיקה לצמיתות"
                description={
                  <>
                    <p>קטגוריה זו <strong>אינה בשימוש</strong> על ידי אף מקור נתונים.</p>
                    <p>המחיקה תהיה <strong>לצמיתות</strong> ולא ניתן יהיה לשחזר.</p>
                  </>
                }
                type="warning"
                showIcon
              />
            ) : (
              <Alert
                message="מחיקה רכה (Soft Delete)"
                description={
                  <>
                    <p>
                      קטגוריה זו בשימוש על ידי <strong>{usageCount} מקורות נתונים</strong>.
                    </p>
                    <p>הקטגוריה תסומן כ<strong>לא פעילה</strong> אך תישמר במערכת.</p>
                    <p>מקורות נתונים קיימים ישמרו את הערך.</p>
                    <p style={{ marginTop: 8, color: '#1890ff' }}>
                      💡 ניתן להפעיל מחדש בכל עת באמצעות כפתור ההפעלה.
                    </p>
                  </>
                }
                type="info"
                showIcon
              />
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default DeleteCategoryButton;
