/**
 * ArchiveSettingsSection - Archive Processing Configuration
 * v0.2.0: Configures archive file handling (ZIP, TAR.GZ, RAR, 7Z)
 * Per Frontend Designer specification
 */
import React from 'react';
import { Form, Switch, Select, Input, Card, Row, Col, Typography, Tooltip } from 'antd';
import { FormInstance } from 'antd/es/form';
import { FileZipOutlined, QuestionCircleOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Text } = Typography;

interface ArchiveSettingsSectionProps {
  form: FormInstance;
  t: (key: string, params?: any) => string;
  isArchiveSource: boolean;
}

// Archive type options
const ARCHIVE_TYPES = [
  { value: 'auto', labelKey: 'datasource.archive.types.auto', fallback: 'זיהוי אוטומטי' },
  { value: 'zip', labelKey: 'datasource.archive.types.zip', fallback: 'ZIP (.zip)' },
  { value: 'tar.gz', labelKey: 'datasource.archive.types.tarGz', fallback: 'TAR.GZ (.tar.gz, .tgz)' },
  { value: 'rar', labelKey: 'datasource.archive.types.rar', fallback: 'RAR (.rar)' },
  { value: '7z', labelKey: 'datasource.archive.types.7z', fallback: '7-Zip (.7z)' },
];

export const ArchiveSettingsSection: React.FC<ArchiveSettingsSectionProps> = ({
  form,
  t,
  isArchiveSource,
}) => {
  return (
    <Card
      title={
        <span>
          <FileZipOutlined style={{ marginInlineEnd: 8 }} />
          {t('datasources.sections.archiveSettings') || 'הגדרות ארכיון'}
        </span>
      }
      size="small"
      style={{ marginTop: 16, marginBottom: 16 }}
      extra={
        <Form.Item
          name="isArchiveSource"
          valuePropName="checked"
          style={{ margin: 0 }}
        >
          <Switch
            checkedChildren={t('common.yes') || 'כן'}
            unCheckedChildren={t('common.no') || 'לא'}
            aria-labelledby="archive-toggle-label"
            aria-describedby="archive-toggle-description"
          />
        </Form.Item>
      }
    >
      {isArchiveSource ? (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }} id="archive-toggle-description">
            {t('datasources.archive.description') || 'הגדר כיצד לטפל בקבצי ארכיון דחוסים (ZIP, TAR.GZ, RAR, 7Z)'}
          </Text>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="archiveType"
                label={
                  <span id="archive-type-label">
                    {t('datasources.fields.archiveType') || 'סוג ארכיון'}
                    <Tooltip title={t('datasources.tooltips.archiveType') || 'בחר את סוג הארכיון או השאר על אוטומטי לזיהוי לפי סיומת הקובץ'}>
                      <QuestionCircleOutlined style={{ marginInlineStart: 4 }} />
                    </Tooltip>
                  </span>
                }
                initialValue="auto"
              >
                <Select aria-labelledby="archive-type-label">
                  {ARCHIVE_TYPES.map(opt => (
                    <Option key={opt.value} value={opt.value}>
                      {t(opt.labelKey) || opt.fallback}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="archivePassword"
                label={t('datasources.fields.archivePassword') || 'סיסמת ארכיון'}
                tooltip={t('datasources.tooltips.archivePassword') || 'סיסמה לפתיחת ארכיונים מוגנים (אופציונלי)'}
              >
                <Input.Password
                  className="ltr-field"
                  placeholder="********"
                  autoComplete="new-password"
                  aria-label={t('datasources.fields.archivePassword') || 'סיסמת ארכיון'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="extractionPattern"
                label={t('datasources.fields.extractionPattern') || 'תבנית חילוץ'}
                tooltip={t('datasources.tooltips.extractionPattern') || 'תבנית לסינון קבצים בתוך הארכיון. דוגמה: *.csv לחילוץ רק קבצי CSV'}
                initialValue="*.*"
                rules={[
                  {
                    pattern: /^(\*\.[\w]+|\*\.\*|[\w\-*]+\.[\w*]+)$/,
                    message: t('datasources.errors.invalidExtractionPattern') || 'תבנית חילוץ לא תקינה. דוגמאות: *.csv, data_*.json, *.*',
                  },
                ]}
              >
                <Input
                  className="ltr-field"
                  placeholder="*.csv, data_*.json, *.*"
                  aria-label={t('datasources.fields.extractionPattern') || 'תבנית חילוץ'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="processNestedArchives"
                label={t('datasources.fields.processNestedArchives') || 'עבד ארכיונים מקוננים'}
                valuePropName="checked"
                tooltip={t('datasources.tooltips.processNestedArchives') || 'אם מופעל, יעבד גם ארכיונים הנמצאים בתוך ארכיונים אחרים'}
                initialValue={false}
              >
                <Switch
                  checkedChildren={t('common.yes') || 'כן'}
                  unCheckedChildren={t('common.no') || 'לא'}
                  aria-label={t('datasources.fields.processNestedArchives') || 'עבד ארכיונים מקוננים'}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      ) : (
        <Text type="secondary" role="status" aria-live="polite">
          {t('datasources.archive.disabledHint') || 'הפעל אפשרות זו אם מקור הנתונים מכיל קבצים דחוסים'}
        </Text>
      )}
    </Card>
  );
};
