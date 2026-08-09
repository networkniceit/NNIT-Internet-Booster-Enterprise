export type QosPriority =
  | 'critical'
  | 'high'
  | 'normal'
  | 'low';

export interface QosRule {
  id: string;
  name: string;
  applicationPath: string;
  priority: QosPriority;
  dscpValue: number;
  throttleMbps: number | null;
  enabled: boolean;
  applied: boolean;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface QosStatus {
  rules: QosRule[];
  appliedCount: number;
  enabledCount: number;
  administratorRequired: boolean;
  timestamp: string;
}
