'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDashboardStats, listOrders } from '../../lib/api';
import { formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '../../lib/labels';
import { useSession } from '../../lib/session';
import type { AdminOrder, DashboardStats } from '../../lib/types';
import { Card } from '../../components/ui';

const STATUS_MESSAGES = {
  PENDING: 'Votre entreprise est en attente de validation. Elle n’est pas encore visible du public.',
  REJECTED: 'Votre inscription a été refusée.',
  SUSPENDED: 'Votre entreprise est suspendue : sa vitrine est masquée.',
  BANNED: 'Votre entreprise a été bannie de la plateforme.',
} as const;

const STEPS = [
  { href: '/espace/entreprise', title: 'Complétez votre entreprise', text: 'Ajoutez votre logo et une description.', permission: 'business:update' },
  { href: '/espace/categories', title: 'Créez vos catégories', text: 'Par exemple : Téléphones, Accessoires…', permission: 'categories:create' },
  { href: '/espace/produits/nouveau', title: 'Ajoutez vos premiers produits', text: 'Photos, prix et stock.', permission: 'products:create' },
];

function Chevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function Shortcut({ href, label, tone, children }: { href: string; label: string; tone: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-600">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {children}
        </svg>
      </span>
      <span className="text-[15px] font-bold text-slate-900">{label}</span>
    </Link>
  );
}

export default function OwnerHomePage() {
  const { user } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);

  const canOrders = Boolean(user?.permissions.includes('orders:read'));

  useEffect(() => {
    // Indicateurs facultatifs : une erreur ne doit pas empêcher d'afficher le reste de l'accueil.
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (!canOrders) return;
    listOrders({ page: 1 })
      .then((res) => setOrders(res.data.slice(0, 3)))
      .catch(() => setOrders(null));
  }, [canOrders]);

  if (!user?.business) return null;
  const { business } = user;
  const can = (permission: string) => user.permissions.includes(permission);
  const firstName = user.name.split(' ')[0];

  // Ce qui demande une action, du plus urgent au moins urgent.
  const todo = [
    stats && can('orders:read') && stats.orders.pending > 0 && {
      href: '/espace/commandes',
      value: String(stats.orders.pending),
      title: stats.orders.pending > 1 ? 'Commandes à confirmer' : 'Commande à confirmer',
      text: 'Le client attend votre réponse',
      tile: 'bg-brand-600 text-white',
    },
    stats && can('messages:read') && stats.messages.untreated > 0 && {
      href: '/espace/messages',
      value: String(stats.messages.untreated),
      title: stats.messages.untreated > 1 ? 'Messages sans réponse' : 'Message sans réponse',
      text: 'Un client vous a écrit',
      tile: 'bg-[#E0F2FE] text-[#075985]',
    },
    stats && can('products:read') && stats.stock.lowStock + stats.stock.outOfStock > 0 && {
      href: '/espace/produits',
      value: String(stats.stock.lowStock + stats.stock.outOfStock),
      title: stats.stock.outOfStock > 0 ? 'Produits épuisés ou presque' : 'Stock presque épuisé',
      text: 'À réapprovisionner',
      tile: 'bg-accent-50 text-accent-700',
    },
  ].filter(Boolean) as { href: string; value: string; title: string; text: string; tile: string }[];

  const noProducts = stats !== null && stats.products.total === 0;
  const notice = business.status === 'ACTIVE' ? null : STATUS_MESSAGES[business.status];

  return (
    <div className="space-y-7">
      <div>
        <p className="text-sm text-slate-500">{business.name}</p>
        <h1 className="text-[2rem] font-extrabold leading-tight text-slate-900">Bonjour {firstName}</h1>
        <p className="mt-1 text-[16px] text-slate-500">
          {todo.length > 0 ? 'Voici ce qui demande votre attention.' : stats ? 'Tout est à jour. Rien ne demande votre attention.' : 'Bienvenue dans votre espace.'}
        </p>
      </div>

      {notice && (
        <Card className="border-amber-300 bg-amber-50 text-amber-900">
          <p>{notice}</p>
        </Card>
      )}

      {todo.length > 0 && (
        <section aria-labelledby="a-traiter" className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <h2 id="a-traiter" className="px-5 pb-1.5 pt-4 font-sans text-xs font-bold uppercase tracking-wider text-slate-500">
            À traiter maintenant
          </h2>
          <ul>
            {todo.map((item, i) => (
              <li key={item.href} className={i > 0 ? 'border-t border-slate-100' : ''}>
                <Link href={item.href} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] font-display text-[22px] font-extrabold ${item.tile}`}>
                    {item.value}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-slate-900">{item.title}</span>
                    <span className="block text-sm text-slate-500">{item.text}</span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="raccourcis" className="space-y-3">
        <h2 id="raccourcis" className="text-[22px] font-bold text-slate-900">
          Raccourcis
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {can('products:create') && (
            <Shortcut href="/espace/produits/nouveau" label="Ajouter un produit" tone="bg-brand-100 text-brand-600">
              <path d="M12 5v14M5 12h14" />
            </Shortcut>
          )}
          {can('promotions:create') && (
            <Shortcut href="/espace/codes-promo" label="Créer un code promo" tone="bg-accent-50 text-accent-600">
              <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
              <circle cx="7" cy="7" r="1.5" />
            </Shortcut>
          )}
          {can('products:update') && (
            <Shortcut href="/espace/produits" label="Mettre à jour le stock" tone="bg-[#E0E7FF] text-[#3730A3]">
              <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
              <path d="m3 8 9 5 9-5M12 13v8" />
            </Shortcut>
          )}
          {business.status === 'ACTIVE' && (
            <Shortcut href={`/${business.slug}`} label="Voir ma vitrine" tone="bg-slate-100 text-slate-900">
              <path d="M3 9l1.5-5h15L21 9" />
              <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
              <path d="M5 12v8h14v-8" />
            </Shortcut>
          )}
        </div>
      </section>

      {canOrders && orders && orders.length > 0 && (
        <section aria-labelledby="dernieres" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="dernieres" className="text-[22px] font-bold text-slate-900">
              Dernières commandes
            </h2>
            <Link href="/espace/commandes" className="shrink-0 text-[15px] font-semibold text-brand-700 hover:underline">
              Tout voir
            </Link>
          </div>
          <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {orders.map((o, i) => (
              <li key={o.id} className={i > 0 ? 'border-t border-slate-100' : ''}>
                <Link href={`/espace/commandes/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold text-slate-900">{o.customerName}</span>
                    <span className="block text-[13px] text-slate-500">
                      {o.reference} · {formatPrice(o.totalAmount, business.currency)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${ORDER_STATUS_STYLES[o.status]}`}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {noProducts && (
        <section aria-labelledby="premiers-pas" className="space-y-3">
          <h2 id="premiers-pas" className="text-[22px] font-bold text-slate-900">
            Premiers pas
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {STEPS.filter((s) => can(s.permission)).map((step, i) => (
              <li key={step.href}>
                <Link href={step.href} className="block h-full rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-600">
                  <span className="text-sm font-bold text-brand-700">Étape {i + 1}</span>
                  <span className="mt-1 block font-bold text-slate-900">{step.title}</span>
                  <span className="mt-1 block text-sm text-slate-500">{step.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
