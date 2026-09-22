import { Prisma } from '@prisma/client';
import { computeStockStatus } from '../common/utils/stock-status.util';
import { PromotionCandidate, resolveEffectivePrice } from '../common/utils/pricing.util';
import { formatVariantLabel, resolveVariantBasePrice } from '../common/utils/variant-pricing.util';

const productWithRelations = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    category: true,
    brand: true,
    images: { orderBy: { sortOrder: 'asc' } },
    attributes: { orderBy: { sortOrder: 'asc' } },
    variants: { orderBy: { sortOrder: 'asc' } },
  },
});

export type ProductWithRelations = Prisma.ProductGetPayload<typeof productWithRelations>;

/**
 * Calcule le prix effectif, le pourcentage de réduction et la promotion appliquée
 * (§7, §14, §15 du cahier des charges) à partir du prix promo "manuel" du produit et des
 * promotions-campagnes actives qui le concernent — jamais codé en dur côté frontend.
 * `applicablePromotions` est calculé en amont par PromotionsService (§14, règle de priorité).
 *
 * Chaque variante (voir Product.hasVariants) reçoit le même traitement à partir de SON PROPRE
 * prix de base (resolveVariantBasePrice) : une promotion en pourcentage réduit donc chaque
 * variante de ce pourcentage sur son propre prix, jamais un montant unique recopié tel quel.
 *
 * `activeVariantsOnly` masque les variantes désactivées : à `true` pour les vues PUBLIQUES
 * (le client ne doit jamais voir/choisir une variante retirée de la vente), à `false` pour le
 * back-office (le responsable doit pouvoir la retrouver pour la réactiver ou la modifier).
 */
export function toProductView(
  product: ProductWithRelations,
  applicablePromotions: PromotionCandidate[] = [],
  options: { activeVariantsOnly?: boolean } = {},
) {
  const pricing = resolveEffectivePrice(product.price, product.promoPrice, applicablePromotions);

  const sourceVariants = options.activeVariantsOnly ? product.variants.filter((v) => v.isActive) : product.variants;
  const variants = sourceVariants.map((variant) => {
    const base = resolveVariantBasePrice(product, variant);
    const variantPricing = resolveEffectivePrice(base.price, base.promoPrice, applicablePromotions);
    return {
      id: variant.id,
      label: formatVariantLabel(variant) ?? '',
      option1Value: variant.option1Value,
      option2Value: variant.option2Value,
      sku: variant.sku,
      price: base.price,
      promoPrice: base.promoPrice,
      // Valeur BRUTE telle qu'enregistrée (null = « hérite du produit ») — distincte de `price`
      // ci-dessus, qui est déjà résolue : sert à préremplir le formulaire admin (un champ vide
      // doit rester vide, pas afficher le prix du produit comme si c'était celui de la variante).
      priceOverride: variant.price,
      promoPriceOverride: variant.promoPrice,
      effectivePrice: variantPricing.effectivePrice,
      discountPercentage: variantPricing.discountPercentage,
      onSale: variantPricing.onSale,
      stock: variant.stock,
      stockStatus: computeStockStatus(variant.stock, product.lowStockThreshold),
      image: variant.image,
      isActive: variant.isActive,
    };
  });

  // Vue d'ensemble d'un produit à variantes (badge du catalogue, alerte de stock) : la SOMME
  // des stocks de chaque variante ACTIVE — jamais le pire des statuts individuels, sinon une
  // seule variante épuisée ferait passer tout le produit en « Rupture » alors que d'autres
  // tailles ou couleurs restent disponibles.
  const activeVariants = variants.filter((v) => v.isActive);
  const totalVariantStock = activeVariants.reduce((sum, v) => sum + v.stock, 0);

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
    stock: product.hasVariants ? totalVariantStock : product.stock,
    lowStockThreshold: product.lowStockThreshold,
    stockStatus: product.hasVariants
      ? computeStockStatus(totalVariantStock, product.lowStockThreshold)
      : computeStockStatus(product.stock, product.lowStockThreshold),
    warranty: product.warranty,
    isFeatured: product.isFeatured,
    status: product.status,
    images: product.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt, isMain: img.isMain })),
    attributes: product.attributes.map((attr) => ({ key: attr.key, value: attr.value })),
    hasVariants: product.hasVariants,
    variantOption1Name: product.variantOption1Name,
    variantOption2Name: product.variantOption2Name,
    variants,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export const PRODUCT_INCLUDE = productWithRelations.include;
