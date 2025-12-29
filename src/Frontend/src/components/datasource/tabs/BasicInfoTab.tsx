import React from 'react';
import { Form, Input, Select, Switch, InputNumber, Row, Col, Alert, Spin } from 'antd';
import { FormInstance } from 'antd/es/form';
import { useQuery } from '@tanstack/react-query';
import { getAllCategories } from '../../../services/categories-api-client';
import { Link } from 'react-router-dom';

const { TextArea } = Input;
const { Option } = Select;

interface BasicInfoTabProps {
  form: FormInstance;
  t: (key: string) => string;
}

export const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ form, t }) => {
  // Fetch active categories from API
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => getAllCategories(false), // Only active categories
  });

  return (
    <>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Form.Item
            name="name"
            label={t('datasources.fields.name')}
            rules={[
              { required: true, message: t('errors.required') },
              { min: 2, message: 'שם מקור הנתונים חייב להיות לפחות 2 תווים' },
              { max: 100, message: 'שם מקור הנתונים לא יכול להיות ארוך מ-100 תווים' }
            ]}
          >
            <Input 
              placeholder="לדוגמה: נתוני מכירות חודשיים" 
              maxLength={100}
            />
          </Form.Item>
        </Col>

        <Col xs={24} lg={12}>
          <Form.Item
            name="supplierName"
            label={t('datasources.fields.supplierName')}
            rules={[
              { required: true, message: t('errors.required') },
              { min: 2, message: 'שם הספק חייב להיות לפחות 2 תווים' },
              { max: 50, message: 'שם הספק לא יכול להיות ארוך מ-50 תווים' }
            ]}
          >
            <Input 
              placeholder="לדוגמה: חברת ABC" 
              maxLength={50}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Form.Item
            name="category"
            label={t('datasources.fields.category')}
            rules={[{ required: true, message: t('errors.required') }]}
          >
            {categoriesError ? (
              <Alert
                message="שגיאה בטעינת קטגוריות"
                description={(categoriesError as any).message}
                type="error"
                showIcon
              />
            ) : categories.length === 0 && !categoriesLoading ? (
              <Alert
                message="לא קיימות קטגוריות פעילות"
                description={
                  <>
                    יש ליצור קטגוריה אחת לפחות בטרם יצירת מקור נתונים.{' '}
                    <Link to="/admin/settings">עבור להגדרות מערכת</Link>
                  </>
                }
                type="warning"
                showIcon
              />
            ) : (
              <Select
                placeholder="בחר קטגוריה"
                loading={categoriesLoading}
                notFoundContent={categoriesLoading ? <Spin size="small" /> : 'לא נמצאו קטגוריות'}
              >
                {categories.map(cat => (
                  <Option key={cat.ID} value={cat.Name}>
                    {cat.Name} ({cat.NameEn})
                  </Option>
                ))}
              </Select>
            )}
          </Form.Item>
        </Col>

        <Col xs={24} lg={12}>
          <Form.Item
            name="retentionDays"
            label="תקופת שמירה (ימים)"
            tooltip="כמה ימים לשמור קבצים מעובדים לפני מחיקה"
          >
            <InputNumber 
              min={1} 
              max={3650} 
              placeholder="30" 
              style={{ width: '100%' }}
              addonAfter="ימים"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label={t('datasources.fields.description')}
        rules={[{ max: 500, message: 'התיאור לא יכול להיות ארוך מ-500 תווים' }]}
      >
        <TextArea 
          rows={3}
          placeholder="הוסף תיאור מפורט על מקור הנתונים, מה הוא מכיל ואיך הוא משמש"
          maxLength={500}
          showCount
        />
      </Form.Item>

      <Form.Item
        name="isActive"
        valuePropName="checked"
        label={t('datasources.fields.status')}
      >
        <Switch 
          checkedChildren="פעיל" 
          unCheckedChildren="לא פעיל"
        />
      </Form.Item>
    </>
  );
};
