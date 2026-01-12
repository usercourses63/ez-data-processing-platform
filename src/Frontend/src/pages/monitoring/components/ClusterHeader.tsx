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
    <div className="cluster-header">
      <div className="cluster-header-left">
        <div className="k8s-icon">K8s</div>
        <h2 className="cluster-title">{t('monitoring.k8sOperationsCenter')}</h2>
      </div>
      <div className="cluster-info-grid">
        <div className="cluster-stat">
          <span className="cluster-stat-label">{t('monitoring.cluster')}</span>
          <span className="cluster-stat-value">{clusterInfo.clusterName}</span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label">{t('monitoring.namespace')}</span>
          <span className="cluster-stat-value">{clusterInfo.namespace}</span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label">{t('monitoring.version')}</span>
          <span className="cluster-stat-value">{clusterInfo.version}</span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label">{t('monitoring.pods')}</span>
          <span className="cluster-stat-value">
            {clusterInfo.healthyPods}/{clusterInfo.totalPods}
          </span>
        </div>
        <div className="cluster-stat">
          <span className="cluster-stat-label">{t('monitoring.lastUpdate')}</span>
          <span className="cluster-stat-value cluster-stat-update">{formatLastUpdate()}</span>
        </div>
      </div>
    </div>
  );
};

export default ClusterHeader;
