import React from 'react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { DistributedTrace } from '../../../types/kubernetes.types';

interface DistributedTracingProps {
  trace: DistributedTrace;
}

/** Strip common prefixes from Jaeger service names for compact display */
const shortServiceName = (name: string): string => {
  return name
    .replace(/^DataProcessing\./, '')
    .replace(/^Processing\./, '');
};

const DistributedTracing: React.FC<DistributedTracingProps> = ({ trace }) => {
  const { t } = useTranslation();

  const getSpanColor = (index: number) => {
    const colors = [
      'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
      'linear-gradient(90deg, #10b981 0%, #059669 100%)',
      'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
      'linear-gradient(90deg, #ec4899 0%, #db2777 100%)',
      'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
      'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)',
      'linear-gradient(90deg, #a855f7 0%, #9333ea 100%)',
      'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="distributed-tracing-container">
      <div className="trace-header">
        <div className="trace-info">
          <span className="trace-label">{t('monitoring.traceId')}:</span>
          <span className="trace-id">{trace.traceId}</span>
        </div>
        <div className="trace-info">
          <span className="trace-label">{t('monitoring.totalDuration')}:</span>
          <span className="trace-duration">{Math.round(trace.totalDuration * 100) / 100}ms</span>
        </div>
      </div>

      <div className="trace-timeline">
        <div className="timeline-header">
          <div className="timeline-header-service">{t('monitoring.service')}</div>
          <div className="timeline-header-bar">
            <span className="timeline-marker">0ms</span>
            <span className="timeline-marker timeline-marker-end">{Math.round(trace.totalDuration * 100) / 100}ms</span>
          </div>
        </div>

        {trace.spans.map((span, index) => {
          const startPercent = (span.start / trace.totalDuration) * 100;
          const widthPercent = (span.duration / trace.totalDuration) * 100;

          const displayName = shortServiceName(span.serviceName);
          const durationRounded = Math.round(span.duration * 100) / 100;

          return (
            <div key={`${span.service}-${index}`} className="trace-span">
              <Tooltip title={span.serviceName}>
                <div className="trace-service-name">{displayName}</div>
              </Tooltip>
              <div className="trace-bar-container">
                <div
                  className="trace-bar"
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(widthPercent, 1)}%`,
                    background: getSpanColor(index),
                  }}
                >
                  <span className="trace-bar-duration">{durationRounded}ms</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="trace-summary">
        <div className="trace-summary-item">
          <span className="trace-summary-label">{t('monitoring.totalSpans')}:</span>
          <span className="trace-summary-value">{trace.spans.length}</span>
        </div>
        <div className="trace-summary-item">
          <span className="trace-summary-label">{t('monitoring.timestamp')}:</span>
          <span className="trace-summary-value">{trace.timestamp.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default DistributedTracing;
