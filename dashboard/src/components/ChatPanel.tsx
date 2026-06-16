'use client';

import { useState } from 'react';
import { Chat } from './Chat';

export function ChatPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Panel — always mounted so conversation survives tab switches */}
      <div
        className={`fixed bottom-20 right-6 w-[400px] flex flex-col bg-[#080e1a] border border-[#1e2d40] rounded-2xl shadow-2xl z-50 transition-all duration-200 origin-bottom-right ${
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ height: 'min(600px, calc(100vh - 120px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d40] shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-slate-200">Assistant</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L7 5.94l3.47-3.47a.75.75 0 1 1 1.06 1.06L8.06 7l3.47 3.47a.75.75 0 1 1-1.06 1.06L7 8.06l-3.47 3.47a.75.75 0 0 1-1.06-1.06L5.94 7 2.47 3.53a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Chat body */}
        <div className="flex-1 min-h-0 p-4">
          <Chat />
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-xl flex items-center justify-center z-50 transition-colors ${
          open ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-700 hover:bg-emerald-600'
        }`}
        aria-label="Toggle assistant"
      >
        {open ? <XIcon /> : <ChatIcon />}
      </button>
    </>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
