'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import type { Incident } from '@/lib/types';

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.getIncidents({ includeResolved: showResolved }).catch(() => []);
    setIncidents(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [showResolved]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolve(id: string) {
    await api.resolveIncident(id);
    await load();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Incidents</h1>
        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-blue-500"
          />
          Show resolved
        </label>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : incidents.length === 0 ? (
        <div className="rounded-lg border border-[#222] bg-[#111] px-4 py-12 text-center">
          <p className="text-slate-500 text-sm">
            {showResolved ? 'No incidents found.' : 'No open incidents. ✓'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#222] bg-[#111] divide-y divide-[#1e1e1e]">
          {incidents.map((inc) => (
            <div key={inc.id} className="px-4 py-4 flex items-start gap-4">
              <div className="shrink-0 pt-0.5">
                <StatusBadge value={inc.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium">{inc.title}</p>
                <p className="text-slate-500 text-xs mt-1 line-clamp-2">{inc.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-slate-600 text-xs">{inc.serviceId}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-600 text-xs">{relativeTime(inc.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge value={inc.status} />
                {inc.status !== 'resolved' && (
                  <button
                    onClick={() => resolve(inc.id)}
                    className="text-xs text-slate-500 hover:text-green-400 transition-colors border border-[#333] hover:border-green-800/50 px-3 py-1 rounded"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
