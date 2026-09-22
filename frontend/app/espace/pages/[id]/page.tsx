'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, deletePage, getPage, setPagePublication } from '../../../../lib/api';
import { useCan, useSession } from '../../../../lib/session';
import type { ContentPage } from '../../../../lib/types';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { PageForm } from '../../../../components/PageForm';
import { Alert, Button, Spinner } from '../../../../components/ui';

export default function EditContentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useCan();
  const { user } = useSession();
  const base = user?.business ? `/${user.business.slug}` : '';

  const [page, setPage] = useState<ContentPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      setPage(await getPage(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger cette page.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublication() {
    if (!page) return;
    setBusy(true);
    setError(null);
    try {
      await setPagePublication(id, page.status === 'PUBLISHED' ? 'unpublish' : 'publish');
      setNotice(page.status === 'PUBLISHED' ? 'Page dépubliée.' : 'Page publiée.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deletePage(id);
      router.push('/espace/pages');
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
      setBusy(false);
    }
  }

  if (error && !page) return <Alert>{error}</Alert>;
  if (!page) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/espace/pages" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux pages
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{page.title}</h1>
          <p className="text-sm text-slate-500">
            {base}/{page.slug} · {page.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {page.status === 'PUBLISHED' && (
            <a
              href={`${base}/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Voir sur la vitrine
            </a>
          )}
          {can('pages:publish') && (
            <Button variant="secondary" disabled={busy} onClick={togglePublication}>
              {page.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
            </Button>
          )}
          {can('pages:delete') && (
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {can('pages:update') ? (
        <PageForm
          key={page.updatedAt}
          page={page}
          onSaved={() => {
            setNotice('Modifications enregistrées.');
            load();
          }}
        />
      ) : (
        <Alert kind="info">Votre rôle permet de consulter cette page, pas de la modifier.</Alert>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette page ?"
        message={`« ${page.title} » sera supprimée définitivement.`}
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
