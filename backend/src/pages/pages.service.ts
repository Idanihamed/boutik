import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { toSlug } from '../common/utils/slug.util';
import { sanitizeContentHtml } from '../common/utils/sanitize-html.util';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

// Les pages de contenu sont servies côté site public sur une URL racine (/[slug]) pour
// coller au plan du site du §5 (« À propos », « Livraison »... comme entrées de menu de
// premier niveau plutôt que sous /pages/...). Ces segments sont donc réservés : leur
// donner comme slug de page romprait une route existante du site.
const RESERVED_SLUGS = ['admin', 'produits', 'boutiques', 'actualites', 'contact', 'api', 'uploads'];

@Injectable()
export class PagesService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException(
        `Le slug "${slug}" est réservé par le site (route existante) : choisissez un autre titre.`,
      );
    }
    let candidate = slug;
    let suffix = 2;
    while (
      await this.prisma.page.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  /**
   * `pages:publish` est censée être la seule permission qui rend une page de contenu
   * visible publiquement (routes dédiées publish()/unpublish()), mais `status` fait aussi
   * partie du DTO général de création/modification — même faille que celle corrigée sur les
   * promotions, produits et actualités (voir PromotionsService.assertCanSetAdminStatus).
   * Repasser en DRAFT ne demande pas cette permission.
   */
  private assertCanSetStatus(status: string | undefined, callerPermissions: string[]) {
    if (status === 'PUBLISHED' && !callerPermissions.includes('pages:publish')) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de publier une page. Enregistrez-la en brouillon, " +
          'puis utilisez l’action Publier si vous y êtes autorisé.',
      );
    }
  }

  // ---------- Admin ----------

  findAllAdmin() {
    return this.prisma.page.findMany({ orderBy: [{ title: 'asc' }] });
  }

  async findOneAdmin(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Page introuvable.');
    return page;
  }

  async create(dto: CreatePageDto, callerPermissions: string[] = []) {
    this.assertCanSetStatus(dto.status, callerPermissions);
    const slug = await this.ensureUniqueSlug(toSlug(dto.title));
    return this.prisma.page.create({
      data: {
        title: dto.title,
        slug,
        // Voir sanitize-html.util.ts : sans ça, ce champ est une XSS stockée exploitable
        // par n'importe quel compte ayant seulement `pages:create`, pas forcément Super Admin.
        content: sanitizeContentHtml(dto.content),
        image: dto.image,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        status: dto.status ?? 'DRAFT',
      },
    });
  }

  async update(id: string, dto: UpdatePageDto, callerPermissions: string[] = []) {
    const existing = await this.findOneAdmin(id);
    if (dto.status !== undefined && dto.status !== existing.status) {
      this.assertCanSetStatus(dto.status, callerPermissions);
    }

    const data: Prisma.PageUpdateInput = {
      ...(dto.title ? { title: dto.title, slug: await this.ensureUniqueSlug(toSlug(dto.title), id) } : {}),
      // Assaini à l'écriture (voir sanitize-html.util.ts et le commentaire dans create()) :
      // ce champ est injecté tel quel dans la page publique via dangerouslySetInnerHTML.
      ...(dto.content !== undefined ? { content: sanitizeContentHtml(dto.content) } : {}),
      ...(dto.image !== undefined ? { image: dto.image } : {}),
      ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
      ...(dto.seoDescription !== undefined ? { seoDescription: dto.seoDescription } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    };

    return this.prisma.page.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.page.delete({ where: { id } });
    return { success: true };
  }

  async setStatus(id: string, status: 'DRAFT' | 'PUBLISHED') {
    await this.findOneAdmin(id);
    return this.prisma.page.update({ where: { id }, data: { status } });
  }

  count() {
    return this.prisma.page.count();
  }

  // ---------- Public ----------

  async findOneBySlugPublic(slug: string) {
    const page = await this.prisma.page.findFirst({ where: { slug, status: 'PUBLISHED' } });
    if (!page) throw new NotFoundException('Page introuvable.');
    return page;
  }

  /**
   * Utilisée par le sitemap public (frontend/app/sitemap.ts) et par le pied de page de chaque
   * vitrine (qui liste ses propres pages, ex. ses conditions de vente) : la liste complète des
   * pages publiées n'avait jamais eu besoin d'être exposée publiquement avant (la route
   * catch-all /[slug] ne connaît que le slug demandé), d'où l'absence de cette méthode jusqu'ici.
   * `title` est inclus pour l'affichage du pied de page (le sitemap l'ignore simplement).
   */
  findAllSlugsPublic() {
    return this.prisma.page.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, title: true, updatedAt: true },
      orderBy: { title: 'asc' },
    });
  }
}
