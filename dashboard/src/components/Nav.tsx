'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/runs', label: 'Runs' },
  { href: '/incidents', label: 'Incidents' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="w-48 shrink-0 border-r border-[#222] p-6 flex flex-col gap-1 justify-between">
      <div className="flex flex-col gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="keeper-ai" width={120} height={120} className="mb-4 -ml-2 rounded-xl" />
        {links.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`block text-sm px-3 py-2 rounded transition-colors ${
                active
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <span className="text-xs font-mono text-slate-400" title="git commit">
        {process.env.NEXT_PUBLIC_GIT_SHA ?? 'unknown'}
      </span>
    </nav>
  );
}
