import React, { useState, useEffect } from 'react';
import { Card, Alert, Button, Space, Popconfirm, Badge } from 'antd';
import { DownloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import * as jsYaml from 'js-yaml';
import { SchemaBuilderNew } from '../../../pages/schema/SchemaBuilderNew';
import { type JSONSchema } from 'jsonjoy-builder';
import { invalidRecordsApiClient } from '../../../services/invalidrecords-api-client';

interface SchemaTabProps {
  jsonSchema: JSONSchema;
  onChange: (schema: JSONSchema) => void;
  dataSourceId?: string;
}

export const SchemaTab: React.FC<SchemaTabProps> = ({ jsonSchema, onChange, dataSourceId }) => {
  const { t } = useTranslation();
  const [invalidCount, setInvalidCount] = useState(0);
  const [revalidating, setRevalidating] = useState(false);

  useEffect(() => {
    if (dataSourceId) {
      invalidRecordsApiClient.getRevalidateCount(dataSourceId)
        .then(res => { if (res.isSuccess) setInvalidCount(res.data?.count || 0); })
        .catch(() => { /* silently ignore */ });
    }
  }, [dataSourceId]);

  const handleDownloadJson = () => {
    const json = JSON.stringify(jsonSchema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-${dataSourceId || 'untitled'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadYaml = () => {
    const yaml = jsYaml.dump(jsonSchema);
    const blob = new Blob([yaml], { type: 'application/x-yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-${dataSourceId || 'untitled'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRevalidateAll = async () => {
    if (!dataSourceId) return;
    setRevalidating(true);
    try {
      await invalidRecordsApiClient.revalidateAll(dataSourceId);
      // Refresh count after revalidation
      const res = await invalidRecordsApiClient.getRevalidateCount(dataSourceId);
      if (res.isSuccess) setInvalidCount(res.data?.count || 0);
    } finally {
      setRevalidating(false);
    }
  };

  return (
    <>
      <Alert
        message="הגדר Schema לאימות נתונים"
        description="השתמש בעורך המקצועי של jsonjoy-builder לבניית JSON Schema. כולל תמיכה בעברית, regex helper, validation, ודוגמאות JSON."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadJson}>
          {t('revalidation.jsonDownload', 'הורד JSON')}
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadYaml}>
          {t('revalidation.yamlDownload')}
        </Button>
        {invalidCount > 0 && dataSourceId && (
          <Popconfirm
            title={t('revalidation.revalidateConfirmTitle')}
            description={t('revalidation.revalidateConfirmDatasource')}
            onConfirm={handleRevalidateAll}
            okText={t('revalidation.revalidateAll')}
            cancelText={t('common.cancel')}
          >
            <Badge count={invalidCount} size="small">
              <Button icon={<SyncOutlined spin={revalidating} />} loading={revalidating}>
                {t('revalidation.revalidateAll')}
              </Button>
            </Badge>
          </Popconfirm>
        )}
      </Space>

      <Card style={{ minHeight: '650px' }}>
        <SchemaBuilderNew
          initialSchema={jsonSchema}
          onChange={onChange}
          height="650px"
        />
      </Card>
    </>
  );
};
