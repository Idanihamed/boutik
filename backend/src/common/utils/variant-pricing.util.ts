/**
 * Une variante hérite du prix du produit tant qu'elle n'a pas son propre prix (par ex. une
 * taille XXL plus chère que le reste de la gamme) : c'est ce que `?? ` exprime ci-dessous.
 * Centralisé ici pour que l'admin (fiche produit), le catalogue public et la commande
 * calculent tous exactement la même chose.
 */
export function resolveVariantBasePrice(
  product: { price: number; promoPrice: number | null },
  variant: { price: number | null; promoPrice: number | null } | null,
): { price: number; promoPrice: number | null } {
  if (!variant) return { price: product.price, promoPrice: product.promoPrice };
  return {
    price: variant.price ?? product.price,
    // Si la variante a son propre prix, le prix promo du PRODUIT (calculé pour un autre prix)
    // ne s'applique plus automatiquement : seul le promo propre à la variante compte, s'il y
    // en a un. Sinon, la variante hérite intégralement du produit (prix normal ET promo).
    promoPrice: variant.price != null ? variant.promoPrice : (variant.promoPrice ?? product.promoPrice),
  };
}

/** Étiquette lisible d'une variante à partir des noms de dimensions du produit (ex. « M · Rouge »). */
export function formatVariantLabel(
  variant: { option1Value: string | null; option2Value: string | null } | null | undefined,
): string | null {
  if (!variant) return null;
  const parts = [variant.option1Value, variant.option2Value].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts.join(' · ') : null;
}
