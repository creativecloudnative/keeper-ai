export type Severity = 'low' | 'moderate' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved';
export type RunStatus = 'running' | 'completed' | 'failed';
export type AgentType = 'orchestrator' | 'dependency' | 'security' | 'health' | 'incident' | 'pr';
export type RunEventType = 'iteration' | 'tool_call' | 'tool_result' | 'agent_text' | 'complete' | 'error';

export interface AgentResult {
  success: boolean;
  summary: string;
  artifacts?: Record<string, unknown>;
  error?: string;
}

export interface Incident {
  id: string;
  serviceId: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Run {
  id: string;
  serviceId: string;
  agentType: AgentType;
  status: RunStatus;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  result?: AgentResult;
}

export interface RunEvent {
  id: string;
  runId: string;
  type: RunEventType;
  data: Record<string, unknown>;
  seq: number;
  createdAt: string;
}

export type AgentEventCallback = (type: RunEventType, data: Record<string, unknown>) => void;

export type VulnStatus = 'open' | 'pr_created' | 'resolved';

export interface Vulnerability {
  id: string;
  serviceId: string;
  vulnId: string;       // GHSA-xxx or CVE-xxx from advisory URL
  packageName: string;
  severity: Severity;
  title: string;
  url: string;
  status: VulnStatus;
  prUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
}
