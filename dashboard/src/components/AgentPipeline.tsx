'use client';

import Link from 'next/link';
import type { Run } from '@/lib/types';

interface PipelineStep {
  agent: string;
  dot: string;
  label: string;
  description: string;
}

const PIPELINES: Record<string, PipelineStep[]> = {
  security: [
    { agent: 'security',    dot: 'bg-red-400',     label: 'SecurityAgent',    description: 'npm audit — finds vulnerabilities' },
    { agent: 'remediation', dot: 'bg-orange-400',  label: 'Remediation',      description: 'npm audit fix → push branch' },
    { agent: 'pr',          dot: 'bg-green-400',   label: 'PRAgent',          description: 'Opens GitHub PR' },
  ],
  dependency: [
    { agent: 'dependency',  dot: 'bg-yellow-400',  label: 'DependencyAgent',  description: 'npm outdated — finds stale packages' },
    { agent: 'remediation', dot: 'bg-orange-400',  label: 'Remediation',      description: 'npm update → push branch' },
    { agent: 'pr',          dot: 'bg-green-400',   label: 'PRAgent',          description: 'Opens GitHub PR' },
  ],
  health: [
    { agent: 'health',      dot: 'bg-blue-400',    label: 'HealthAgent',      description: 'HTTP check — probes endpoints' },
    { agent: 'incident',    dot: 'bg-purple-400',  label: 'IncidentAgent',    description: 'Creates / resolves incident record' },
  ],
};

interface AgentPipelineProps {
  currentRun: Run;
  relatedRuns: Run[];
}

export function AgentPipeline({ currentRun, relatedRuns }: AgentPipelineProps) {
  const steps = PIPELINES[currentRun.agentType];
  if (!steps) return null;

  // Match related runs to pipeline steps by agentType
  const runsByType = new Map(relatedRuns.map((r) => [r.agentType, r]));

  return (
    <div className="rounded-lg border border-[#222] bg-[#111] px-5 py-4">
      <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Agent Pipeline</p>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => {
          const linked = runsByType.get(step.agent);
          const isCurrent = step.agent === currentRun.agentType;
          const isCompleted = linked?.status === 'completed' || (isCurrent && currentRun.status === 'completed');
          const isRunning = linked?.status === 'running' || (isCurrent && currentRun.status === 'running');
          const isPending = !linked && !isCurrent;

          return (
            <div key={step.agent} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Step */}
                <div className={`
                  w-full rounded border px-3 py-2.5 text-center transition-all
                  ${isCurrent ? 'border-slate-600 bg-slate-800' : ''}
                  ${linked && !isCurrent ? 'border-[#222] bg-[#0d0d0d] hover:border-slate-600' : ''}
                  ${isPending ? 'border-[#1a1a1a] opacity-40' : ''}
                `}>
                  <Link
                    href={linked ? `/runs/${linked.id}` : isCurrent ? `/runs/${currentRun.id}` : '#'}
                    className={linked || isCurrent ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${step.dot} ${isRunning ? 'animate-pulse' : ''}`} />
                      <span className="text-xs font-mono text-slate-300">{step.label}</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-tight">{step.description}</p>
                    {(linked || isCurrent) && (
                      <div className="mt-1.5">
                        {isRunning && <span className="text-blue-400 text-xs">running…</span>}
                        {isCompleted && <span className="text-green-400 text-xs">✓ done</span>}
                        {(linked?.status === 'failed' || (!linked && isCurrent && currentRun.status === 'failed')) && (
                          <span className="text-red-400 text-xs">✗ failed</span>
                        )}
                      </div>
                    )}
                  </Link>
                </div>
              </div>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="flex items-center pt-5 px-1 shrink-0">
                  <div className={`h-px w-4 ${isCompleted ? 'bg-slate-500' : 'bg-slate-800'}`} />
                  <span className={`text-xs ${isCompleted ? 'text-slate-500' : 'text-slate-800'}`}>›</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Remediation and PR creation run after this agent completes if action is recommended.
        Related runs share the same <span className="font-mono">triggeredBy</span> and start within seconds.
      </p>
    </div>
  );
}
