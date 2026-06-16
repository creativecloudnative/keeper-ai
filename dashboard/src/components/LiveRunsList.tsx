'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from './StatusBadge';
import type { Run } from '@/lib/types';
import { SSE_URL } from '@/lib/api';

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function duration(start: string, end?: string) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

const AGENT_DOT: Record<string, string> = {
  health: 'bg-blue-400',
  dependency: 'bg-yellow-400',
  security: 'bg-red-400',
  pr: 'bg-green-400',
};

interface LiveRunsListProps {
  initialRuns: Run[];
  limit?: number;
  compact?: boolean;
}

export function LiveRunsList({ initialRuns, limit = 50, compact = false }: LiveRunsListProps) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const knownRunIds = useRef(new Set(initialRuns.map((r) => r.id)));

  // Subscribe to SSE — watch for run_event completions to refresh run status
  useEffect(() => {
    const sse = new EventSource(SSE_URL);

    sse.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as {
          runId?: string;
          type?: string;
        };
        if (!event.runId) return;

        // If we see an event for a run we don't know yet, fetch the run list
        if (!knownRunIds.current.has(event.runId)) {
          knownRunIds.current.add(event.runId);
          api.getRuns({ limit }).then((fresh) => {
            setRuns(fresh);
            fresh.forEach((r) => knownRunIds.current.add(r.id));
          }).catch(() => {});
          return;
        }

        // If a run we know just completed or errored, update its status in place
        if (event.type === 'complete' || event.type === 'error') {
          const runId = event.runId;
          api.getRuns({ limit }).then((fresh) => setRuns(fresh)).catch(() => {});
          // Optimistically flip status so the dot stops pulsing
          setRuns((prev) =>
            prev.map((r) =>
              r.id === runId ? { ...r, status: event.type === 'complete' ? 'completed' : 'failed' } : r
            )
          );
        }
      } catch { /* ignore */ }
    };

    return () => sse.close();
  }, [limit]);

  if (compact) {
    return (
      <div className="rounded-lg border border-[#222] bg-[#111] divide-y divide-[#1e1e1e]">
        {runs.length === 0 && (
          <p className="text-slate-500 text-sm px-4 py-4">No runs yet.</p>
        )}
        {runs.slice(0, 10).map((run) => (
          <Link
            key={run.id}
            href={`/runs/${run.id}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${run.status === 'running' ? 'animate-pulse' : ''} ${AGENT_DOT[run.agentType] ?? 'bg-slate-400'}`} />
            <span className="text-slate-400 text-sm w-24 shrink-0">{run.agentType}</span>
            <span className="text-slate-300 text-sm flex-1">{run.serviceId}</span>
            <StatusBadge value={run.status} />
            <span className="text-slate-600 text-xs w-16 text-right shrink-0">
              {relativeTime(run.startedAt)}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#222] bg-[#111] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#222] text-left">
            <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Agent</th>
            <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Service</th>
            <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Triggered</th>
            <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Started</th>
            <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e1e]">
          {runs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No runs yet.</td>
            </tr>
          )}
          {runs.map((run) => (
            <tr
              key={run.id}
              className={`hover:bg-white/[0.02] transition-colors ${run.status === 'running' ? 'bg-blue-950/10' : ''}`}
            >
              <td className="px-4 py-3">
                <Link href={`/runs/${run.id}`} className="flex items-center gap-2 text-slate-300 hover:text-white font-mono">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${run.status === 'running' ? 'animate-pulse' : ''} ${AGENT_DOT[run.agentType] ?? 'bg-slate-400'}`} />
                  {run.agentType}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-400">{run.serviceId}</td>
              <td className="px-4 py-3"><StatusBadge value={run.status} /></td>
              <td className="px-4 py-3 text-slate-500 font-mono text-xs">{run.triggeredBy}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{relativeTime(run.startedAt)}</td>
              <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                {run.status === 'running'
                  ? <span className="text-blue-400 animate-pulse">running…</span>
                  : (duration(run.startedAt, run.completedAt) ?? '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
