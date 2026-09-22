'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Logo d'une entreprise, avec repli automatique sur une initiale si l'image n'existe plus ou
 * ne charge pas (ex. photo perdue après un redéploiement — le stockage local n'est pas
 * persistant sur Render, voir MediaService) — sans ce repli, le navigateur affiche sa propre
 * icône d'image cassée, ce qui donne un rendu peu professionnel sur l'annuaire public.
 *
 * Le seul `onError` ne suffit pas : pour une image déjà en échec CÔTÉ SERVEUR (le cas courant
 * ici), le navigateur a souvent fini d'essayer de la charger — et déclenché son événement
 * `error` — AVANT que React n'ait fini d'hydrater et d'attacher ce gestionnaire, qui rate donc
 * l'événement (race d'hydratation). D'où la vérification `img.complete && naturalWidth === 0`
 * juste après le montage, qui rattrape ce cas raté par `onError`.
 */
export function ShopLogo({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const style = { width: size, height: size };

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, [src]);

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
      ref={imgRef}
      src={src}
      alt=""
      style={style}
      className="shrink-0 rounded-xl object-cover ring-1 ring-slate-100"
      onError={() => setFailed(true)}
    />
  );
}
