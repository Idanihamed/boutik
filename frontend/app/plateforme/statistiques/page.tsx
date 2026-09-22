'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, getPlatformStats } from '../../../lib/api';
import { STATUS_LABELS } from '../../../lib/labels';
import type { BusinessStatus, PlatformStats } from '../../../lib/types';
import { Alert, Card, Spinner } from '../../../components/ui';

function Tile({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <Card className="space-y-1">
      <p className={`text-3xl font-bold ${tone ?? 'text-slate-900'}`}>{value.toLocaleString('fr-FR')}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </Card>
  );
}

// Ordre d'affichage des statuts, du plus urgent (à traiter) au moins urgent.
const STATUS_ORDER: BusinessStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED', 'REJECTED'];

export default function PlatformStatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlatformStats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les statistiques.'));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-6">
      <section aria-labelledby="entreprises" className="space-y-3">
        <h2 id="entreprises" className="text-lg font-semibold text-slate-900">
          Entreprises
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile value={stats.businesses.total} label="Au total" />
          {STATUS_ORDER.map((status) => (
            <Tile
              key={status}
              value={stats.businesses.byStatus[status]}
              label={STATUS_LABELS[status]}
              tone={status === 'PENDING' && stats.businesses.byStatus.PENDING > 0 ? 'text-amber-700' : undefined}
            />
          ))}
        </div>
        <p className="text-sm text-slate-500">
          {stats.businesses.newLast7Days} nouvelle{stats.businesses.newLast7Days > 1 ? 's' : ''} inscription
          {stats.businesses.newLast7Days > 1 ? 's' : ''} ces 7 derniers jours, {stats.businesses.newLast30Days} sur 30
          jours.
        </p>
      </section>

      <section aria-labelledby="activite" className="space-y-3">
        <h2 id="activite" className="text-lg font-semibold text-slate-900">
          Activité (hors commandes annulées)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile value={stats.orders.last7Days} label="Commandes, 7 derniers jours" />
          <Tile value={stats.orders.last30Days} label="Commandes, 30 derniers jours" />
          <Tile value={stats.orders.total} label="Commandes au total" />
          <Tile
            value={stats.reports.open}
            label="Signalements ouverts"
            tone={stats.reports.open > 0 ? 'text-red-700' : undefined}
          />
        </div>
      </section>

      <section aria-labelledby="produits" className="space-y-3">
        <h2 id="produits" className="text-lg font-semibold text-slate-900">
          Catalogue
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile value={stats.products.total} label="Produits créés" />
          <Tile value={stats.products.published} label="Produits publiés" />
        </div>
      </section>

      <section aria-labelledby="top" className="space-y-3">
        <h2 id="top" className="text-lg font-semibold text-slate-900">
          Entreprises les plus actives (30 derniers jours)
        </h2>
        {stats.topBusinessesLast30Days.length === 0 ? (
          <Card className="text-center text-slate-500">Aucune commande passée sur la plateforme ces 30 derniers jours.</Card>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {stats.topBusinessesLast30Days.map((row, i) => (
              <li key={row.slug} className={i > 0 ? 'border-t border-slate-100' : ''}>
                <Link href={`/${row.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-slate-900">{row.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-slate-600">
                    {row.orderCount} commande{row.orderCount > 1 ? 's' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
