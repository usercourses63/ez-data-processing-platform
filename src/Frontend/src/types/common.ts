// Common type definitions

export type SortOrder = 'ascend' | 'descend';

export interface SortInfo {
  field: string;
  order: SortOrder | undefined;
}

export interface FilterInfo {
  field: string;
  value: any;
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'between';
}

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  children?: SelectOption[];
}

export interface TreeSelectOption extends SelectOption {
  children?: TreeSelectOption[];
}

export interface TableColumn<T = any> {
  title: string;
  dataIndex?: string;
  key: string;
  width?: number | string;
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

export interface BreadcrumbItem {
  title: string;
  href?: string;
  onClick?: () => void;
}

export type ThemeMode = 'light' | 'dark';

export type Language = 'he' | 'en';

export interface UserPreferences {
  language: Language;
  theme: ThemeMode;
  pageSize: number;
}
