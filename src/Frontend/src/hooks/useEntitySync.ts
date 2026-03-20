/**
 * Global SignalR hook for real-time entity sync across all pages.
 * Subscribes to EntityChanged events and invalidates React Query cache.
 * Mount this in App.tsx so CRUD changes broadcast to all connected clients.
 */

import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';

export function useEntitySync() {
  const queryClient = useQueryClient();
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const hubUrl = `${window.location.protocol}//${window.location.host}/hubs/monitoring`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('EntityChanged', (raw: any) => {
      // SignalR .NET serializes with camelCase by default
      const data = {
        entityType: raw.entityType || raw.EntityType || '',
        entityId: raw.entityId || raw.EntityId || '',
        action: raw.action || raw.Action || '',
        version: raw.version || raw.Version || 0,
      };
      console.log(`[EntitySync] ${data.entityType} ${data.entityId} ${data.action} v${data.version}`);

      const queryKeyMap: Record<string, string[]> = {
        'DataSource': ['datasources', 'datasource'],
        'NasDevice': ['nasDevices', 'nasdevices'],
        'AdminServer': ['adminservers', 'servers'],
        'Category': ['categories'],
        'InvalidRecord': ['invalidRecords', 'invalid-records'],
      };

      const keysToInvalidate = queryKeyMap[data.entityType] || [data.entityType.toLowerCase()];
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      // Also dispatch a DOM event for pages that use raw fetch (not React Query)
      window.dispatchEvent(new CustomEvent('entity-changed', { detail: data }));
    });

    connection.start().catch(err => {
      console.warn('[EntitySync] SignalR connection failed:', err.message);
    });

    return () => {
      connection.off('EntityChanged');
      connection.stop().catch(() => {});
    };
  }, [queryClient]);
}
