import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClusterInfo } from '../../../types/kubernetes.types';

interface ClusterHeaderProps {
  clusterInfo: ClusterInfo;
  lastUpdate: Date;
}

const ClusterHeader: React.FC<ClusterHeaderProps> = ({ clusterInfo, lastUpdate }) => {
  const { t } = useTranslation();

  const formatLastUpdate = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);

    if (diff < 10) return t('monitoring.justNow');
    if (diff < 60) return `${diff}${t('monitoring.secondsAgo')}`;

    const minutes = Math.floor(diff / 60);
    return `${minutes}${t('monitoring.minutesAgo')}`;
  };

  return (
    <div className="cluster-header" style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      border: '1px solid #334155'
    }}>
      <div className="cluster-header-left">
        <div className="k8s-icon" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          color: '#ffffff'
        }}>K8s</div>
        <h2 className="cluster-title" style={{ color: '#f1f5f9' }}>
          {t('monitoring.k8sOperationsCenter')}
        </h2>
      </div>
      <div className="cluster-info-grid">
        <div className="cluster-stat">
          <span className="cluster-stat-label" style={{ color: '#94a3b8' }}>
            {t('monitoring.cluster')}
          </span>
          <span className="cluster-stat-value" style={{ color: '#3b82f6' }}>
            {clusterInfo.clusterName}
          </span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label" style={{ color: '#94a3b8' }}>
            {t('monitoring.namespace')}
          </span>
          <span className="cluster-stat-value" style={{ color: '#3b82f6' }}>
            {clusterInfo.namespace}
          </span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label" style={{ color: '#94a3b8' }}>
            {t('monitoring.version')}
          </span>
          <span className="cluster-stat-value" style={{ color: '#3b82f6' }}>
            {clusterInfo.version}
          </span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label" style={{ color: '#94a3b8' }}>
            {t('monitoring.pods')}
          </span>
          <span className="cluster-stat-value" style={{ color: '#3b82f6' }}>
            {clusterInfo.healthyPods}/{clusterInfo.totalPods}
          </span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label" style={{ color: '#94a3b8' }}>
            {t('monitoring.lastUpdate')}
          </span>
          <span className="cluster-stat-value cluster-stat-update" style={{ color: '#10b981' }}>
            {formatLastUpdate()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClusterHeader;
