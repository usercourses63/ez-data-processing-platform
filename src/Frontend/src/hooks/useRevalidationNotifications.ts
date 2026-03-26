/**
 * SignalR hook for revalidation event notifications.
 * Connects to InvalidRecordsService hub and:
 * - Shows toast notification on RevalidationCompleted (D-05)
 * - Dispatches custom events for page auto-refresh (D-06)
 * - Forwards EntityChanged events for InvalidRecord bulk operations
 *
 * Mount this in App.tsx alongside useEntitySync.
 */

import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';

const INVALID_RECORDS_HUB_URL = 'http://localhost:5007/hubs/invalid-records';

interface RevalidationCompletedEvent {
  dataSourceId: string;
  totalRecords: number;
  published: number;
  failed: number;
  message: string;
  messageEnglish: string;
  timestamp: string;
}

interface EntityChangedEvent {
  entityType: string;
  entityId?: string;
  action: string;
  dataSourceId?: string;
  count?: number;
}

export function useRevalidationNotifications() {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const { message } = App.useApp();
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(INVALID_RECORDS_HUB_URL)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    // Per D-05: Toast notification on revalidation completion
    connection.on('RevalidationCompleted', (event: RevalidationCompletedEvent) => {
      const isHebrew = i18n.language === 'he';
      const toastMessage = isHebrew ? event.message : event.messageEnglish;

      // Fallback if backend message is empty
      const displayMessage = toastMessage || t('revalidation.recordsResolved', {
        resolved: event.published,
        total: event.totalRecords,
      });

      message.success({
        content: displayMessage,
        duration: 10, // 10 seconds per D-05
        key: 'revalidation-complete',
      });

      // Dispatch custom event for pages to refresh data (per D-06)
      window.dispatchEvent(new CustomEvent('revalidation-completed', {
        detail: event,
      }));
    });

    // EntityChanged for stats refresh (per D-06)
    connection.on('EntityChanged', (raw: EntityChangedEvent) => {
      const data = {
        entityType: raw.entityType || '',
        action: raw.action || '',
        dataSourceId: raw.dataSourceId || '',
        count: raw.count || 0,
      };

      if (data.entityType === 'InvalidRecord') {
        window.dispatchEvent(new CustomEvent('entity-changed', {
          detail: data,
        }));
      }
    });

    connection.start().catch(err => {
      console.warn('[RevalidationNotifications] SignalR connection failed:', err.message);
    });

    return () => {
      connection.off('RevalidationCompleted');
      connection.off('EntityChanged');
      connection.stop().catch(() => {});
    };
  }, [message, i18n.language, t]);
}
