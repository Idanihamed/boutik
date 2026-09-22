'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '../../lib/session';
import { useStore } from '../../lib/store-context';

export function StoreHeader() {
  const { store, count } = useStore();
  const { user, loading, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${store.slug}`;

  const links = [
    { href: base, label: 'Accueil', exact: true },
    { href: `${base}/produits`, label: 'Produits' },
    { href: `${base}/boutiques`, label: 'Nos boutiques' },
    { href: `${base}/contact`, label: 'Contact' },
    { href: `${base}/suivi`, label: 'Suivi de commande' },
    ...(user?.role === 'CUSTOMER' ? [{ href: '/mes-commandes', label: 'Mes commandes' }] : []),
  ];

  async function handleLogout() {
    await logout();
    router.refresh();
  }

  return (
    <header className="mb-6 border-b border-slate-200 pb-3">
      <div className="flex items-center justify-between gap-3">
        <Link href={base} className="flex min-w-0 items-center gap-3">
          {store.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-lg font-bold text-slate-900">{store.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`${base}/panier`}
            aria-label={count === 0 ? 'Panier, vide' : `Panier, ${count} article${count > 1 ? 's' : ''}`}
            className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {!loading &&
            (user ? (
              <button onClick={handleLogout} className="hidden min-h-[44px] rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100 sm:block">
                Déconnexion
              </button>
            ) : (
              <Link href={`/connexion?retour=${encodeURIComponent(pathname)}`} className="hidden min-h-[44px] items-center rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100 sm:inline-flex">
                Se connecter
              </Link>
            ))}
        </div>
      </div>
      <nav aria-label="Navigation de la boutique" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex gap-1">
          {links.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
