'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type CheckType = 'health' | 'dependency' | 'security' | 'all';

const CHECK_TYPES: { type: CheckType; label: string; color: string }[] = [
  { type: 'health',     label: 'Health',     color: 'text-blue-400 border-blue-800/40 hover:bg-blue-950/40' },
  { type: 'dependency', label: 'Deps',       color: 'text-yellow-400 border-yellow-800/40 hover:bg-yellow-950/40' },
  { type: 'security',   label: 'Security',   color: 'text-red-400 border-red-800/40 hover:bg-red-950/40' },
  { type: 'all',        label: 'All',        color: 'text-emerald-400 border-emerald-800/40 hover:bg-emerald-950/40' },
];

interface TriggerControlsProps {
  serviceId: string;
}

export function TriggerControls({ serviceId }: TriggerControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<CheckType | null>(null);
  const [triggered, setTriggered] = useState<CheckType | null>(null);

  async function trigger(checkType: CheckType) {
    if (loading) return;
    setLoading(checkType);
    setTriggered(null);
    try {
      await api.triggerCheck(serviceId, checkType);
      setTriggered(checkType);
      setTimeout(() => {
        setTriggered(null);
        router.push('/runs');
        router.refresh();
      }, 800);
    } catch {
      setLoading(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-1.5 flex-wrap pt-1">
      {CHECK_TYPES.map(({ type, label, color }) => {
        const isLoading = loading === type || (loading === 'all' && type !== 'all');
        const isDone = triggered === type;
        return (
          <button
            key={type}
            onClick={() => trigger(type)}
            disabled={!!loading}
            className={`
              text-xs px-2 py-1 rounded border font-mono transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
              ${color}
              ${isDone ? 'opacity-100' : ''}
            `}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {label}
              </span>
            ) : isDone ? (
              <span>✓ {label}</span>
            ) : (
              <span>▷ {label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
