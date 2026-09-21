import type { Metadata } from 'next';
import Link from 'next/link';
import { ShopCard } from '../../components/ShopCard';
import { COUNTRIES } from '../../lib/labels';
import { getDirectory } from '../../lib/server-api';

export const metadata: Metadata = {
  title: 'Découvrir les boutiques · Boutik',
  description: 'Les boutiques en ligne présentes sur Boutik.',
};

type SearchParams = { q?: string; pays?: string; page?: string };

const CONTROL =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

export default async function DirectoryPage({ searchParams }: { searchParams: SearchParams }) {
  const search = (searchParams.q ?? '').trim().slice(0, 60);
  const country = COUNTRIES.some((c) => c.code === searchParams.pays) ? searchParams.pays : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const result = await getDirectory({ search: search || undefined, country, page, limit: 12 });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set('q', search);
    if (country) query.set('pays', country);
    if (target > 1) query.set('page', String(target));
    const qs = query.toString();
    return qs ? `/entreprises?${qs}` : '/entreprises';
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">Découvrir les boutiques</h1>
        <p className="text-slate-600">Des entreprises vérifiées, avec leurs produits et leurs prix.</p>
      </div>

      <form action="/entreprises" className="grid gap-3 sm:grid-cols-[1fr_14rem_auto]">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Rechercher une boutique…"
          aria-label="Rechercher une boutique"
          className={CONTROL}
          maxLength={60}
        />
        <select name="pays" defaultValue={country ?? ''} aria-label="Pays" className={CONTROL}>
          <option value="">Tous les pays</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-[44px] rounded-lg bg-brand-600 px-5 font-medium text-white hover:bg-brand-700">
          Rechercher
        </button>
      </form>

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {search || country ? 'Aucune boutique ne correspond à votre recherche.' : 'Aucune boutique à découvrir pour l’instant.'}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.data.map((shop) => (
            <li key={shop.slug}>
              <ShopCard shop={shop} />
            </li>
          ))}
        </ul>
      )}

      {result.meta.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-slate-600">
          {result.meta.page > 1 ? (
            <Link href={pageHref(result.meta.page - 1)} className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50">
              Précédent
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {result.meta.page} sur {result.meta.totalPages}
          </span>
          {result.meta.page < result.meta.totalPages ? (
            <Link href={pageHref(result.meta.page + 1)} className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50">
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
