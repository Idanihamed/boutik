export type PromotionDisplayStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';

interface PromotionDates {
  adminStatus: 'DRAFT' | 'ACTIVE' | 'DISABLED';
  startsAt: Date;
  endsAt: Date;
}

/**
 * Calcule le statut réellement affiché d'une promotion (§14 du cahier des charges) :
 * DRAFT et DISABLED sont des choix explicites de l'administrateur ; lorsque celui-ci a
 * activé la promotion (adminStatus = ACTIVE), le statut affiché (Programmée / Active /
 * Expirée) est dérivé automatiquement de la date courante, sans job de fond ni statut
 * stocké à faire vieillir — l'activation et l'expiration sont donc toujours exactes.
 */
export function computePromotionStatus(promo: PromotionDates, now: Date = new Date()): PromotionDisplayStatus {
  if (promo.adminStatus === 'DRAFT') return 'DRAFT';
  if (promo.adminStatus === 'DISABLED') return 'DISABLED';

  if (now < promo.startsAt) return 'SCHEDULED';
  if (now > promo.endsAt) return 'EXPIRED';
  return 'ACTIVE';
}

export function isPromotionCurrentlyActive(promo: PromotionDates, now: Date = new Date()): boolean {
  return computePromotionStatus(promo, now) === 'ACTIVE';
}
