'use client';

import { useState } from 'react';
import type { ProductImage } from '../../lib/types';

/**
 * `variantImage`/`variantLabel` : quand le client a choisi une variante (taille/couleur) qui a
 * sa propre photo, elle prend la place de la photo principale — c'est tout l'intérêt d'avoir une
 * photo par variante (voir AddToCart) : le client voit ce qu'il commande avant de l'ajouter au
 * panier. Les vignettes du produit restent cliquables pour revenir aux photos générales.
 */
export function ProductGallery({
  images,
  name,
  variantImage,
  variantLabel,
}: {
  images: ProductImage[];
  name: string;
  variantImage?: string | null;
  variantLabel?: string | null;
}) {
  const ordered = [...images].sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const [index, setIndex] = useState(0);
  const showingVariant = Boolean(variantImage);
  const current = showingVariant ? { url: variantImage as string, alt: variantLabel ?? name } : ordered[index];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        Pas de photo
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt ?? name} className="aspect-square w-full rounded-xl border border-slate-200 bg-white object-contain" />
        {showingVariant && variantLabel && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
            {variantLabel}
          </span>
        )}
      </div>
      {ordered.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {ordered.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Voir la photo ${i + 1}`}
                aria-current={i === index}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-brand-600' : 'border-slate-200'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
