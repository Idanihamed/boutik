import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublishStatus } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { toSlug } from '../common/utils/slug.util';
import { sanitizeContentHtml } from '../common/utils/sanitize-html.util';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticlesAdminDto } from './dto/query-articles-admin.dto';
import { QueryArticlesPublicDto } from './dto/query-articles-public.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let candidate = slug;
    let suffix = 2;
    while (
      await this.prisma.article.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  /**
   * `articles:publish` est censée être la seule permission qui rend une actualité visible
   * publiquement (routes dédiées publish()/unpublish()), mais `status` fait aussi partie du
   * DTO général de création/modification — même faille que celle corrigée sur les
   * promotions et les produits (voir PromotionsService.assertCanSetAdminStatus). Repasser en
   * DRAFT ne demande pas cette permission.
   */
  private assertCanSetStatus(status: string | undefined, callerPermissions: string[]) {
    if (status === 'PUBLISHED' && !callerPermissions.includes('articles:publish')) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de publier une actualité. Enregistrez-la en brouillon, " +
          'puis utilisez l’action Publier si vous y êtes autorisé.',
      );
    }
  }

  // ---------- Admin ----------

  async findAllAdmin(query: QueryArticlesAdminDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ArticleWhereInput = {
      ...(query.status ? { status: query.status as PublishStatus } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneAdmin(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Actualité introuvable.');
    return article;
  }

  async create(dto: CreateArticleDto, callerPermissions: string[] = []) {
    this.assertCanSetStatus(dto.status, callerPermissions);
    const slug = await this.ensureUniqueSlug(toSlug(dto.title));
    return this.prisma.article.create({
      data: {
        title: dto.title,
        slug,
        image: dto.image,
        // Voir sanitize-html.util.ts : sans ça, ce champ est une XSS stockée exploitable
        // par n'importe quel compte ayant seulement `articles:create`, pas forcément
        // Super Admin (voir aussi le commentaire équivalent dans update() ci-dessous).
        content: sanitizeContentHtml(dto.content),
        author: dto.author,
        category: dto.category,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        status: dto.status ?? 'DRAFT',
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
    });
  }

  async update(id: string, dto: UpdateArticleDto, callerPermissions: string[] = []) {
    const existing = await this.findOneAdmin(id);
    // Seul un changement RÉEL de statut est concerné (voir le commentaire équivalent pour
    // les promotions et les produits).
    if (dto.status !== undefined && dto.status !== existing.status) {
      this.assertCanSetStatus(dto.status, callerPermissions);
    }

    const data: Prisma.ArticleUpdateInput = {
      ...(dto.title ? { title: dto.title, slug: await this.ensureUniqueSlug(toSlug(dto.title), id) } : {}),
      ...(dto.image !== undefined ? { image: dto.image } : {}),
      // Assaini à l'écriture (voir sanitize-html.util.ts et le commentaire dans create()) :
      // ce champ est injecté tel quel dans la page publique via dangerouslySetInnerHTML.
      ...(dto.content !== undefined ? { content: sanitizeContentHtml(dto.content) } : {}),
      ...(dto.author !== undefined ? { author: dto.author } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.publishedAt !== undefined ? { publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
      ...(dto.seoDescription !== undefined ? { seoDescription: dto.seoDescription } : {}),
    };

    return this.prisma.article.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.article.delete({ where: { id } });
    return { success: true };
  }

  async setStatus(id: string, status: 'DRAFT' | 'PUBLISHED') {
    const existing = await this.findOneAdmin(id);
    return this.prisma.article.update({
      where: { id },
      // Renseigne publishedAt à la première publication si l'éditeur ne l'a pas déjà fixée
      // manuellement (§20 : le champ "Date" reste modifiable depuis l'admin).
      data: {
        status,
        publishedAt: status === 'PUBLISHED' && !existing.publishedAt ? new Date() : existing.publishedAt,
      },
    });
  }

  async count() {
    const [total, published] = await this.prisma.$transaction([
      this.prisma.article.count(),
      this.prisma.article.count({ where: { status: 'PUBLISHED' } }),
    ]);
    return { total, published };
  }

  // ---------- Public ----------

  async findAllPublic(query: QueryArticlesPublicDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      ...(query.category ? { category: query.category } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneBySlugPublic(slug: string) {
    const article = await this.prisma.article.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (!article) throw new NotFoundException('Actualité introuvable.');
    return article;
  }
}
