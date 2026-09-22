'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, listArticles, setArticlePublication } from '../../../lib/api';
import { useCan } from '../../../lib/session';
import type { Article, Paginated, ProductStatus } from '../../../lib/types';
import { Pagination } from '../../../components/Pagination';
import { Alert, Button, Card, Input, Select, Spinner } from '../../../components/ui';

export default function ArticlesPage() {
  const can = useCan();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<Paginated<Article> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setResult(await listArticles({ search: search || undefined, status: status || undefined, page }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les actualités.');
    }
  }, [search, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublication(article: Article) {
    setBusyId(article.id);
    try {
      await setArticlePublication(article.id, article.status === 'PUBLISHED' ? 'unpublish' : 'publish');
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
          <h1 className="text-2xl font-bold text-slate-900">Actualités</h1>
          <p className="text-sm text-slate-500">Nouveautés, promotions, événements… affichés sur la page « Actualités » de votre vitrine.</p>
        </div>
        {can('articles:create') && (
          <Link
            href="/espace/actualites/nouveau"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Nouvelle actualité
          </Link>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
          setPage(1);
        }}
        className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      >
        <Input
          aria-label="Rechercher une actualité"
          placeholder="Rechercher par titre…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          aria-label="Filtrer par statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publiées</option>
          <option value="DRAFT">Brouillons</option>
        </Select>
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>

      {error && <Alert>{error}</Alert>}
      {!result && !error && <Spinner />}

      {result && result.data.length === 0 && (
        <Card className="text-center text-slate-500">
          {search || status ? 'Aucune actualité ne correspond à ces filtres.' : 'Aucune actualité pour l’instant.'}
        </Card>
      )}

      {result && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <Link href={`/espace/actualites/${a.id}`} className="block truncate font-semibold text-slate-900 hover:underline">
                      {a.title}
                    </Link>
                    <p className="truncate text-sm text-slate-500">
                      {[a.author, a.category].filter(Boolean).join(' · ') || 'Sans auteur ni catégorie'}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {a.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {can('articles:publish') && (
                    <Button variant="secondary" loading={busyId === a.id} onClick={() => togglePublication(a)}>
                      {a.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                    </Button>
                  )}
                  <Link
                    href={`/espace/actualites/${a.id}`}
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

      {result && <Pagination meta={result.meta} onChange={setPage} />}
    </div>
  );
}
