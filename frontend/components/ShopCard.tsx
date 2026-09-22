import Link from 'next/link';
import { countryName } from '../lib/labels';
import type { DirectoryEntry } from '../lib/types';
import { ShopLogo } from './ShopLogo';

/** Carte d'une entreprise dans l'annuaire : logo, nom, pays, courte présentation. */
export function ShopCard({ shop }: { shop: DirectoryEntry }) {
  return (
    <Link
      href={`/${shop.slug}`}
      className="group flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-brand-500 hover:shadow-[0_8px_24px_rgba(14,107,87,0.12)] sm:p-5"
    >
      <ShopLogo src={shop.logo} name={shop.name} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-[15px] font-bold text-slate-900">{shop.name}</span>
          {/* Cohérent avec "Des entreprises vérifiées" (page /entreprises) : seule une entreprise
              validée par la plateforme apparaît dans l'annuaire, ce badge le rend visible. */}
          <svg
            className="h-4 w-4 shrink-0 text-brand-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-label="Entreprise vérifiée"
          >
            <path
              fillRule="evenodd"
              d="M10 1.5 12.4 3l2.9-.3 1 2.7 2.5 1.4-.8 2.8.8 2.8-2.5 1.4-1 2.7-2.9-.3L10 18.5 7.6 17l-2.9.3-1-2.7-2.5-1.4.8-2.8-.8-2.8 2.5-1.4 1-2.7 2.9.3L10 1.5Zm3.7 6.1-1.1-1.1-3.4 3.4-1.4-1.4-1.1 1.1 2.5 2.5 4.5-4.5Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18s6-5.33 6-10a6 6 0 1 0-12 0c0 4.67 6 10 6 10Zm0-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              clipRule="evenodd"
            />
          </svg>
          {countryName(shop.country)}
        </span>
        {shop.description && (
          <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{shop.description}</span>
        )}
        <span className="mt-auto flex items-center gap-1 pt-2 text-[13px] font-semibold text-brand-700">
          Voir la boutique
          <svg
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.3 14.7a1 1 0 0 1 0-1.4L10.6 10 7.3 6.7a1 1 0 1 1 1.4-1.4l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </span>
    </Link>
  );
}
