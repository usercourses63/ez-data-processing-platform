// Kubernetes-related TypeScript interfaces for monitoring dashboard

export interface PodStatus {
  name: string;
  service: string;
  status: 'running' | 'pending' | 'error' | 'terminated';
  restarts: number;
  cpu: number;      // 0-100 percentage
  memory: number;   // 0-100 percentage
  age: string;      // e.g., "2d 14h", "6h 30m"
  node: string;     // e.g., "node-01"
}

export interface TraceSpan {
  service: string;
  serviceName: string;
  start: number;     // milliseconds from trace start
  duration: number;  // milliseconds
  color?: string;
}

export interface DistributedTrace {
  traceId: string;
  totalDuration: number;  // total trace duration in ms
  spans: TraceSpan[];
  timestamp: Date;
}

export interface MessageQueue {
  name: string;
  topic: string;
  depth: number;        // current message count
  rate: number;         // messages per second
  consumers: number;    // active consumer count
  status: 'healthy' | 'warning' | 'error';
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  icon: string;
  title: string;
  message: string;
  timestamp: Date;
  service?: string;
}

export interface ClusterInfo {
  clusterName: string;
  namespace: string;
  version: string;
  nodeCount: number;
  totalPods: number;
  healthyPods: number;
}
