import { signIn } from '@/auth';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            keeper-ai
          </span>
          <h1 className="text-xl font-semibold text-slate-100">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>

        <form
          action={async () => {
            'use server';
            const { callbackUrl } = await searchParams;
            await signIn('linkedin', { redirectTo: callbackUrl ?? '/' });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors text-slate-200 text-sm font-medium"
          >
            <LinkedInIcon />
            Continue with LinkedIn
          </button>
        </form>
      </div>
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
