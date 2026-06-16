import { api } from '@/lib/api';
import { LiveRunsList } from '@/components/LiveRunsList';

export default async function RunsPage() {
  const runs = await api.getRuns({ limit: 50 }).catch(() => []);

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Runs</h1>
      <LiveRunsList initialRuns={runs} limit={50} />
    </div>
  );
}
