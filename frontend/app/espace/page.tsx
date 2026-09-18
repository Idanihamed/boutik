'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDashboardStats } from '../../lib/api';
import { useSession } from '../../lib/session';
import { STATUS_LABELS } from '../../lib/labels';
import type { DashboardStats } from '../../lib/types';
import { Card, StatusBadge } from '../../components/ui';

const STATUS_MESSAGES = {
  PENDING: 'Votre entreprise est en attente de validation. Elle n’est pas encore visible du public.',
  ACTIVE: 'Votre entreprise est active et visible du public.',
  REJECTED: 'Votre inscription a été refusée.',
  SUSPENDED: 'Votre entreprise est suspendue : sa vitrine est masquée.',
  BANNED: 'Votre entreprise a été bannie de la plateforme.',
} as const;

const STEPS = [
  { href: '/espace/entreprise', title: 'Complétez votre entreprise', text: 'Ajoutez votre logo et une description.', permission: 'business:update' },
  { href: '/espace/categories', title: 'Créez vos catégories', text: 'Par exemple : Téléphones, Accessoires…', permission: 'categories:create' },
  { href: '/espace/produits/nouveau', title: 'Ajoutez vos premiers produits', text: 'Photos, prix et stock.', permission: 'products:create' },
];

export default function OwnerHomePage() {
  const { user } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    // Indicateurs facultatifs : une erreur ne doit pas empêcher d'afficher le reste de l'accueil.
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!user?.business) return null;
  const { business } = user;
  const can = (permission: string) => user.permissions.includes(permission);

  const cards = [
    stats && can('orders:read') && {
      href: '/espace/commandes',
      label: 'Commandes à traiter',
      value: stats.orders.pending,
      alert: stats.orders.pending > 0,
    },
    stats && can('messages:read') && {
      href: '/espace/messages',
      label: 'Messages non traités',
      value: stats.messages.untreated,
      alert: stats.messages.untreated > 0,
    },
    stats && can('products:read') && {
      href: '/espace/produits',
      label: 'Produits en stock faible ou en rupture',
      value: stats.stock.lowStock + stats.stock.outOfStock,
      alert: stats.stock.outOfStock > 0,
    },
  ].filter(Boolean) as { href: string; label: string; value: number; alert: boolean }[];

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
          <StatusBadge status={business.status} />
        </div>
        <p className="text-slate-600">{STATUS_MESSAGES[business.status]}</p>
        <p className="text-sm text-slate-500">
          Statut : {STATUS_LABELS[business.status]} · adresse de la vitrine :{' '}
          {business.status === 'ACTIVE' ? (
            <Link href={`/${business.slug}`} className="font-semibold text-brand-700 hover:underline">
              /{business.slug}
            </Link>
          ) : (
            <strong>/{business.slug}</strong>
          )}
        </p>
      </Card>

      {cards.length > 0 && (
        <section aria-label="À faire" className="grid gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`block rounded-xl border p-4 hover:shadow-sm ${
                c.alert ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="block text-3xl font-bold text-slate-900">{c.value}</span>
              <span className="mt-1 block text-sm text-slate-600">{c.label}</span>
            </Link>
          ))}
        </section>
      )}

      <section aria-labelledby="premiers-pas" className="space-y-3">
        <h2 id="premiers-pas" className="text-lg font-semibold text-slate-900">
          Premiers pas
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {STEPS.filter((s) => can(s.permission)).map((step, i) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="block h-full rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-600 hover:shadow-sm"
              >
                <span className="text-sm font-semibold text-brand-700">Étape {i + 1}</span>
                <span className="mt-1 block font-semibold text-slate-900">{step.title}</span>
                <span className="mt-1 block text-sm text-slate-600">{step.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
