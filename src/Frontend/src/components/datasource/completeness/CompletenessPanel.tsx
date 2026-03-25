/**
 * CompletenessPanel - Sidebar component for form completeness tracking
 *
 * Displays a persistent sidebar with:
 * - Circular progress ring showing required-field percentage (D-03)
 * - Secondary recommended-fields text (D-04)
 * - 9 tab items with color-coded status icons (D-02)
 * - Click-to-navigate tab items (D-06)
 * - Active tab highlighting (D-07)
 * - Metrics tab grayed out in create mode
 */

import React from 'react';
import { Card, Progress, Typography, Divider, Tooltip } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  WarningFilled,
  MinusCircleOutlined,
  FileTextOutlined,
  ApiOutlined,
  FileOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  BellOutlined,
  ExportOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { CompletenessState, TabCompleteness } from './types';
import { TAB_META } from './completenessConfig';

const { Text } = Typography;

interface CompletenessPanelProps {
  completeness: CompletenessState;
  activeTab: string;
  onTabClick: (tabKey: string) => void;
  isEditMode?: boolean;
}

/** Map icon name strings from TAB_META to actual Ant Design icon components */
const ICON_MAP: Record<string, React.ReactNode> = {
  FileTextOutlined: <FileTextOutlined />,
  ApiOutlined: <ApiOutlined />,
  FileOutlined: <FileOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  ClockCircleOutlined: <ClockCircleOutlined />,
  SafetyOutlined: <SafetyOutlined />,
  BellOutlined: <BellOutlined />,
  ExportOutlined: <ExportOutlined />,
  BarChartOutlined: <BarChartOutlined />,
};

/** Get the status icon for a tab based on tier and completion */
function getStatusIcon(tab: TabCompleteness): React.ReactNode {
  if (tab.isComplete) {
    return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />;
  }

  switch (tab.tier) {
    case 'required':
      return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />;
    case 'recommended':
      return <WarningFilled style={{ color: '#faad14', fontSize: 16 }} />;
    case 'optional':
    default:
      return <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />;
  }
}

/** All tab keys in display order */
const TAB_ORDER = ['basic', 'connection', 'file', 'schema', 'schedule', 'validation', 'notifications', 'output', 'metrics'];

export const CompletenessPanel: React.FC<CompletenessPanelProps> = ({
  completeness,
  activeTab,
  onTabClick,
  isEditMode = false,
}) => {
  const { t } = useTranslation();

  // Build a lookup map from completeness.tabs
  const tabMap = new Map(completeness.tabs.map((tab) => [tab.key, tab]));

  return (
    <Card
      size="small"
      style={{ position: 'sticky', top: 16 }}
      styles={{ body: { padding: '16px 12px' } }}
    >
      {/* Progress Ring (D-03) */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <Progress
          type="circle"
          percent={completeness.requiredPercent}
          size={120}
          strokeColor={{ '0%': '#ff4d4f', '100%': '#52c41a' }}
          format={(percent) => (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{percent}%</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{t('completeness.required')}</div>
            </div>
          )}
        />
      </div>

      {/* Secondary recommended text (D-04) */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {completeness.recommendedPercent}% {t('completeness.recommended')}
        </Text>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Tab list (D-02) */}
      <div>
        {TAB_ORDER.map((tabKey) => {
          const tab = tabMap.get(tabKey);
          const meta = TAB_META[tabKey];
          if (!tab || !meta) return null;

          const isActive = activeTab === tabKey;
          const isMetricsDisabled = tabKey === 'metrics' && !isEditMode;

          const tabItem = (
            <div
              key={tabKey}
              onClick={isMetricsDisabled ? undefined : () => onTabClick(tabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                cursor: isMetricsDisabled ? 'not-allowed' : 'pointer',
                backgroundColor: isActive ? '#e6f4ff' : 'transparent',
                opacity: isMetricsDisabled ? 0.45 : 1,
                transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isMetricsDisabled) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Status icon */}
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {isMetricsDisabled ? (
                  <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />
                ) : (
                  getStatusIcon(tab)
                )}
              </span>

              {/* Tab icon + label */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', color: '#8c8c8c' }}>
                  {ICON_MAP[meta.icon] || <FileTextOutlined />}
                </span>
                <span style={{ fontWeight: isActive ? 600 : 400 }}>
                  {t(meta.labelKey)}
                </span>
              </span>

              {/* Count badge for tabs with fields */}
              {tab.totalCount > 0 && !isMetricsDisabled && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#8c8c8c',
                    flexShrink: 0,
                  }}
                >
                  {tab.filledCount}/{tab.totalCount}
                </span>
              )}
            </div>
          );

          if (isMetricsDisabled) {
            return (
              <Tooltip key={tabKey} title={t('completeness.metricsUnavailable')} placement="left">
                {tabItem}
              </Tooltip>
            );
          }

          return tabItem;
        })}
      </div>

      {/* Status summary */}
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ textAlign: 'center' }}>
        {completeness.isFullyComplete ? (
          <Text type="success" style={{ fontSize: 12 }}>
            <CheckCircleFilled style={{ marginInlineEnd: 4 }} />
            {t('completeness.allComplete')}
          </Text>
        ) : (
          <Text type="danger" style={{ fontSize: 12 }}>
            <CloseCircleFilled style={{ marginInlineEnd: 4 }} />
            {t('completeness.missingFields')}
          </Text>
        )}
      </div>

      {/* Missing fields detail (D-18, GAP-03) */}
      {!completeness.isFullyComplete && completeness.missingFields.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px 12px', backgroundColor: '#fff2f0', borderRadius: 6, border: '1px solid #ffccc7' }}>
          <Text type="danger" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            {t('completeness.missingFieldsTitle', { defaultValue: 'Missing required fields:' })}
          </Text>
          <ul style={{ margin: 0, paddingInlineStart: 16, fontSize: 11 }}>
            {completeness.missingFields.map((field) => (
              <li key={field} style={{ color: '#ff4d4f' }}>
                {t(`completeness.fieldLabels.${field}`, { defaultValue: field })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
