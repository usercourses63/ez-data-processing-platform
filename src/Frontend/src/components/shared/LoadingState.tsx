import React from 'react';
import { Spin, Skeleton, Card } from 'antd';

export type LoadingType = 'spinner' | 'skeleton' | 'table' | 'card' | 'page';

export interface LoadingStateProps {
  type?: LoadingType;
  rows?: number;
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'spinner',
  rows = 5,
  message
}) => {
  switch (type) {
    case 'skeleton':
      return <Skeleton active paragraph={{ rows }} />;

    case 'table':
      return <Skeleton active paragraph={{ rows: rows + 1 }} />;

    case 'card':
      return (
        <Card>
          <Skeleton active />
        </Card>
      );

    case 'page':
      return (
        <div style={{
          textAlign: 'center',
          padding: '50px 0',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Spin size="large" tip={message || 'טוען...'} />
        </div>
      );

    case 'spinner':
    default:
      return <Spin tip={message} />;
  }
};
