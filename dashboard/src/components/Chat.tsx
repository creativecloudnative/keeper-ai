'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type ToolCall = { name: string; input: unknown; result?: unknown };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCall[];
  streaming: boolean;
};

const PROSE =
  'prose prose-sm prose-invert max-w-none ' +
  'prose-p:text-slate-200 prose-p:leading-relaxed prose-p:my-1 ' +
  'prose-headings:text-slate-100 prose-headings:font-semibold ' +
  'prose-h1:text-base prose-h2:text-sm prose-h3:text-sm ' +
  'prose-strong:text-slate-100 ' +
  'prose-code:text-emerald-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none ' +
  'prose-pre:bg-slate-800 prose-pre:text-xs ' +
  'prose-ul:text-slate-200 prose-ol:text-slate-200 prose-li:my-0.5 ' +
  'prose-a:text-blue-400 prose-blockquote:border-slate-600 prose-blockquote:text-slate-400 ' +
  'prose-hr:border-slate-700 prose-table:text-sm prose-th:text-slate-300 prose-td:text-slate-300';

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, toolCalls: [], streaming: false };
    const asstMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', toolCalls: [], streaming: true };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setInput('');
    setBusy(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as { type: string; delta?: string; name?: string; input?: unknown; content?: unknown; message?: string };

            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstMsg.id) return m;
                if (ev.type === 'text') return { ...m, content: m.content + (ev.delta ?? '') };
                if (ev.type === 'tool_call') return { ...m, toolCalls: [...m.toolCalls, { name: ev.name!, input: ev.input }] };
                if (ev.type === 'tool_result') {
                  const calls = [...m.toolCalls];
                  const idx = calls.findLastIndex((t) => t.name === ev.name && t.result === undefined);
                  if (idx >= 0) calls[idx] = { ...calls[idx], result: ev.content };
                  return { ...m, toolCalls: calls };
                }
                if (ev.type === 'done' || ev.type === 'error') {
                  return { ...m, streaming: false, content: ev.type === 'error' ? `Error: ${ev.message}` : m.content };
                }
                return m;
              }),
            );
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsg.id
            ? { ...m, content: `Error: ${err instanceof Error ? err.message : 'Unknown'}`, streaming: false }
            : m,
        ),
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-6">
        {messages.length === 0 && (
          <p className="text-slate-500 text-sm text-center pt-20">
            Ask me about runs, incidents, or trigger a check.
          </p>
        )}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-lg px-4 py-2.5 rounded-xl bg-slate-800 text-slate-100 text-sm">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="space-y-2">
              {msg.toolCalls.map((tc, i) => (
                <ToolBlock key={i} tool={tc} />
              ))}
              {(msg.content || msg.streaming) && (
                <div className={PROSE}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 translate-y-0.5 rounded-sm" />
                  )}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#222] pt-4 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="flex gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about runs, incidents, services…"
            disabled={busy}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {busy ? '…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ToolBlock({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-slate-700/50 bg-slate-900/40 overflow-hidden text-xs font-mono">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-emerald-500 shrink-0">⚙ {tool.name}</span>
        {tool.result === undefined && (
          <span className="text-slate-500 animate-pulse">running…</span>
        )}
        <span className="ml-auto text-slate-600">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-700/40 px-3 pb-2 pt-1 space-y-1">
          <pre className="text-slate-400 overflow-x-auto">{JSON.stringify(tool.input, null, 2)}</pre>
          {tool.result !== undefined && (
            <>
              <div className="text-slate-600 pt-1">result</div>
              <pre className="text-slate-300 overflow-x-auto max-h-40">
                {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
