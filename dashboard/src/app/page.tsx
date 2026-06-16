import Link from 'next/link';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { TriggerControls } from '@/components/TriggerControls';
import { LiveRunsList } from '@/components/LiveRunsList';
import type { Service, Run } from '@/lib/types';

function serviceHealthStatus(service: Service): string {
  const run = service.latestRuns.health;
  if (!run) return 'unknown';
  if (run.status === 'running') return 'running';
  if (run.status === 'failed') return 'down';
  return 'healthy';
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function agentDot(type: string) {
  const colors: Record<string, string> = {
    health: 'bg-blue-400',
    dependency: 'bg-yellow-400',
    security: 'bg-red-400',
    pr: 'bg-green-400',
  };
  return colors[type] ?? 'bg-slate-400';
}

export default async function OverviewPage() {
  const [services, runs, incidents] = await Promise.all([
    api.getServices().catch(() => [] as Service[]),
    api.getRuns({ limit: 10 }).catch(() => [] as Run[]),
    api.getIncidents().catch(() => []),
  ]);

  return (
    <div className="max-w-5xl space-y-10">
      <h1 className="text-2xl font-semibold text-slate-100">Overview</h1>

      {/* Services */}
      <section>
        <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.length === 0 && (
            <p className="text-slate-500 text-sm col-span-3">No services — check that the API is running.</p>
          )}
          {services.map((svc) => {
            const status = serviceHealthStatus(svc);
            return (
              <div key={svc.id} className="rounded-lg border border-[#222] bg-[#111] p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-100 font-medium">{svc.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{svc.repo}</p>
                  </div>
                  <StatusBadge value={status} />
                </div>
                {svc.url && (
                  <p className="text-slate-600 text-xs truncate">{svc.url}</p>
                )}
                <div className="flex gap-2 pt-1">
                  {(['health', 'dependency', 'security'] as const).map((type) => {
                    const run = svc.latestRuns[type];
                    return (
                      <div key={type} className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${agentDot(type)}`} />
                        <span className="text-xs text-slate-600">
                          {run ? relativeTime(run.startedAt) : 'never'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <TriggerControls serviceId={svc.id} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Open incidents */}
      {incidents.length > 0 && (
        <section>
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4">
            Open Incidents
          </h2>
          <div className="rounded-lg border border-red-800/30 bg-red-950/10 divide-y divide-red-800/20">
            {incidents.map((inc) => (
              <div key={inc.id} className="flex items-center gap-4 px-4 py-3">
                <StatusBadge value={inc.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm truncate">{inc.title}</p>
                  <p className="text-slate-500 text-xs">{inc.serviceId} · {relativeTime(inc.createdAt)}</p>
                </div>
                <Link href="/incidents" className="text-xs text-slate-500 hover:text-slate-300">
                  view →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent runs — live */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest">Recent Runs</h2>
          <Link href="/runs" className="text-xs text-slate-500 hover:text-slate-300">view all →</Link>
        </div>
        <LiveRunsList initialRuns={runs} limit={10} compact />
      </section>
    </div>
  );
}
