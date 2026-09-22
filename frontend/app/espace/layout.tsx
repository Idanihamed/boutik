'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDashboardStats } from '../../lib/api';
import { useSession } from '../../lib/session';
import { MobileNav } from '../../components/espace/MobileNav';
import { Alert, Spinner } from '../../components/ui';

const NAV = [
  { href: '/espace', label: 'Accueil', permission: null },
  { href: '/espace/commandes', label: 'Commandes', permission: 'orders:read' },
  { href: '/espace/messages', label: 'Messages', permission: 'messages:read' },
  { href: '/espace/produits', label: 'Produits', permission: 'products:read' },
  { href: '/espace/categories', label: 'Catégories', permission: 'categories:read' },
  { href: '/espace/promotions', label: 'Promotions', permission: 'promotions:read' },
  { href: '/espace/codes-promo', label: 'Codes promo', permission: 'promotions:read' },
  { href: '/espace/marques', label: 'Marques', permission: 'brands:read' },
  { href: '/espace/boutiques', label: 'Boutiques', permission: 'boutiques:read' },
  { href: '/espace/actualites', label: 'Actualités', permission: 'articles:read' },
  { href: '/espace/pages', label: 'Pages', permission: 'pages:read' },
  { href: '/espace/equipe', label: 'Équipe', permission: 'users:read' },
  { href: '/espace/parametres', label: 'Paramètres', permission: 'settings:read' },
  { href: '/espace/entreprise', label: 'Mon entreprise', permission: 'business:read' },
] as const;

// Barre du bas (téléphone) : les rubriques du quotidien. Toutes les autres sont sous « Plus ».
const MAIN_HREFS: string[] = ['/espace', '/espace/commandes', '/espace/produits', '/espace/messages'];

/** Espace du personnel d'une entreprise : garde d'accès + navigation selon les permissions. */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/connexion');
    else if (user.role === 'PLATFORM_ADMIN') router.replace('/plateforme');
    else if (!user.businessId) router.replace('/');
  }, [loading, user, router]);

  // Pastilles de la barre du bas : commandes et messages à traiter.
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user?.business) return;
    getDashboardStats()
      .then((s) => setCounts({ '/espace/commandes': s.orders.pending, '/espace/messages': s.messages.untreated }))
      .catch(() => setCounts({}));
  }, [user, pathname]);

  if (loading || !user || !user.business) return <Spinner />;

  const { business } = user;
  const items = NAV.filter((item) => !item.permission || user.permissions.includes(item.permission));
  const mainItems = items.filter((i) => MAIN_HREFS.includes(i.href)).map(({ href, label }) => ({ href, label }));
  const moreItems = items.filter((i) => !MAIN_HREFS.includes(i.href)).map(({ href, label }) => ({ href, label }));

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      {business.status === 'PENDING' && (
        <Alert kind="info">
          <strong>{business.name}</strong> est en attente de validation : vous pouvez préparer votre catalogue, il sera
          visible du public dès la validation.
        </Alert>
      )}
      <nav aria-label="Espace de l’entreprise" className="-mx-4 hidden overflow-x-auto px-4 sm:block">
        <ul className="flex gap-1 border-b border-slate-200">
          {items.map((item) => {
            const active = item.href === '/espace' ? pathname === '/espace' : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`block whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
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
      <MobileNav main={mainItems} more={moreItems} badges={counts} />
    </div>
  );
}
