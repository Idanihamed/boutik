import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { toSlug } from '../common/utils/slug.util';
import { BOUTIQUE_INCLUDE, toBoutiqueView } from './boutiques.mapper';
import { CreateBoutiqueDto } from './dto/create-boutique.dto';
import { UpdateBoutiqueDto } from './dto/update-boutique.dto';

@Injectable()
export class BoutiquesService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  /**
   * Le formulaire d'administration bloque déjà côté client la saisie d'une seule des deux
   * coordonnées (voir BoutiqueForm.tsx), mais rien ne l'imposait côté API — un appel direct,
   * ou une simple régression future du formulaire, pouvait enregistrer une latitude sans
   * longitude (ou l'inverse), une paire de coordonnées inutilisable pour afficher une carte.
   */
  private assertValidCoordinates(latitude?: number | null, longitude?: number | null) {
    const hasLatitude = latitude != null;
    const hasLongitude = longitude != null;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('Renseignez la latitude ET la longitude, ou aucune des deux.');
    }
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let candidate = slug;
    let suffix = 2;
    while (
      await this.prisma.boutique.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  // ---------- Admin ----------

  async findAllAdmin() {
    const boutiques = await this.prisma.boutique.findMany({
      include: BOUTIQUE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return boutiques.map(toBoutiqueView);
  }

  async findOneAdmin(id: string) {
    const boutique = await this.prisma.boutique.findUnique({ where: { id }, include: BOUTIQUE_INCLUDE });
    if (!boutique) throw new NotFoundException('Boutique introuvable.');
    return toBoutiqueView(boutique);
  }

  async create(dto: CreateBoutiqueDto) {
    this.assertValidCoordinates(dto.latitude, dto.longitude);
    const slug = await this.ensureUniqueSlug(toSlug(dto.name));

    const boutique = await this.prisma.boutique.create({
      data: {
        name: dto.name,
        slug,
        address: dto.address,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        hours: dto.hours,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        googleMapsUrl: dto.googleMapsUrl,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        images: dto.images?.length
          ? { create: dto.images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i })) }
          : undefined,
      },
      include: BOUTIQUE_INCLUDE,
    });

    return toBoutiqueView(boutique);
  }

  async update(id: string, dto: UpdateBoutiqueDto) {
    const existing = await this.findOneAdmin(id);

    const finalLatitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const finalLongitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;
    this.assertValidCoordinates(finalLatitude, finalLongitude);

    const data: Prisma.BoutiqueUpdateInput = {
      ...(dto.name ? { name: dto.name, slug: await this.ensureUniqueSlug(toSlug(dto.name), id) } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
      ...(dto.hours !== undefined ? { hours: dto.hours } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(dto.googleMapsUrl !== undefined ? { googleMapsUrl: dto.googleMapsUrl } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };

    if (dto.images) {
      await this.prisma.boutiqueImage.deleteMany({ where: { boutiqueId: id } });
      data.images = { create: dto.images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i })) };
    }

    const boutique = await this.prisma.boutique.update({ where: { id }, data, include: BOUTIQUE_INCLUDE });
    return toBoutiqueView(boutique);
  }

  async remove(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.boutique.delete({ where: { id } });
    return { success: true };
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOneAdmin(id);
    const boutique = await this.prisma.boutique.update({ where: { id }, data: { isActive }, include: BOUTIQUE_INCLUDE });
    return toBoutiqueView(boutique);
  }

  async count() {
    return this.prisma.boutique.count();
  }

  // ---------- Public ----------

  async findAllPublic() {
    const boutiques = await this.prisma.boutique.findMany({
      where: { isActive: true },
      include: BOUTIQUE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return boutiques.map(toBoutiqueView);
  }
}
