import { Prisma } from '@prisma/client';
import { computePromotionStatus } from '../common/utils/promotion-status.util';

const promotionWithRelations = Prisma.validator<Prisma.PromotionDefaultArgs>()({
  include: {
    products: { include: { product: { select: { id: true, name: true, slug: true } } } },
    categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
  },
});

export type PromotionWithRelations = Prisma.PromotionGetPayload<typeof promotionWithRelations>;

export function toPromotionView(promo: PromotionWithRelations) {
  return {
    id: promo.id,
    name: promo.name,
    description: promo.description,
    type: promo.type,
    value: promo.value,
    startsAt: promo.startsAt,
    endsAt: promo.endsAt,
    priority: promo.priority,
    adminStatus: promo.adminStatus,
    displayStatus: computePromotionStatus(promo),
    conditions: promo.conditions,
    bannerTitle: promo.bannerTitle,
    bannerSubtitle: promo.bannerSubtitle,
    bannerImage: promo.bannerImage,
    products: promo.products.map((link) => link.product),
    categories: promo.categories.map((link) => link.category),
    createdAt: promo.createdAt,
    updatedAt: promo.updatedAt,
  };
}

export const PROMOTION_INCLUDE = promotionWithRelations.include;
