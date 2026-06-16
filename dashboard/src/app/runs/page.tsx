import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

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
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default async function RunsPage() {
  const runs = await api.getRuns({ limit: 50 }).catch(() => []);

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Runs</h1>

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
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No runs yet.
                </td>
              </tr>
            )}
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/runs/${run.id}`} className="text-slate-300 hover:text-white font-mono">
                    {run.agentType}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-400">{run.serviceId}</td>
                <td className="px-4 py-3"><StatusBadge value={run.status} /></td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{run.triggeredBy}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{relativeTime(run.startedAt)}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                  {duration(run.startedAt, run.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
