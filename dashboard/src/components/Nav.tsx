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
    <nav className="w-48 shrink-0 border-r border-[#222] p-6 flex flex-col gap-1">
      <span className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-6">
        keeper-ai
      </span>
      {links.map(({ href, label }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm px-3 py-2 rounded transition-colors ${
              active
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
