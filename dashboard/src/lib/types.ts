export type RunEventType = 'iteration' | 'tool_call' | 'tool_result' | 'agent_text' | 'complete' | 'error';

export interface RunEvent {
  id: string;
  runId: string;
  type: RunEventType;
  data: Record<string, unknown>;
  seq: number;
  createdAt: string;
}

export interface Run {
  id: string;
  serviceId: string;
  agentType: string;
  status: 'running' | 'completed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  result?: { success: boolean; summary: string; error?: string };
  events?: RunEvent[];
}

export interface Incident {
  id: string;
  serviceId: string;
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface Service {
  id: string;
  name: string;
  repo: string;
  url?: string;
  latestRuns: {
    health?: Run | null;
    dependency?: Run | null;
    security?: Run | null;
  };
}
