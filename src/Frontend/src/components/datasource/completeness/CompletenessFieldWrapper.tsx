/**
 * CompletenessFieldWrapper - Per-field colored left border indicator
 *
 * Wraps a Form.Item with a colored left border based on its completion status (D-13):
 * - Red: required field that is empty
 * - Green: field that is filled
 * - Gray: optional field
 *
 * Uses CSS logical properties (border-inline-start) for automatic RTL support.
 */

import React from 'react';
import type { FieldStatus } from './types';

interface CompletenessFieldWrapperProps {
  status: FieldStatus;
  children: React.ReactNode;
}

const STATUS_CLASS_MAP: Record<FieldStatus, string> = {
  'filled': 'completeness-border completeness-border--filled',
  'required-empty': 'completeness-border completeness-border--required-empty',
  'optional-empty': 'completeness-border completeness-border--optional',
};

export const CompletenessFieldWrapper: React.FC<CompletenessFieldWrapperProps> = ({
  status,
  children,
}) => {
  return (
    <div className={STATUS_CLASS_MAP[status]}>
      {children}
    </div>
  );
};
