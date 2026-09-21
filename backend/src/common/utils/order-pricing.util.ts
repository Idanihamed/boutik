import { formatMoney } from './money.util';

export interface PromoCodeRules {
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export type PromoEvaluation = { valid: true; discount: number } | { valid: false; message: string };

/** Un code se saisit sans se soucier des majuscules ni des espaces autour. */
export const normalizePromoCode = (code: string) => code.trim().toUpperCase();

/**
 * Dit si un code promo s'applique à un panier et de combien. `subtotal` est la somme des lignes
 * (prix déjà réduits par les promotions des produits). Le rabais ne dépasse jamais le sous-total :
 * une commande ne peut pas devenir négative.
 */
export function evaluatePromoCode(
  promo: PromoCodeRules | null,
  subtotal: number,
  currency: string,
  now: Date = new Date(),
): PromoEvaluation {
  // Code inconnu ou désactivé : même message, pour ne pas révéler l'existence d'un code inactif.
  if (!promo || !promo.isActive) return { valid: false, message: 'Ce code promo n’existe pas ou n’est plus valable.' };
  if (promo.startsAt && now < promo.startsAt) return { valid: false, message: 'Ce code promo n’est pas encore valable.' };
  if (promo.endsAt && now > promo.endsAt) return { valid: false, message: 'Ce code promo a expiré.' };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { valid: false, message: 'Ce code promo a atteint son nombre maximal d’utilisations.' };
  }
  if (promo.minOrderAmount !== null && subtotal < promo.minOrderAmount) {
    return { valid: false, message: `Ce code est valable dès ${formatMoney(promo.minOrderAmount, currency)} d’achats.` };
  }

  const raw = promo.type === 'PERCENTAGE' ? Math.floor((subtotal * promo.value) / 100) : promo.value;
  return { valid: true, discount: Math.max(0, Math.min(raw, subtotal)) };
}

export interface ShippingSettings {
  shippingFee: number;
  freeShippingThreshold: number | null;
}

/**
 * Frais de livraison d'une commande. Jamais de frais pour un retrait en boutique, ni quand le montant
 * à payer (après code promo) atteint le seuil de livraison offerte.
 */
export function computeShippingFee(settings: ShippingSettings, amountAfterDiscount: number, pickup: boolean): number {
  if (pickup) return 0;
  if (settings.freeShippingThreshold !== null && amountAfterDiscount >= settings.freeShippingThreshold) return 0;
  return settings.shippingFee;
}
