import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { PromotionsService } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toSlug } from '../common/utils/slug.util';
import { computeStockStatus } from '../common/utils/stock-status.util';
import { formatVariantLabel } from '../common/utils/variant-pricing.util';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductVariantDto } from './dto/product-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsAdminDto, QueryProductsDto } from './dto/query-products.dto';
import { PRODUCT_INCLUDE, ProductWithRelations, toProductView } from './products.mapper';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly promotionsService: PromotionsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Notifie (§29) uniquement lorsque le stock se dégrade (Disponible -> Stock faible ou
   * Rupture, ou Stock faible -> Rupture) — jamais lors d'un réapprovisionnement, pour éviter
   * le bruit. Comparaison faite sur le statut calculé (computeStockStatus), pas sur un
   * champ stocké, en cohérence avec le reste du module Produits.
   */
  private async notifyIfStockWorsened(
    productId: string,
    productName: string,
    previousStatus: ReturnType<typeof computeStockStatus>,
    newStatus: ReturnType<typeof computeStockStatus>,
  ) {
    const severity = { DISPONIBLE: 0, STOCK_FAIBLE: 1, RUPTURE: 2 } as const;
    if (severity[newStatus] <= severity[previousStatus]) return;

    if (newStatus === 'RUPTURE') {
      await this.notificationsService.create(
        'OUT_OF_STOCK',
        `Le produit « ${productName} » est en rupture de stock.`,
        `/espace/produits/${productId}`,
      );
    } else if (newStatus === 'STOCK_FAIBLE') {
      await this.notificationsService.create(
        'LOW_STOCK',
        `Le produit « ${productName} » passe en stock faible.`,
        `/espace/produits/${productId}`,
      );
    }
  }

  /**
   * Calcule le prix effectif de chaque produit en tenant compte des promotions-campagnes
   * actives (§14 du cahier des charges) : une seule requête groupée pour tout le lot,
   * pour éviter le N+1 lors de l'affichage d'une liste.
   */
  private async mapProductsWithPromotions(products: ProductWithRelations[], activeVariantsOnly = false) {
    const promotionsByProduct = await this.promotionsService.getApplicablePromotionsFor(
      products.map((p) => ({ id: p.id, categoryId: p.categoryId })),
    );
    return products.map((p) => toProductView(p, promotionsByProduct.get(p.id) ?? [], { activeVariantsOnly }));
  }

  private async mapOneWithPromotions(product: ProductWithRelations, activeVariantsOnly = false) {
    const [view] = await this.mapProductsWithPromotions([product], activeVariantsOnly);
    return view;
  }

  /**
   * `products:publish` est censée être la seule permission qui autorise à rendre un produit
   * visible publiquement — d'où les routes dédiées publish()/unpublish() ci-dessous. Mais
   * `status` fait aussi partie du DTO général de création/modification (pratique : créer un
   * produit déjà publié en un seul appel) ; sans ce garde-fou, un rôle avec seulement
   * `products:create`/`products:update` pourrait publier un produit directement via ce champ,
   * ce qui viderait `products:publish` de son sens (même faille que celle corrigée sur les
   * promotions, voir PromotionsService.assertCanSetAdminStatus). Repasser en DRAFT ne demande
   * pas cette permission. Sans impact sur les rôles actuels (GESTIONNAIRE et ÉDITEUR ont déjà
   * les deux permissions), mais protège tout rôle plus restreint ajouté dans une phase future.
   */
  private assertCanSetStatus(status: string | undefined, callerPermissions: string[]) {
    if (status === 'PUBLISHED' && !callerPermissions.includes('products:publish')) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de publier un produit. Enregistrez-le en brouillon, " +
          'puis utilisez l’action Publier si vous y êtes autorisé.',
      );
    }
  }

  /** Un prix promotionnel doit toujours être strictement inférieur au prix normal (§14). */
  private assertValidPromoPrice(price: number, promoPrice?: number | null) {
    if (promoPrice != null && promoPrice >= price) {
      throw new BadRequestException('Le prix promotionnel doit être strictement inférieur au prix normal.');
    }
  }

  /**
   * Un produit à variantes (taille, couleur...) doit avoir un nom pour sa première dimension et
   * au moins une variante ; chaque variante doit renseigner cette dimension (et la seconde, si
   * elle existe), sans qu'aucune combinaison ne se répète — sinon deux lignes "M" désigneraient
   * arbitrairement l'une des deux au client, sans qu'on sache jamais laquelle.
   */
  private assertValidVariants(
    dto: {
      variantOption1Name?: string;
      variantOption2Name?: string;
      variants?: ProductVariantDto[];
    },
    fallbackPrice: number,
  ) {
    if (!dto.variantOption1Name?.trim()) {
      throw new BadRequestException(
        'Indiquez le nom de la première dimension (par exemple « Taille ») pour un produit à variantes.',
      );
    }
    if (!dto.variants?.length) {
      throw new BadRequestException('Ajoutez au moins une variante (par exemple une taille) pour ce produit.');
    }

    const seen = new Set<string>();
    for (const variant of dto.variants) {
      if (!variant.option1Value?.trim()) {
        throw new BadRequestException(`Chaque variante doit préciser sa valeur pour « ${dto.variantOption1Name} ».`);
      }
      if (dto.variantOption2Name && !variant.option2Value?.trim()) {
        throw new BadRequestException(`Chaque variante doit préciser sa valeur pour « ${dto.variantOption2Name} ».`);
      }
      if (!dto.variantOption2Name && variant.option2Value?.trim()) {
        throw new BadRequestException(
          'Une valeur est fournie pour une deuxième dimension, mais aucune deuxième dimension n’est définie.',
        );
      }

      const key = `${variant.option1Value.trim().toLowerCase()}::${variant.option2Value?.trim().toLowerCase() ?? ''}`;
      if (seen.has(key)) {
        throw new BadRequestException('Deux variantes ne peuvent pas avoir exactement les mêmes valeurs.');
      }
      seen.add(key);

      this.assertValidPromoPrice(variant.price ?? fallbackPrice, variant.promoPrice);
    }
  }

  private toVariantCreateData(variant: ProductVariantDto, index: number) {
    return {
      option1Value: variant.option1Value?.trim() || null,
      option2Value: variant.option2Value?.trim() || null,
      sku: variant.sku?.trim() || null,
      price: variant.price ?? null,
      promoPrice: variant.promoPrice ?? null,
      stock: variant.stock,
      image: variant.image ?? null,
      isActive: variant.isActive ?? true,
      sortOrder: variant.sortOrder ?? index,
    };
  }

  /** Évite qu'un categoryId/brandId invalide ou obsolète (supprimé entre-temps) ne
   * remonte comme une erreur 500 (violation de clé étrangère Prisma) plutôt qu'un 400 clair. */
  private async assertCategoryAndBrandExist(categoryId?: string, brandId?: string | null) {
    if (categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
      if (!category) throw new BadRequestException('Catégorie introuvable.');
    }
    if (brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) throw new BadRequestException('Marque introuvable.');
    }
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let candidate = slug;
    let suffix = 2;
    while (
      await this.prisma.product.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  // ---------- Admin ----------

  async findAllAdmin(query: QueryProductsAdminDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status as ProductStatus } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: await this.mapProductsWithPromotions(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneAdmin(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) throw new NotFoundException('Produit introuvable.');
    return this.mapOneWithPromotions(product);
  }

  async create(dto: CreateProductDto, callerPermissions: string[] = []) {
    const existingSku = await this.prisma.product.findFirst({ where: { sku: dto.sku } });
    if (existingSku) throw new ConflictException('Ce SKU / référence est déjà utilisé.');
    this.assertValidPromoPrice(dto.price, dto.promoPrice);
    this.assertCanSetStatus(dto.status, callerPermissions);
    await this.assertCategoryAndBrandExist(dto.categoryId, dto.brandId);
    if (dto.hasVariants) this.assertValidVariants(dto, dto.price);

    const slug = await this.ensureUniqueSlug(toSlug(dto.name));

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        shortDescription: dto.shortDescription,
        description: dto.description,
        price: dto.price,
        promoPrice: dto.promoPrice,
        stock: dto.stock ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        warranty: dto.warranty,
        isFeatured: dto.isFeatured ?? false,
        status: dto.status ?? 'DRAFT',
        hasVariants: dto.hasVariants ?? false,
        variantOption1Name: dto.hasVariants ? dto.variantOption1Name : undefined,
        variantOption2Name: dto.hasVariants ? dto.variantOption2Name : undefined,
        images: dto.images?.length
          ? { create: dto.images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i })) }
          : undefined,
        attributes: dto.attributes?.length
          ? { create: dto.attributes.map((attr, i) => ({ ...attr, sortOrder: attr.sortOrder ?? i })) }
          : undefined,
        variants:
          dto.hasVariants && dto.variants?.length
            ? { create: dto.variants.map((v, i) => this.toVariantCreateData(v, i)) }
            : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    return this.mapOneWithPromotions(product);
  }

  async update(id: string, dto: UpdateProductDto, callerPermissions: string[] = []) {
    const existing = await this.findOneAdmin(id);

    if (dto.sku) {
      const existingSku = await this.prisma.product.findFirst({ where: { sku: dto.sku, NOT: { id } } });
      if (existingSku) throw new ConflictException('Ce SKU / référence est déjà utilisé par un autre produit.');
    }

    const finalPrice = dto.price ?? existing.price;
    const finalPromoPrice = dto.promoPrice !== undefined ? dto.promoPrice : existing.promoPrice;
    this.assertValidPromoPrice(finalPrice, finalPromoPrice);
    // Seul un changement RÉEL de statut est concerné : renvoyer le statut déjà en place (cas
    // du formulaire d'admin, qui soumet toujours "status" même sans le modifier) ne doit pas
    // exiger `products:publish` si ce n'était déjà pas nécessaire pour l'obtenir.
    if (dto.status !== undefined && dto.status !== existing.status) {
      this.assertCanSetStatus(dto.status, callerPermissions);
    }
    await this.assertCategoryAndBrandExist(dto.categoryId, dto.brandId);

    const data: Prisma.ProductUpdateInput = {
      ...(dto.name ? { name: dto.name, slug: await this.ensureUniqueSlug(toSlug(dto.name), id) } : {}),
      ...(dto.sku ? { sku: dto.sku } : {}),
      ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
      ...(dto.brandId !== undefined
        ? { brand: dto.brandId ? { connect: { id: dto.brandId } } : { disconnect: true } }
        : {}),
      ...(dto.shortDescription !== undefined ? { shortDescription: dto.shortDescription } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.promoPrice !== undefined ? { promoPrice: dto.promoPrice } : {}),
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
      ...(dto.warranty !== undefined ? { warranty: dto.warranty } : {}),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    };

    if (dto.images) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      data.images = { create: dto.images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i })) };
    }
    if (dto.attributes) {
      await this.prisma.productAttribute.deleteMany({ where: { productId: id } });
      data.attributes = { create: dto.attributes.map((attr, i) => ({ ...attr, sortOrder: attr.sortOrder ?? i })) };
    }

    // Variantes : un nouveau tableau REMPLACE entièrement l'ancien (même principe que
    // images/attributes ci-dessus) ; un tableau absent ne touche à rien. Repasser à "sans
    // variantes" efface toujours les anciennes lignes, même sans nouveau tableau fourni : le
    // produit reprend alors son propre prix et son propre stock.
    const finalHasVariants = dto.hasVariants ?? existing.hasVariants;
    const turningOn = finalHasVariants && !existing.hasVariants;
    if (turningOn && dto.variants === undefined) {
      throw new BadRequestException('Ajoutez au moins une variante pour activer les variantes de ce produit.');
    }

    data.hasVariants = finalHasVariants;
    if (!finalHasVariants) {
      data.variantOption1Name = null;
      data.variantOption2Name = null;
      if (existing.hasVariants) await this.prisma.productVariant.deleteMany({ where: { productId: id } });
    } else {
      if (dto.variantOption1Name !== undefined) data.variantOption1Name = dto.variantOption1Name;
      if (dto.variantOption2Name !== undefined) data.variantOption2Name = dto.variantOption2Name;

      if (dto.variants !== undefined) {
        this.assertValidVariants(
          {
            variantOption1Name: dto.variantOption1Name ?? existing.variantOption1Name ?? undefined,
            variantOption2Name: dto.variantOption2Name ?? existing.variantOption2Name ?? undefined,
            variants: dto.variants,
          },
          finalPrice,
        );
        await this.prisma.productVariant.deleteMany({ where: { productId: id } });
        data.variants = dto.variants.length
          ? { create: dto.variants.map((v, i) => this.toVariantCreateData(v, i)) }
          : undefined;
      }
    }

    const product = await this.prisma.product.update({ where: { id }, data, include: PRODUCT_INCLUDE });

    if (dto.stock !== undefined || dto.lowStockThreshold !== undefined) {
      const newStatus = computeStockStatus(product.stock, product.lowStockThreshold);
      await this.notifyIfStockWorsened(product.id, product.name, existing.stockStatus, newStatus);
    }

    return this.mapOneWithPromotions(product);
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  async setStatus(id: string, status: ProductStatus) {
    await this.findOneAdmin(id);
    const product = await this.prisma.product.update({ where: { id }, data: { status }, include: PRODUCT_INCLUDE });
    return this.mapOneWithPromotions(product);
  }

  async duplicate(id: string) {
    const original = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!original) throw new NotFoundException('Produit introuvable.');

    const name = `${original.name} (copie)`;
    const slug = await this.ensureUniqueSlug(toSlug(name));
    const sku = await this.ensureUniqueSku(`${original.sku}-COPIE`);

    const copy = await this.prisma.product.create({
      data: {
        name,
        slug,
        sku,
        categoryId: original.categoryId,
        brandId: original.brandId,
        shortDescription: original.shortDescription,
        description: original.description,
        price: original.price,
        promoPrice: original.promoPrice,
        stock: 0,
        lowStockThreshold: original.lowStockThreshold,
        warranty: original.warranty,
        isFeatured: false,
        status: 'DRAFT',
        hasVariants: original.hasVariants,
        variantOption1Name: original.variantOption1Name,
        variantOption2Name: original.variantOption2Name,
        images: {
          create: original.images.map((img) => ({
            url: img.url,
            alt: img.alt,
            isMain: img.isMain,
            sortOrder: img.sortOrder,
          })),
        },
        attributes: {
          create: original.attributes.map((attr) => ({
            key: attr.key,
            value: attr.value,
            sortOrder: attr.sortOrder,
          })),
        },
        // Copie des variantes, stock remis à zéro comme pour le produit lui-même.
        variants: {
          create: original.variants.map((v) => ({
            option1Value: v.option1Value,
            option2Value: v.option2Value,
            sku: v.sku,
            price: v.price,
            promoPrice: v.promoPrice,
            stock: 0,
            image: v.image,
            isActive: v.isActive,
            sortOrder: v.sortOrder,
          })),
        },
      },
      include: PRODUCT_INCLUDE,
    });

    return this.mapOneWithPromotions(copy);
  }

  private async ensureUniqueSku(sku: string): Promise<string> {
    let candidate = sku;
    let suffix = 2;
    while (await this.prisma.product.findFirst({ where: { sku: candidate } })) {
      candidate = `${sku}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async adjustStock(id: string, delta: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');
    if (product.hasVariants) {
      throw new BadRequestException(
        'Ce produit a des variantes : ajustez le stock de chaque taille/couleur depuis sa fiche.',
      );
    }
    const previousStatus = computeStockStatus(product.stock, product.lowStockThreshold);
    const newStock = Math.max(0, product.stock + delta);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
      include: PRODUCT_INCLUDE,
    });

    const newStatus = computeStockStatus(updated.stock, updated.lowStockThreshold);
    await this.notifyIfStockWorsened(updated.id, updated.name, previousStatus, newStatus);

    return this.mapOneWithPromotions(updated);
  }

  /** Ajuste le stock d'UNE variante (voir adjustStock, l'équivalent pour un produit sans variante). */
  async adjustVariantStock(productId: string, variantId: string, delta: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produit introuvable.');
    if (!product.hasVariants) throw new BadRequestException('Ce produit n’a pas de variantes.');

    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new NotFoundException('Variante introuvable.');

    const previousStatus = computeStockStatus(variant.stock, product.lowStockThreshold);
    const newStock = Math.max(0, variant.stock + delta);
    await this.prisma.productVariant.update({ where: { id: variantId }, data: { stock: newStock } });

    const newStatus = computeStockStatus(newStock, product.lowStockThreshold);
    const label = formatVariantLabel(variant);
    await this.notifyIfStockWorsened(
      product.id,
      label ? `${product.name} (${label})` : product.name,
      previousStatus,
      newStatus,
    );

    const updated = await this.prisma.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_INCLUDE });
    return this.mapOneWithPromotions(updated);
  }

  async lowStockAndOutOfStock() {
    const products = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      include: PRODUCT_INCLUDE,
    });
    const mapped = await this.mapProductsWithPromotions(products);
    return {
      lowStock: mapped.filter((p) => p.stockStatus === 'STOCK_FAIBLE'),
      outOfStock: mapped.filter((p) => p.stockStatus === 'RUPTURE'),
    };
  }

  // ---------- Public ----------

  async findAllPublic(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
              { brand: { name: { contains: query.search, mode: 'insensitive' } } },
              { category: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.available ? { stock: { gt: 0 } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      // Le filtre "onSale" ne peut pas être exprimé en SQL car il dépend des promotions
      // actives calculées dynamiquement (§14) : il est appliqué en mémoire ci-dessous.
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : query.sort === 'name_asc'
            ? { name: 'asc' }
            : { createdAt: 'desc' };

    if (query.onSale) {
      // Le prix effectif dépend des promotions actives, pas seulement des colonnes du
      // produit : on ne peut pas filtrer ni paginer ce cas en SQL. Le catalogue restant
      // de taille raisonnable à ce stade du projet, on charge les produits correspondant
      // aux autres filtres, on calcule leur prix effectif, puis on filtre/pagine en mémoire.
      // À optimiser (colonne de prix effectif matérialisée, ou moteur de recherche dédié)
      // si le catalogue grossit significativement (voir §29 de la revue du cahier des charges).
      const allMatching = await this.prisma.product.findMany({ where, include: PRODUCT_INCLUDE, orderBy });
      const allViews = await this.mapProductsWithPromotions(allMatching, true);
      const onSaleViews = allViews.filter((p) => p.onSale);
      const total = onSaleViews.length;
      const data = onSaleViews.slice((page - 1) * limit, (page - 1) * limit + limit);
      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: await this.mapProductsWithPromotions(items, true),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findFeaturedPublic(take = 8) {
    const items = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED', isFeatured: true },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take,
    });
    return this.mapProductsWithPromotions(items, true);
  }

  async findOneBySlugPublic(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug },
      include: PRODUCT_INCLUDE,
    });
    if (!product || product.status !== 'PUBLISHED') {
      throw new NotFoundException('Produit introuvable.');
    }

    const similar = await this.prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
        categoryId: product.categoryId,
        NOT: { id: product.id },
      },
      include: PRODUCT_INCLUDE,
      take: 4,
    });

    const [productView, ...similarViews] = await this.mapProductsWithPromotions([product, ...similar], true);

    return {
      product: productView,
      similarProducts: similarViews,
    };
  }
}
