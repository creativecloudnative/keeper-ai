import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { RunTrace } from '@/components/RunTrace';

function duration(start: string, end?: string) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await api.getRun(id).catch(() => null);
  if (!run) notFound();

  const isLive = run.status === 'running';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link href="/runs" className="hover:text-slate-300">Runs</Link>
        <span>/</span>
        <span className="font-mono text-slate-400">{id.slice(0, 8)}…</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 capitalize">
            {run.agentType} — {run.serviceId}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">
            triggered by {run.triggeredBy}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge value={run.status} />
          {duration(run.startedAt, run.completedAt) && (
            <span className="text-slate-500 text-sm font-mono">
              {duration(run.startedAt, run.completedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Result summary (if complete) */}
      {run.result && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          run.result.success
            ? 'border-green-800/40 bg-green-950/20 text-green-300'
            : 'border-red-800/40 bg-red-950/20 text-red-300'
        }`}>
          {run.result.summary}
        </div>
      )}

      {/* Trace */}
      <div>
        <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">
          Trace
          {isLive && (
            <span className="ml-3 text-blue-400 normal-case">● live</span>
          )}
        </h2>
        <RunTrace runId={id} initialEvents={run.events ?? []} isLive={isLive} />
      </div>
    </div>
  );
}
