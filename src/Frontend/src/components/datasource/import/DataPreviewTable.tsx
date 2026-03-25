/**
 * DataPreviewTable - Shows first 5 rows of parsed data in an Ant Design Table.
 * Per D-09: 5 preview rows with footer showing total row count.
 */
import React from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';

interface DataPreviewTableProps {
  previewRows: Record<string, unknown>[];
  fieldNames: string[];
  totalRowCount: number;
}

const DataPreviewTable: React.FC<DataPreviewTableProps> = ({
  previewRows,
  fieldNames,
  totalRowCount,
}) => {
  const { t } = useTranslation();

  const columns: ColumnsType<Record<string, unknown>> = fieldNames.map((name) => ({
    title: name,
    dataIndex: name,
    key: name,
    ellipsis: true,
    width: Math.max(100, name.length * 10),
    render: (value: unknown) => {
      if (value === null || value === undefined) return <span style={{ color: '#bfbfbf' }}>null</span>;
      if (typeof value === 'boolean') return String(value);
      return String(value);
    },
  }));

  return (
    <Table
      columns={columns}
      dataSource={previewRows.map((row, idx) => ({ ...row, _key: idx }))}
      rowKey="_key"
      pagination={false}
      size="small"
      bordered
      scroll={{ x: fieldNames.length > 5 ? fieldNames.length * 150 : undefined }}
      footer={() => (
        <span style={{ fontWeight: 500 }}>
          {t('datasources.import.totalRows', { count: totalRowCount })}
        </span>
      )}
    />
  );
};

export default DataPreviewTable;
