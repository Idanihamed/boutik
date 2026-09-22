'use client';

import { useState } from 'react';

/**
 * Logo d'une entreprise, avec repli automatique sur une initiale si l'image n'existe plus ou
 * ne charge pas (ex. photo supprimée du stockage) — sans ce repli, le navigateur affiche sa
 * propre icône d'image cassée, ce qui donne un rendu peu professionnel sur l'annuaire public.
 * Composant client uniquement pour ça (`onError` a besoin de JS) : le reste de la carte
 * (ShopCard) reste un composant serveur.
 */
export function ShopLogo({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        style={style}
        className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 font-display text-xl font-bold text-white"
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={style}
      className="shrink-0 rounded-xl object-cover ring-1 ring-slate-100"
      onError={() => setFailed(true)}
    />
  );
}
