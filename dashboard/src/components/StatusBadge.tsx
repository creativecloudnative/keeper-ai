const styles: Record<string, string> = {
  // run status
  running:   'bg-blue-400/10 text-blue-400 border-blue-400/20',
  completed: 'bg-green-400/10 text-green-400 border-green-400/20',
  failed:    'bg-red-400/10 text-red-400 border-red-400/20',
  // health
  healthy:   'bg-green-400/10 text-green-400 border-green-400/20',
  degraded:  'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  down:      'bg-red-400/10 text-red-400 border-red-400/20',
  unknown:   'bg-slate-400/10 text-slate-400 border-slate-400/20',
  // severity
  critical:  'bg-red-400/10 text-red-400 border-red-400/20',
  high:      'bg-orange-400/10 text-orange-400 border-orange-400/20',
  moderate:  'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  low:       'bg-slate-400/10 text-slate-400 border-slate-400/20',
  // incident status
  open:        'bg-red-400/10 text-red-400 border-red-400/20',
  in_progress: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  resolved:    'bg-green-400/10 text-green-400 border-green-400/20',
};

export function StatusBadge({ value }: { value: string }) {
  const cls = styles[value] ?? styles.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono uppercase tracking-wide ${cls}`}>
      {value.replace('_', ' ')}
    </span>
  );
}
