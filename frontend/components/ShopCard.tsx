import Link from 'next/link';
import { countryName } from '../lib/labels';
import type { DirectoryEntry } from '../lib/types';

/** Carte d'une entreprise dans l'annuaire : logo, nom, pays, courte présentation. */
export function ShopCard({ shop }: { shop: DirectoryEntry }) {
  return (
    <Link
      href={`/${shop.slug}`}
      className="flex h-full gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-brand-600 hover:shadow-sm"
    >
      {shop.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.logo} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xl font-bold text-white">
          {shop.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-900">{shop.name}</span>
        <span className="block text-xs text-slate-500">{countryName(shop.country)}</span>
        {shop.description && <span className="mt-1 line-clamp-2 block text-sm text-slate-600">{shop.description}</span>}
      </span>
    </Link>
  );
}
