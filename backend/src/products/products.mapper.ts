import { Prisma } from '@prisma/client';
import { computeStockStatus } from '../common/utils/stock-status.util';
import { PromotionCandidate, resolveEffectivePrice } from '../common/utils/pricing.util';

const productWithRelations = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    category: true,
    brand: true,
    images: { orderBy: { sortOrder: 'asc' } },
    attributes: { orderBy: { sortOrder: 'asc' } },
  },
});

export type ProductWithRelations = Prisma.ProductGetPayload<typeof productWithRelations>;

/**
 * Calcule le prix effectif, le pourcentage de réduction et la promotion appliquée
 * (§7, §14, §15 du cahier des charges) à partir du prix promo "manuel" du produit et des
 * promotions-campagnes actives qui le concernent — jamais codé en dur côté frontend.
 * `applicablePromotions` est calculé en amont par PromotionsService (§14, règle de priorité).
 */
export function toProductView(product: ProductWithRelations, applicablePromotions: PromotionCandidate[] = []) {
  const pricing = resolveEffectivePrice(product.price, product.promoPrice, applicablePromotions);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    category: product.category
      ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
      : null,
    brand: product.brand ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug } : null,
    shortDescription: product.shortDescription,
    description: product.description,
    price: product.price,
    // Valeur brute telle qu'enregistrée (utile pour préremplir le formulaire admin) ;
    // "onSale" indique si une réduction (manuelle ou promotion) s'applique réellement.
    promoPrice: product.promoPrice,
    effectivePrice: pricing.effectivePrice,
    discountPercentage: pricing.discountPercentage,
    onSale: pricing.onSale,
    appliedPromotion: pricing.appliedPromotion,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    stockStatus: computeStockStatus(product.stock, product.lowStockThreshold),
    warranty: product.warranty,
    isFeatured: product.isFeatured,
    status: product.status,
    images: product.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt, isMain: img.isMain })),
    attributes: product.attributes.map((attr) => ({ key: attr.key, value: attr.value })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export const PRODUCT_INCLUDE = productWithRelations.include;
