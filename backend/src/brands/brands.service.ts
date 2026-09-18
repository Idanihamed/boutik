import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { toSlug } from '../common/utils/slug.util';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  findAllAdmin() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  async findOneAdmin(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Marque introuvable.');
    return brand;
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let candidate = slug;
    let suffix = 2;
    while (
      await this.prisma.brand.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async create(dto: CreateBrandDto) {
    const slug = await this.ensureUniqueSlug(toSlug(dto.name));
    return this.prisma.brand.create({
      data: { name: dto.name, slug, logo: dto.logo, isActive: dto.isActive ?? true },
    });
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findOneAdmin(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.name) data.slug = await this.ensureUniqueSlug(toSlug(dto.name), id);
    return this.prisma.brand.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    const productCount = await this.prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer : ${productCount} produit(s) sont rattachés à cette marque.`,
      );
    }
    await this.prisma.brand.delete({ where: { id } });
    return { success: true };
  }

  findAllPublic() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, logo: true },
    });
  }
}
