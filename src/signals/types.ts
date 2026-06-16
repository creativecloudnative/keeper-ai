export type SignalType =
  | 'deployment.failed'
  | 'deployment.succeeded'
  | 'error.spike'
  | 'latency.spike'
  | 'dependency.vulnerability'
  | 'manual.trigger';

export interface Signal {
  id: string;
  type: SignalType;
  source: string;
  serviceId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}
