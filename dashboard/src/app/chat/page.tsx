import { Chat } from '@/components/Chat';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="mb-6 shrink-0">
        <h1 className="text-xl font-semibold text-slate-100">Assistant</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask about runs, incidents, services, or trigger checks on demand.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <Chat />
      </div>
    </div>
  );
}
