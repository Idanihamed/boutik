export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FIXED_PRICE';

export interface PromotionCandidate {
  promotionId: string;
  name: string;
  type: DiscountType;
  value: number;
  priority: number;
  createdAt: Date;
}

export interface EffectivePriceResult {
  effectivePrice: number;
  discountPercentage: number;
  onSale: boolean;
  appliedPromotion: { id: string; name: string } | null;
}

function computeDiscountedPrice(price: number, type: DiscountType, value: number): number {
  switch (type) {
    case 'PERCENTAGE':
      return Math.round(price - (price * value) / 100);
    case 'FIXED_AMOUNT':
      return price - value;
    case 'FIXED_PRICE':
      return value;
  }
}

interface Candidate {
  effectivePrice: number;
  priority: number;
  createdAt: Date;
  promotionId: string | null;
  name: string | null;
}

/**
 * Détermine le prix effectif d'un produit à partir de son prix promo "manuel" (§8) et
 * des promotions-campagnes actives qui le concernent, directement ou via sa catégorie
 * (§13-14). Règle de priorité et de cumul (§14 du cahier des charges v2.0) :
 *   1. La promotion avec la priorité numérique la plus élevée l'emporte.
 *   2. En cas d'égalité, la plus récemment créée/activée l'emporte.
 *   3. Une seule réduction s'applique à la fois : jamais de cumul de plusieurs remises.
 * Le prix promo "manuel" du produit agit comme une réduction de priorité la plus basse
 * (un filet de sécurité), toujours battue par une promotion-campagne valide.
 * Une remise qui ne ferait pas réellement baisser le prix (valeur invalide, montant fixe
 * supérieur au prix, prix promo supérieur ou égal au prix normal) est ignorée.
 */
export function resolveEffectivePrice(
  price: number,
  manualPromoPrice: number | null | undefined,
  promotions: PromotionCandidate[],
): EffectivePriceResult {
  const candidates: Candidate[] = [];

  if (manualPromoPrice != null && manualPromoPrice >= 0 && manualPromoPrice < price) {
    candidates.push({
      effectivePrice: manualPromoPrice,
      priority: Number.NEGATIVE_INFINITY,
      createdAt: new Date(0),
      promotionId: null,
      name: null,
    });
  }

  for (const promo of promotions) {
    const computed = computeDiscountedPrice(price, promo.type, promo.value);
    if (computed >= 0 && computed < price) {
      candidates.push({
        effectivePrice: computed,
        priority: promo.priority,
        createdAt: promo.createdAt,
        promotionId: promo.promotionId,
        name: promo.name,
      });
    }
  }

  if (candidates.length === 0) {
    return { effectivePrice: price, discountPercentage: 0, onSale: false, appliedPromotion: null };
  }

  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const winner = candidates[0];
  const discountPercentage = Math.round(((price - winner.effectivePrice) / price) * 100);

  return {
    effectivePrice: winner.effectivePrice,
    discountPercentage,
    onSale: true,
    appliedPromotion: winner.promotionId ? { id: winner.promotionId, name: winner.name ?? '' } : null,
  };
}
