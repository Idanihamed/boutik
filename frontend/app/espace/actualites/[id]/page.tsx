'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, deleteArticle, getArticle, setArticlePublication } from '../../../../lib/api';
import { useCan, useSession } from '../../../../lib/session';
import type { Article } from '../../../../lib/types';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { ArticleForm } from '../../../../components/ArticleForm';
import { Alert, Button, Spinner } from '../../../../components/ui';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useCan();
  const { user } = useSession();
  const base = user?.business ? `/${user.business.slug}` : '';

  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      setArticle(await getArticle(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger cette actualité.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublication() {
    if (!article) return;
    setBusy(true);
    setError(null);
    try {
      await setArticlePublication(id, article.status === 'PUBLISHED' ? 'unpublish' : 'publish');
      setNotice(article.status === 'PUBLISHED' ? 'Actualité dépubliée.' : 'Actualité publiée.');
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
      await deleteArticle(id);
      router.push('/espace/actualites');
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
      setBusy(false);
    }
  }

  if (error && !article) return <Alert>{error}</Alert>;
  if (!article) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/espace/actualites" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux actualités
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{article.title}</h1>
          <p className="text-sm text-slate-500">
            {base}/actualites/{article.slug} · {article.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {article.status === 'PUBLISHED' && (
            <a
              href={`${base}/actualites/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Voir sur la vitrine
            </a>
          )}
          {can('articles:publish') && (
            <Button variant="secondary" disabled={busy} onClick={togglePublication}>
              {article.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
            </Button>
          )}
          {can('articles:delete') && (
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {can('articles:update') ? (
        <ArticleForm
          key={article.updatedAt}
          article={article}
          onSaved={() => {
            setNotice('Modifications enregistrées.');
            load();
          }}
        />
      ) : (
        <Alert kind="info">Votre rôle permet de consulter cette actualité, pas de la modifier.</Alert>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette actualité ?"
        message={`« ${article.title} » sera supprimée définitivement.`}
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
