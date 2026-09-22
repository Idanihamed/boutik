import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly notificationsService: NotificationsService,
  ) {}

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
    const before = await this.get();
    await this.prisma.setting.updateMany({ data });
    const after = await this.get();

    // Alerte de sécurité (pas une simple confirmation) : c'est l'endroit où l'argent des clients
    // atterrit. Si ce numéro change — changement légitime du responsable ou compte compromis —
    // le personnel autorisé à voir les paramètres doit le savoir immédiatement, plutôt que de le
    // découvrir en constatant que des paiements n'arrivent plus au bon endroit.
    if ('mobileMoneyNumber' in dto && before.mobileMoneyNumber !== after.mobileMoneyNumber) {
      await this.notificationsService.create(
        'PAYMENT_INFO_CHANGED',
        after.mobileMoneyNumber
          ? `Le numéro Mobile Money de réception des paiements a été modifié (${after.mobileMoneyNumber}). Si ce n'est pas vous, changez immédiatement votre mot de passe.`
          : `Le numéro Mobile Money de réception des paiements a été retiré. Si ce n'est pas vous, changez immédiatement votre mot de passe.`,
        '/espace/parametres',
      );
    }

    return after;
  }
}
