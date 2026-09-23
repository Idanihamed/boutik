'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, listFlaggedBusinesses, listPlatformBusinesses } from '../../lib/api';
import { countryName, formatDate, STATUS_LABELS, subscriptionInfo } from '../../lib/labels';
import type { BusinessStatus, FlaggedBusiness, ModerationAction, Paginated, PlatformBusinessRow } from '../../lib/types';
import { ModerationDialog } from '../../components/ModerationDialog';
import { Pagination } from '../../components/Pagination';
import { Alert, Button, Card, Input, Select, Spinner, StatusBadge } from '../../components/ui';

type Tab = 'pending' | 'flagged' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'À valider' },
  { id: 'flagged', label: 'Signalées' },
  { id: 'all', label: 'Toutes' },
];

export default function PlatformHomePage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [status, setStatus] = useState<BusinessStatus | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Paginated<PlatformBusinessRow> | null>(null);
  const [flagged, setFlagged] = useState<FlaggedBusiness[] | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState<{ id: string; name: string; action: ModerationAction } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Toujours interrogé : sert au compteur de l'onglet « À valider », et de liste quand il est actif.
      const pending = await listPlatformBusinesses({ status: 'PENDING', page: tab === 'pending' ? page : 1 });
      setPendingCount(pending.meta.total);

      if (tab === 'pending') {
        setRows(pending);
      } else if (tab === 'all') {
        setRows(await listPlatformBusinesses({ status: status || undefined, search: search || undefined, page }));
      } else {
        setFlagged(await listFlaggedBusinesses());
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la liste.');
    } finally {
      setLoading(false);
    }
  }, [tab, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => changeTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
            {t.id === 'pending' && pendingCount !== null && pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Rechercher une entreprise"
            placeholder="Rechercher par nom ou adresse…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select
            aria-label="Filtrer par statut"
            className="sm:max-w-[200px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as BusinessStatus | '');
              setPage(1);
            }}
          >
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABELS) as BusinessStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Rechercher
          </Button>
        </form>
      )}

      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {!loading && !error && tab === 'flagged' && <FlaggedList items={flagged ?? []} />}

      {!loading && !error && tab !== 'flagged' && rows && (
        <>
          {rows.data.length === 0 ? (
            <Card className="text-center text-slate-500">
              {tab === 'pending' ? 'Aucune entreprise en attente de validation.' : 'Aucune entreprise trouvée.'}
            </Card>
          ) : (
            <ul className="space-y-3">
              {rows.data.map((b) => (
                <li key={b.id}>
                  <BusinessCard
                    business={b}
                    quickActions={tab === 'pending'}
                    onAction={(action) => setDialog({ id: b.id, name: b.name, action })}
                  />
                </li>
              ))}
            </ul>
          )}
          <Pagination meta={rows.meta} onChange={setPage} />
        </>
      )}

      {dialog && (
        <ModerationDialog
          businessId={dialog.id}
          businessName={dialog.name}
          action={dialog.action}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BusinessCard({
  business,
  quickActions,
  onAction,
}: {
  business: PlatformBusinessRow;
  quickActions: boolean;
  onAction: (action: ModerationAction) => void;
}) {
  const sub = business.status === 'ACTIVE' ? subscriptionInfo(business) : null;
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/plateforme/entreprises/${business.id}`} className="truncate text-lg font-semibold text-slate-900 hover:underline">
            {business.name}
          </Link>
          <StatusBadge status={business.status} />
          {business.openReports > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
              {business.openReports} signalement{business.openReports > 1 ? 's' : ''}
            </span>
          )}
          {sub && <span className={`text-xs font-medium ${sub.color}`}>{sub.label} · échéance {sub.due}</span>}
        </div>
        <p className="text-sm text-slate-500">
          /{business.slug} · {countryName(business.country)} ({business.currency}) · inscrite le {formatDate(business.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {quickActions && (
          <>
            <Button onClick={() => onAction('approve')}>Valider</Button>
            <Button variant="secondary" onClick={() => onAction('reject')}>
              Refuser
            </Button>
          </>
        )}
        <Link
          href={`/plateforme/entreprises/${business.id}`}
          className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          Détails
        </Link>
      </div>
    </Card>
  );
}

function FlaggedList({ items }: { items: FlaggedBusiness[] }) {
  if (items.length === 0) {
    return <Card className="text-center text-slate-500">Aucune entreprise n’a atteint le seuil de signalements.</Card>;
  }
  return (
    <ul className="space-y-3">
      {items.map((b) => (
        <li key={b.id}>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-slate-900">{b.name}</span>
                <StatusBadge status={b.status} />
              </div>
              <p className="text-sm text-red-700">
                {b.openReports} signalement{b.openReports > 1 ? 's' : ''} à examiner
              </p>
            </div>
            <Link
              href={`/plateforme/entreprises/${b.id}`}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Examiner
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
