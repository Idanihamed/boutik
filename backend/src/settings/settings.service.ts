import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  // Une ligne de paramètres par entreprise, créée à la première lecture (l'isolation par
  // entreprise est appliquée par l'extension Prisma : findFirst() ne voit que la ligne de
  // l'entreprise courante).
  async get() {
    const existing = await this.prisma.setting.findFirst();
    if (existing) return existing;

    try {
      return await this.prisma.setting.create({ data: {} });
    } catch (error) {
      // Deux premières requêtes simultanées : la seconde échoue sur l'unicité du businessId.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.setting.findFirstOrThrow();
      }
      throw error;
    }
  }

  async update(dto: UpdateSettingsDto) {
    // Une chaîne vide envoyée depuis le formulaire admin signifie "retirer ce lien", pas
    // "le laisser inchangé" — on la convertit donc en `null` plutôt que de la stocker telle
    // quelle (ce qui ferait apparaître une icône pointant vers une URL vide côté public).
    const data = Object.fromEntries(
      Object.entries(dto).map(([key, value]) => [key, value === '' ? null : value]),
    );
    await this.get();
    await this.prisma.setting.updateMany({ data });
    return this.get();
  }
}
