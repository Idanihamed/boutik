'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../lib/session';
import { Spinner } from '../../components/ui';

const NAV = [
  { href: '/plateforme', label: 'Modération' },
  { href: '/plateforme/statistiques', label: 'Statistiques' },
] as const;

/** Espace réservé à l'administrateur de la plateforme : toute autre personne est renvoyée. */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/connexion');
    else if (user.role !== 'PLATFORM_ADMIN') router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'PLATFORM_ADMIN') return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Espace plateforme</h1>
      <nav aria-label="Espace plateforme" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 border-b border-slate-200">
          {NAV.map((item) => {
            const active = item.href === '/plateforme' ? pathname === '/plateforme' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
                    active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </div>
  );
}
