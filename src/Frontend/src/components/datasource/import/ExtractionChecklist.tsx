/**
 * ExtractionChecklist - Shows each field with detected type and auto-suggested constraint.
 * Per D-10: Field list with type + constraint summary.
 */
import React from 'react';
import { Typography } from 'antd';
import { CheckCircleFilled, MinusCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { FieldConstraintSummary } from '../../../utils/fileAnalyzer/types';

const { Text, Title } = Typography;

interface ExtractionChecklistProps {
  fieldNames: string[];
  fieldTypes: Record<string, string>;
  fieldConstraints: Record<string, FieldConstraintSummary>;
}

/**
 * Format a constraint summary into a short readable string.
 */
function formatConstraint(summary: FieldConstraintSummary): string {
  const parts: string[] = [];

  if (summary.format) {
    parts.push(`${summary.format} format`);
  }

  for (const c of summary.constraints) {
    if (c.confidence !== 'low') {
      parts.push(`${c.constraint}: ${c.value}`);
    }
  }

  if (summary.pattern) {
    parts.push('pattern');
  }

  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

const ExtractionChecklist: React.FC<ExtractionChecklistProps> = ({
  fieldNames,
  fieldTypes,
  fieldConstraints,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <Title level={5} style={{ marginBottom: 12 }}>
        {t('datasources.import.extractedFields')}
      </Title>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          lineHeight: '24px',
        }}
      >
        {fieldNames.map((name) => {
          const type = fieldTypes[name] || 'string';
          const constraint = fieldConstraints[name];
          const hasTypeOrConstraint = !!type || (constraint && constraint.constraints.length > 0);
          const constraintStr = constraint ? formatConstraint(constraint) : '';

          return (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasTypeOrConstraint ? (
                <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
              ) : (
                <MinusCircleFilled style={{ color: '#d9d9d9', fontSize: 14 }} />
              )}
              <Text strong style={{ minWidth: 100 }}>{name}</Text>
              <Text type="secondary">: {type}</Text>
              {constraintStr && (
                <Text style={{ color: '#1890ff', fontSize: 12 }}> {constraintStr}</Text>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExtractionChecklist;
