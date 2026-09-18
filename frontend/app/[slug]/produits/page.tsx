import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getProducts, getStorefront } from '../../../lib/server-api';
import { ProductCard } from '../../../components/storefront/ProductCard';

type SearchParams = { q?: string; categorie?: string; tri?: string; dispo?: string; page?: string };

const SORTS = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'name_asc', label: 'Nom (A → Z)' },
];

const CONTROL =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  const { slug } = params;
  const store = await getStorefront(slug);
  if (!store) notFound();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const sort = SORTS.some((s) => s.value === searchParams.tri) ? searchParams.tri : 'newest';
  const [categories, result] = await Promise.all([
    getCategories(slug),
    getProducts(slug, {
      search: searchParams.q?.trim() || undefined,
      category: searchParams.categorie || undefined,
      sort,
      available: searchParams.dispo === 'true',
      page,
      limit: 12,
    }),
  ]);
  const products = result?.data ?? [];
  const meta = result?.meta;

  function pageHref(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') query.set(key, value);
    }
    query.set('page', String(target));
    return `/${slug}/produits?${query}`;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Produits</h1>

      {/* Formulaire GET classique : fonctionne sans JavaScript et rend la recherche partageable par lien. */}
      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          name="q"
          type="search"
          aria-label="Rechercher un produit"
          placeholder="Rechercher un produit…"
          defaultValue={searchParams.q ?? ''}
          className={CONTROL}
        />
        <select name="categorie" aria-label="Catégorie" defaultValue={searchParams.categorie ?? ''} className={CONTROL}>
          <option value="">Toutes les catégories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="tri" aria-label="Trier par" defaultValue={sort} className={CONTROL}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-[44px] rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Filtrer
        </button>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-700 sm:col-span-4">
          <input type="checkbox" name="dispo" value="true" defaultChecked={searchParams.dispo === 'true'} className="h-5 w-5 rounded border-slate-300 text-brand-600" />
          Uniquement les produits disponibles
        </label>
      </form>

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Aucun produit ne correspond à votre recherche.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} slug={slug} currency={store.currency} />
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
              Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-600">
            Page {meta.page} sur {meta.totalPages}
          </span>
          {page < meta.totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
              Suivant
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
