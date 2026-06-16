'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RunEvent } from '@/lib/types';
import { SSE_URL } from '@/lib/api';

interface RunTraceProps {
  runId: string;
  initialEvents: RunEvent[];
  isLive: boolean;
}

export function RunTrace({ runId, initialEvents, isLive }: RunTraceProps) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) return;
    const sse = new EventSource(`${SSE_URL}?runId=${runId}`);
    sse.onopen = () => setConnected(true);
    sse.onmessage = (e) => {
      try {
        const event: RunEvent = JSON.parse(e.data as string);
        setEvents((prev) => {
          if (prev.some((p) => p.id === event.id)) return prev;
          return [...prev, event];
        });
        if (event.type === 'complete' || event.type === 'error') {
          sse.close();
          setConnected(false);
        }
      } catch { /* ignore malformed */ }
    };
    sse.onerror = () => { sse.close(); setConnected(false); };
    return () => sse.close();
  }, [runId, isLive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="text-slate-500 text-sm font-mono py-8 text-center">
        {isLive ? 'Waiting for agent events…' : 'No events recorded for this run.'}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 font-mono text-sm">
      {isLive && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
          {connected ? 'Streaming live' : 'Connecting…'}
        </div>
      )}
      {events.map((event) => <EventBlock key={event.id} event={event} />)}
      <div ref={bottomRef} />
    </div>
  );
}

function EventBlock({ event }: { event: RunEvent }) {
  const [open, setOpen] = useState(false);

  switch (event.type) {
    case 'iteration':
      return (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-600 shrink-0">
            iteration {String(event.data.iteration)}
          </span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>
      );

    case 'tool_call':
      return (
        <div className="rounded border border-purple-800/40 bg-purple-950/20 overflow-hidden">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-purple-950/40 transition-colors"
          >
            <span className="text-purple-400 text-xs shrink-0">▶ TOOL</span>
            <span className="text-purple-200 font-semibold">{String(event.data.toolName)}</span>
            <span className="ml-auto text-slate-600 text-xs">{open ? '−' : '+'}</span>
          </button>
          {open && (
            <pre className="px-3 pb-3 text-xs text-slate-300 overflow-x-auto border-t border-purple-800/30">
              {JSON.stringify(event.data.input, null, 2)}
            </pre>
          )}
        </div>
      );

    case 'tool_result':
      return (
        <div className={`rounded border overflow-hidden ml-6 ${
          event.data.isError
            ? 'border-red-800/40 bg-red-950/20'
            : 'border-blue-800/30 bg-blue-950/10'
        }`}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
          >
            <span className={`text-xs shrink-0 ${event.data.isError ? 'text-red-400' : 'text-blue-400'}`}>
              ◀ RESULT
            </span>
            <span className="text-slate-400">{String(event.data.toolName)}</span>
            {Boolean(event.data.isError) && <span className="text-red-400 text-xs">error</span>}
            <span className="ml-auto text-slate-600 text-xs">{open ? '−' : '+'}</span>
          </button>
          {open && (
            <pre className="px-3 pb-3 text-xs text-slate-300 overflow-x-auto max-h-64 border-t border-white/5">
              {typeof event.data.output === 'string'
                ? event.data.output
                : JSON.stringify(event.data.output as Record<string, unknown>, null, 2)}
            </pre>
          )}
        </div>
      );

    case 'agent_text':
      return (
        <div className="rounded border border-slate-700 bg-slate-900/50 px-4 py-3">
          <div className="text-slate-500 text-xs mb-2 font-mono">■ AGENT RESPONSE</div>
          <div className="prose prose-sm prose-invert max-w-none
            prose-p:text-slate-200 prose-p:leading-relaxed prose-p:my-1
            prose-headings:text-slate-100 prose-headings:font-semibold
            prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
            prose-strong:text-slate-100
            prose-code:text-emerald-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-slate-800 prose-pre:text-xs
            prose-ul:text-slate-200 prose-ol:text-slate-200
            prose-li:my-0.5
            prose-a:text-blue-400
            prose-blockquote:border-slate-600 prose-blockquote:text-slate-400
            prose-hr:border-slate-700
            prose-table:text-sm prose-th:text-slate-300 prose-td:text-slate-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {String(event.data.text)}
            </ReactMarkdown>
          </div>
        </div>
      );

    case 'complete':
      return (
        <div className="rounded border border-green-800/40 bg-green-950/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓ COMPLETE</span>
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="rounded border border-red-800/40 bg-red-950/20 px-4 py-3">
          <div className="text-red-400 text-xs mb-1">✗ ERROR</div>
          <p className="text-slate-300 text-xs">{String(event.data.message)}</p>
        </div>
      );

    default:
      return null;
  }
}
