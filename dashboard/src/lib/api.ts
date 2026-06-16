import type { Run, RunEvent, Incident, Service } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  getServices: () => get<Service[]>('/api/services'),
  getRuns: (params?: { limit?: number; serviceId?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.serviceId) q.set('serviceId', params.serviceId);
    return get<Run[]>(`/api/runs?${q}`);
  },
  getRun: (id: string) => get<Run & { events: RunEvent[] }>(`/api/runs/${id}`),
  getIncidents: (params?: { includeResolved?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.includeResolved) q.set('includeResolved', 'true');
    return get<Incident[]>(`/api/incidents?${q}`);
  },
  resolveIncident: (id: string) =>
    fetch(`${BASE}/api/incidents/${id}/resolve`, { method: 'POST' }).then((r) => r.json()),
};

export const SSE_URL = `${BASE}/api/events`;
