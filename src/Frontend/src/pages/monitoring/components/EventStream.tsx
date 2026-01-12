import React, { useState, useMemo } from 'react';
import { Card, Select, Tag, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { PipelineEvent } from '../../../types/monitoring.types';
import { format } from 'date-fns';

interface EventStreamProps {
  events: PipelineEvent[];
}

const EventStream: React.FC<EventStreamProps> = ({ events }) => {
  const { t } = useTranslation();
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');

  // Get unique services from events
  const services = useMemo(() => {
    const uniqueServices = Array.from(new Set(events.map(e => e.service)));
    return uniqueServices.sort();
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const serviceMatch = selectedService === 'all' || event.service === selectedService;
      const levelMatch = selectedLevel === 'all' || event.level === selectedLevel;
      return serviceMatch && levelMatch;
    });
  }, [events, selectedService, selectedLevel]);

  // Get level color for tags
  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'info':
        return 'blue';
      case 'warn':
        return 'orange';
      case 'error':
        return 'red';
      case 'debug':
        return 'purple';
      default:
        return 'default';
    }
  };

  // Format timestamp
  const formatTime = (date: Date): string => {
    return format(date, 'HH:mm:ss.SSS');
  };

  return (
    <Card
      title={t('monitoring.liveEventStream', 'Live Event Stream')}
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Select
            value={selectedLevel}
            onChange={setSelectedLevel}
            style={{ width: 120 }}
            size="small"
            options={[
              { label: t('monitoring.allLevels', 'All Levels'), value: 'all' },
              { label: 'INFO', value: 'info' },
              { label: 'WARN', value: 'warn' },
              { label: 'ERROR', value: 'error' },
              { label: 'DEBUG', value: 'debug' },
            ]}
          />
          <Select
            value={selectedService}
            onChange={setSelectedService}
            style={{ width: 180 }}
            size="small"
            options={[
              { label: t('monitoring.allServices', 'All Services'), value: 'all' },
              ...services.map(s => ({ label: s, value: s })),
            ]}
          />
        </div>
      }
      style={{ height: '100%', background: '#1e293b', border: '1px solid #334155' }}
    >
      <div
        className="event-feed"
        style={{
          maxHeight: 400,
          minHeight: 400,
          overflowY: 'auto',
          fontFamily: 'Courier New, monospace',
          fontSize: '0.85rem',
        }}
      >
        {filteredEvents.length === 0 ? (
          <Empty
            description={t('monitoring.noEvents', 'No events to display')}
            style={{ marginTop: 100 }}
          />
        ) : (
          filteredEvents.map(event => (
            <div
              key={event.id}
              className={`event-item event-${event.level}`}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                lineHeight: '1.5',
              }}
            >
              <span className="event-time" style={{ color: '#cbd5e1', marginRight: 10 }}>
                [{formatTime(event.timestamp)}]
              </span>
              <Tag color={getLevelColor(event.level)} style={{ marginRight: 10, fontWeight: 600 }}>
                {event.level.toUpperCase()}
              </Tag>
              <span className="event-service" style={{ color: '#3b82f6', fontWeight: 600, marginRight: 10 }}>
                [{event.service}]
              </span>
              <span className="event-message" style={{ color: '#f1f5f9' }}>
                {event.message}
              </span>
              {event.correlationId && (
                <span className="event-correlation" style={{ color: '#94a3b8', marginLeft: 10, fontSize: '0.75rem' }}>
                  (ID: {event.correlationId})
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default EventStream;
