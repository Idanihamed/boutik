import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { toSlug } from '../common/utils/slug.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  // ---------- Admin ----------

  findAllAdmin() {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async findOneAdmin(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Catégorie introuvable.');
    return category;
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let candidate = slug;
    let suffix = 2;
    // Évite les collisions de slug si deux catégories portent un nom très proche.
    while (
      await this.prisma.category.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async create(dto: CreateCategoryDto) {
    const baseSlug = toSlug(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);
    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOneAdmin(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.name) {
      data.slug = await this.ensureUniqueSlug(toSlug(dto.name), id);
    }
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ${productCount} produit(s) sont rattachés à cette catégorie.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Public ----------

  findAllPublic() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, description: true, image: true },
    });
  }
}
