import React from 'react';
import { Table, Space, Empty } from 'antd';
import type { ColumnType, TablePaginationConfig, SorterResult, FilterValue } from 'antd/es/table/interface';
import { useTranslation } from 'react-i18next';

export interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
  showTotal?: (total: number, range: [number, number]) => string;
}

export interface DataTableProps<T> {
  columns: ColumnType<T>[];
  data: T[];
  loading?: boolean;
  pagination?: PaginationConfig | false;
  onPaginationChange?: (page: number, pageSize: number) => void;
  onSort?: (field: string, order: 'ascend' | 'descend' | undefined) => void;
  onFilter?: (filters: Record<string, FilterValue | null>) => void;
  rowKey: string | ((record: T) => string);
  actions?: (record: T) => React.ReactNode;
  emptyText?: string;
  size?: 'small' | 'middle' | 'large';
  bordered?: boolean;
  showHeader?: boolean;
  scroll?: { x?: number | string; y?: number | string };
  rowSelection?: any;
  expandable?: any;
  className?: string;
  style?: React.CSSProperties;
}

export const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination,
  onPaginationChange,
  onSort,
  onFilter,
  rowKey,
  emptyText,
  size = 'middle',
  bordered = false,
  showHeader = true,
  scroll,
  rowSelection,
  expandable,
  className,
  style
}: DataTableProps<T>) => {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  // Handle table changes (pagination, sorting, filtering)
  const handleTableChange = (
    newPagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<T> | SorterResult<T>[]
  ) => {
    // Handle pagination
    if (onPaginationChange && newPagination.current && newPagination.pageSize) {
      onPaginationChange(newPagination.current, newPagination.pageSize);
    }

    // Handle sorting
    if (onSort && !Array.isArray(sorter) && sorter.order) {
      const field = sorter.field as string;
      const order = sorter.order as 'ascend' | 'descend';
      onSort(field, order);
    }

    // Handle filtering
    if (onFilter) {
      onFilter(filters);
    }
  };

  // Default empty text
  const defaultEmptyText = emptyText || (isHebrew ? 'אין נתונים להצגה' : 'No data');

  // Configure pagination
  const paginationConfig: TablePaginationConfig | false = pagination === false ? false : {
    current: pagination?.current || 1,
    pageSize: pagination?.pageSize || 10,
    total: pagination?.total || 0,
    showSizeChanger: pagination?.showSizeChanger !== false,
    pageSizeOptions: pagination?.pageSizeOptions || ['10', '25', '50', '100'],
    showTotal: pagination?.showTotal || ((total, range) =>
      isHebrew
        ? `${range[0]}-${range[1]} מתוך ${total} רשומות`
        : `${range[0]}-${range[1]} of ${total} items`
    ),
    position: ['bottomCenter']
  };

  return (
    <Table<T>
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={paginationConfig}
      onChange={handleTableChange}
      rowKey={rowKey}
      locale={{
        emptyText: <Empty description={defaultEmptyText} />
      }}
      size={size}
      bordered={bordered}
      showHeader={showHeader}
      scroll={scroll}
      rowSelection={rowSelection}
      expandable={expandable}
      className={className}
      style={style}
    />
  );
};
