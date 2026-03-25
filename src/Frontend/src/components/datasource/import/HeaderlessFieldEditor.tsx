/**
 * HeaderlessFieldEditor - Toggle for header detection + editable field names for headerless CSV.
 * Per D-12, D-13, D-14, D-15.
 */
import React from 'react';
import { Switch, Input, Typography, Space } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface HeaderlessFieldEditorProps {
  fieldNames: string[];
  previewRows: Record<string, unknown>[];
  hasHeaders: boolean;
  onFieldNamesChange: (names: string[]) => void;
  onHasHeadersChange: (val: boolean) => void;
}

const HeaderlessFieldEditor: React.FC<HeaderlessFieldEditorProps> = ({
  fieldNames,
  previewRows,
  hasHeaders,
  onFieldNamesChange,
  onHasHeadersChange,
}) => {
  const { t } = useTranslation();

  const handleFieldNameChange = (index: number, value: string) => {
    const updated = [...fieldNames];
    updated[index] = value;
    onFieldNamesChange(updated);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Space align="center" style={{ marginBottom: 12 }}>
        <Text strong>{t('datasources.import.firstRowIsHeaders')}</Text>
        <Switch
          checked={hasHeaders}
          onChange={onHasHeadersChange}
          checkedChildren={t('common.yes')}
          unCheckedChildren={t('common.no')}
        />
      </Space>

      {!hasHeaders && (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {t('datasources.import.editFieldNames')}
          </Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {fieldNames.map((name, idx) => (
              <Input
                key={idx}
                size="small"
                value={name}
                placeholder={`field_${idx + 1}`}
                onChange={(e) => handleFieldNameChange(idx, e.target.value)}
                style={{ width: 140 }}
              />
            ))}
          </div>
          {/* Show 1-2 data rows as reference */}
          {previewRows.slice(0, 2).map((row, rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                padding: '4px 0',
                color: '#8c8c8c',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              {fieldNames.map((name, colIdx) => (
                <span key={colIdx} style={{ width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(row[name] ?? '')}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderlessFieldEditor;
