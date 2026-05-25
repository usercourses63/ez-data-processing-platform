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
              { min: 2, message: t('datasources.validation.nameMinLength') },
              { max: 100, message: t('datasources.validation.nameMaxLength') }
            ]}
          >
            <Input
              placeholder={t('datasources.placeholders.name')}
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
              { min: 2, message: t('datasources.validation.supplierMinLength') },
              { max: 50, message: t('datasources.validation.supplierMaxLength') }
            ]}
          >
            <Input
              placeholder={t('datasources.placeholders.supplier')}
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
                message={t('admin.categories.loadError')}
                description={(categoriesError as any).message}
                type="error"
                showIcon
              />
            ) : categories.length === 0 && !categoriesLoading ? (
              <Alert
                message={t('datasources.noActiveCategories')}
                description={
                  <>
                    {t('datasources.noActiveCategoriesDescription')}{' '}
                    <Link to="/admin/settings">{t('datasources.goToAdminSettings')}</Link>
                  </>
                }
                type="warning"
                showIcon
              />
            ) : (
              <Select
                placeholder={t('datasources.placeholders.category')}
                loading={categoriesLoading}
                notFoundContent={categoriesLoading ? <Spin size="small" /> : t('datasources.noCategoriesFound')}
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
            label={t('datasources.fields.invalidRecordsTtlDays')}
            tooltip={t('datasources.fields.invalidRecordsTtlTooltip')}
          >
            <InputNumber
              min={1}
              max={3650}
              placeholder="30"
              style={{ width: '100%' }}
              addonAfter={t('datasources.fields.days')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Form.Item
            name="InvalidRecordsTtlDays"
            label={t('revalidation.ttlDays')}
            tooltip={t('revalidation.ttlDaysTooltip')}
          >
            <InputNumber
              min={1}
              max={365}
              placeholder="4"
              style={{ width: '100%' }}
              addonAfter={t('common.days')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label={t('datasources.fields.description')}
        rules={[{ max: 500, message: t('datasources.validation.descriptionMaxLength') }]}
      >
        <TextArea
          rows={3}
          placeholder={t('datasources.placeholders.description')}
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
          checkedChildren={t('datasources.fields.activeLabel')}
          unCheckedChildren={t('datasources.fields.inactiveLabel')}
        />
      </Form.Item>
    </>
  );
};
