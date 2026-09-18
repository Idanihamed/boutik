import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PromotionAdminStatus } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { PromotionCandidate } from '../common/utils/pricing.util';
import { computePromotionStatus, isPromotionCurrentlyActive } from '../common/utils/promotion-status.util';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { QueryPromotionsAdminDto } from './dto/query-promotions-admin.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PROMOTION_INCLUDE, toPromotionView } from './promotions.mapper';

@Injectable()
export class PromotionsService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  private assertValidInput(dto: { type?: string; value?: number; startsAt?: string; endsAt?: string }) {
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début.');
    }
    if (dto.type === 'PERCENTAGE' && dto.value != null && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('Un pourcentage de réduction doit être compris entre 1 et 100.');
    }
    if (dto.value != null && dto.value < 0) {
      throw new BadRequestException('La valeur de la réduction ne peut pas être négative.');
    }
  }

  /**
   * §27 : activer/désactiver une promotion est une action distincte (`promotions:activate`)
   * de la simple création/modification de son contenu (`promotions:create`/`promotions:update`)
   * — c'est pour ça que activate()/disable()/setDraft() existent comme routes séparées avec
   * leur propre permission. Mais `adminStatus` fait aussi partie du DTO de création/modification
   * (pratique : on peut créer une promotion déjà active en un seul appel) — sans ce garde-fou,
   * un rôle qui aurait `promotions:create`/`promotions:update` sans `promotions:activate`
   * pourrait quand même activer/désactiver une promotion en le glissant dans ce DTO, ce qui
   * viderait complètement `promotions:activate` de son sens. Seul le statut DRAFT (état par
   * défaut, sans effet tant qu'il n'est pas activé) ne demande pas cette permission.
   * Sans impact sur les rôles actuels (SUPER_ADMIN et GESTIONNAIRE ont déjà les deux
   * permissions), mais protège tout rôle plus restreint ajouté dans une phase future.
   */
  private assertCanSetAdminStatus(adminStatus: string | undefined, callerPermissions: string[]) {
    if (adminStatus && adminStatus !== 'DRAFT' && !callerPermissions.includes('promotions:activate')) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission d'activer ou de désactiver une promotion. " +
          'Enregistrez-la en brouillon, puis utilisez les actions Activer/Désactiver si vous y êtes autorisé.',
      );
    }
  }

  /** Évite qu'un productId/categoryId invalide ou obsolète (supprimé entre-temps) ne
   * remonte comme une erreur 500 (violation de clé étrangère Prisma) plutôt qu'un 400 clair. */
  private async assertTargetsExist(productIds?: string[], categoryIds?: string[]) {
    if (productIds?.length) {
      const count = await this.prisma.product.count({ where: { id: { in: productIds } } });
      if (count !== new Set(productIds).size) {
        throw new BadRequestException('Un ou plusieurs produits ciblés sont introuvables.');
      }
    }
    if (categoryIds?.length) {
      const count = await this.prisma.category.count({ where: { id: { in: categoryIds } } });
      if (count !== new Set(categoryIds).size) {
        throw new BadRequestException('Une ou plusieurs catégories ciblées sont introuvables.');
      }
    }
  }

  // ---------- Admin ----------

  async findAllAdmin(query: QueryPromotionsAdminDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PromotionWhereInput = {
      ...(query.adminStatus ? { adminStatus: query.adminStatus as PromotionAdminStatus } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        include: PROMOTION_INCLUDE,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return {
      data: items.map(toPromotionView),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneAdmin(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id }, include: PROMOTION_INCLUDE });
    if (!promo) throw new NotFoundException('Promotion introuvable.');
    return toPromotionView(promo);
  }

  async create(dto: CreatePromotionDto, callerPermissions: string[] = []) {
    this.assertValidInput(dto);
    this.assertCanSetAdminStatus(dto.adminStatus, callerPermissions);
    await this.assertTargetsExist(dto.productIds, dto.categoryIds);

    const promo = await this.prisma.promotion.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        value: dto.value,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        priority: dto.priority ?? 0,
        adminStatus: dto.adminStatus ?? 'DRAFT',
        conditions: dto.conditions,
        bannerTitle: dto.bannerTitle,
        bannerSubtitle: dto.bannerSubtitle,
        bannerImage: dto.bannerImage,
        // Dédoublonnage défensif : un même productId/categoryId répété dans le tableau (appel
        // API direct, pas nécessairement via le formulaire admin qui utilise des cases à
        // cocher) ferait échouer le create() avec une violation de contrainte unique Prisma
        // (clé primaire composite promotionId+productId) — un 500 brut plutôt qu'un comportement
        // silencieusement idempotent.
        products: dto.productIds?.length
          ? { create: Array.from(new Set(dto.productIds)).map((productId) => ({ productId })) }
          : undefined,
        categories: dto.categoryIds?.length
          ? { create: Array.from(new Set(dto.categoryIds)).map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      include: PROMOTION_INCLUDE,
    });

    return toPromotionView(promo);
  }

  async update(id: string, dto: UpdatePromotionDto, callerPermissions: string[] = []) {
    const existing = await this.findOneAdmin(id);

    this.assertValidInput({
      type: dto.type ?? existing.type,
      value: dto.value ?? existing.value,
      startsAt: dto.startsAt ?? existing.startsAt.toISOString(),
      endsAt: dto.endsAt ?? existing.endsAt.toISOString(),
    });
    // Seul un changement RÉEL de statut est concerné : renvoyer le statut déjà en place
    // (cas du formulaire d'admin, qui soumet toujours adminStatus même sans le modifier) ne
    // doit pas exiger `promotions:activate` si ce n'était déjà pas nécessaire pour l'obtenir.
    if (dto.adminStatus !== undefined && dto.adminStatus !== existing.adminStatus) {
      this.assertCanSetAdminStatus(dto.adminStatus, callerPermissions);
    }
    await this.assertTargetsExist(dto.productIds, dto.categoryIds);

    const data: Prisma.PromotionUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.value !== undefined ? { value: dto.value } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.adminStatus !== undefined ? { adminStatus: dto.adminStatus } : {}),
      ...(dto.conditions !== undefined ? { conditions: dto.conditions } : {}),
      ...(dto.bannerTitle !== undefined ? { bannerTitle: dto.bannerTitle } : {}),
      ...(dto.bannerSubtitle !== undefined ? { bannerSubtitle: dto.bannerSubtitle } : {}),
      ...(dto.bannerImage !== undefined ? { bannerImage: dto.bannerImage } : {}),
    };

    if (dto.productIds) {
      await this.prisma.promotionProduct.deleteMany({ where: { promotionId: id } });
      // Voir le commentaire équivalent dans create() : dédoublonnage défensif.
      data.products = { create: Array.from(new Set(dto.productIds)).map((productId) => ({ productId })) };
    }
    if (dto.categoryIds) {
      await this.prisma.promotionCategory.deleteMany({ where: { promotionId: id } });
      data.categories = { create: Array.from(new Set(dto.categoryIds)).map((categoryId) => ({ categoryId })) };
    }

    const promo = await this.prisma.promotion.update({ where: { id }, data, include: PROMOTION_INCLUDE });
    return toPromotionView(promo);
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.promotion.delete({ where: { id } });
    return { success: true };
  }

  async setAdminStatus(id: string, adminStatus: 'DRAFT' | 'ACTIVE' | 'DISABLED') {
    await this.findOneAdmin(id);
    const promo = await this.prisma.promotion.update({ where: { id }, data: { adminStatus }, include: PROMOTION_INCLUDE });
    return toPromotionView(promo);
  }

  async countByDisplayStatus() {
    const promos = await this.prisma.promotion.findMany({ select: { adminStatus: true, startsAt: true, endsAt: true } });
    let active = 0;
    let scheduled = 0;
    for (const p of promos) {
      const status = computePromotionStatus(p);
      if (status === 'ACTIVE') active += 1;
      if (status === 'SCHEDULED') scheduled += 1;
    }
    return { active, scheduled };
  }

  /**
   * Promotions actives qui expirent dans les `withinHours` prochaines heures (§29 :
   * notification "Promotion arrivant à expiration sous 48 heures"). Calculé à la volée à
   * chaque appel plutôt que stocké/déclenché par une tâche planifiée, dans le même esprit
   * que le statut d'affichage des promotions (computePromotionStatus) : aucun job de fond,
   * aucune désynchronisation possible.
   */
  async findExpiringSoon(withinHours = 48) {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    const promos = await this.prisma.promotion.findMany({
      where: { adminStatus: 'ACTIVE', endsAt: { gte: now, lte: horizon } },
    });
    return promos.filter((p) => isPromotionCurrentlyActive(p, now));
  }

  // ---------- Public ----------

  async findActivePublic() {
    const promos = await this.prisma.promotion.findMany({
      where: { adminStatus: 'ACTIVE' },
      include: PROMOTION_INCLUDE,
    });

    return promos
      .filter((p) => isPromotionCurrentlyActive(p))
      .sort((a, b) => b.priority - a.priority)
      .map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        value: p.value,
        bannerTitle: p.bannerTitle,
        bannerSubtitle: p.bannerSubtitle,
        bannerImage: p.bannerImage,
        productCount: p.products.length,
        categories: p.categories.map((c) => c.category.name),
      }));
  }

  /**
   * Pour un lot de produits (id + catégorie), retourne les promotions-campagnes
   * actuellement actives qui les concernent (directement ou via leur catégorie),
   * indexées par produit — utilisé par le module Produits pour calculer le prix effectif.
   */
  async getApplicablePromotionsFor(
    products: Array<{ id: string; categoryId: string }>,
  ): Promise<Map<string, PromotionCandidate[]>> {
    const result = new Map<string, PromotionCandidate[]>();
    if (products.length === 0) return result;

    const productIds = products.map((p) => p.id);
    const categoryIds = Array.from(new Set(products.map((p) => p.categoryId)));

    const promotions = await this.prisma.promotion.findMany({
      where: {
        adminStatus: 'ACTIVE',
        OR: [
          { products: { some: { productId: { in: productIds } } } },
          { categories: { some: { categoryId: { in: categoryIds } } } },
        ],
      },
      include: { products: true, categories: true },
    });

    const activePromotions = promotions.filter((p) => isPromotionCurrentlyActive(p));

    for (const product of products) {
      const candidates: PromotionCandidate[] = [];
      for (const promo of activePromotions) {
        const targetsProduct = promo.products.some((link) => link.productId === product.id);
        const targetsCategory = promo.categories.some((link) => link.categoryId === product.categoryId);
        if (targetsProduct || targetsCategory) {
          candidates.push({
            promotionId: promo.id,
            name: promo.name,
            type: promo.type,
            value: promo.value,
            priority: promo.priority,
            createdAt: promo.createdAt,
          });
        }
      }
      result.set(product.id, candidates);
    }

    return result;
  }
}
