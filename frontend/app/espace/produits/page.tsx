'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, listCategories, listProducts, setProductPublication } from '../../../lib/api';
import { formatPrice, STOCK_LABELS, STOCK_STYLES } from '../../../lib/labels';
import { useCan, useSession } from '../../../lib/session';
import type { Category, Paginated, Product, ProductStatus } from '../../../lib/types';
import { Pagination } from '../../../components/Pagination';
import { Alert, Button, Card, Input, Select, Spinner } from '../../../components/ui';

export default function ProductsPage() {
  const can = useCan();
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<Paginated<Product> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setResult(
        await listProducts({
          search: search || undefined,
          status: status || undefined,
          category: category || undefined,
          page,
        }),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les produits.');
    }
  }, [search, status, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublication(product: Product) {
    setBusyId(product.id);
    try {
      await setProductPublication(product.id, product.status === 'PUBLISHED' ? 'unpublish' : 'publish');
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
        <h1 className="text-2xl font-bold text-slate-900">Produits</h1>
        {can('products:create') && (
          <Link
            href="/espace/produits/nouveau"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Ajouter un produit
          </Link>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
          setPage(1);
        }}
        className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <Input
          aria-label="Rechercher un produit"
          placeholder="Rechercher par nom ou référence…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          aria-label="Filtrer par catégorie"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProductStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="PUBLISHED">Publiés</option>
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
          {search || status || category ? 'Aucun produit ne correspond à ces filtres.' : 'Aucun produit pour l’instant.'}
        </Card>
      )}

      {result && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((p) => {
            const image = p.images.find((i) => i.isMain) ?? p.images[0];
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.url} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover" />
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <Link href={`/espace/produits/${p.id}`} className="block truncate font-semibold text-slate-900 hover:underline">
                        {p.name}
                      </Link>
                      <p className="truncate text-sm text-slate-500">
                        {p.sku} · {p.category?.name ?? 'Sans catégorie'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900">{formatPrice(p.effectivePrice, currency)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_STYLES[p.stockStatus]}`}>
                          {STOCK_LABELS[p.stockStatus]} ({p.stock})
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {p.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {can('products:publish') && (
                      <Button variant="secondary" loading={busyId === p.id} onClick={() => togglePublication(p)}>
                        {p.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                      </Button>
                    )}
                    <Link
                      href={`/espace/produits/${p.id}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Modifier
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {result && <Pagination meta={result.meta} onChange={setPage} />}
    </div>
  );
}
