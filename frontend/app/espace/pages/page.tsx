'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, listPages, setPagePublication } from '../../../lib/api';
import { useCan, useSession } from '../../../lib/session';
import type { ContentPage } from '../../../lib/types';
import { Alert, Button, Card, Spinner } from '../../../components/ui';

export default function PagesListPage() {
  const can = useCan();
  const { user } = useSession();
  const base = user?.business ? `/${user.business.slug}` : '';

  const [items, setItems] = useState<ContentPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listPages());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les pages.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublication(page: ContentPage) {
    setBusyId(page.id);
    try {
      await setPagePublication(page.id, page.status === 'PUBLISHED' ? 'unpublish' : 'publish');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pages</h1>
          <p className="text-sm text-slate-500">
            À propos, livraison, garantie, vos propres conditions de vente… des pages affichées sur votre vitrine, à
            l’adresse de votre choix.
          </p>
        </div>
        {can('pages:create') && (
          <Link
            href="/espace/pages/nouveau"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Nouvelle page
          </Link>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <Card className="text-center text-slate-500">Aucune page pour l’instant.</Card>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link href={`/espace/pages/${p.id}`} className="block truncate font-semibold text-slate-900 hover:underline">
                    {p.title}
                  </Link>
                  <p className="truncate text-sm text-slate-500">
                    {base}/{p.slug}
                  </p>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {p.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {can('pages:publish') && (
                    <Button variant="secondary" loading={busyId === p.id} onClick={() => togglePublication(p)}>
                      {p.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                    </Button>
                  )}
                  <Link
                    href={`/espace/pages/${p.id}`}
                    className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Modifier
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
