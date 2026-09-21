import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { PromotionsService } from '../promotions/promotions.service';

// Identifiants synthétiques pour les notifications "virtuelles" (calculées à la volée,
// jamais stockées) — voir findAllAdmin().
const VIRTUAL_ID_PREFIX = 'virtual:promotion-expiring:';

/**
 * §29 ne définit pas de ressource de permission propre pour les notifications elles-mêmes,
 * mais chaque notification PORTE sur une ressource qui, elle, en a une (un message de
 * contact, un produit, une promotion). Sans ce mappage, la cloche de notifications
 * contournait le RBAC : elle était accessible à tout utilisateur admin authentifié quel que
 * soit son rôle (aucun `@RequirePermissions` sur `NotificationsController`), et affichait
 * donc en clair le nom et le sujet des messages de contact, ou le nom des promotions, à des
 * rôles qui n'ont pourtant ni `messages:read` ni `promotions:read` — l'Éditeur, par exemple
 * (§27). Même faille de fond que celle corrigée sur le tableau de bord en phase 3, ici sur du
 * contenu et pas seulement des compteurs.
 */
const PERMISSION_BY_TYPE: Record<NotificationType, string> = {
  CONTACT_MESSAGE: 'messages:read',
  LOW_STOCK: 'products:read',
  OUT_OF_STOCK: 'products:read',
  PROMOTION_EXPIRING: 'promotions:read',
  NEW_ORDER: 'orders:read',
};

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly promotionsService: PromotionsService,
  ) {}

  /** Utilisé par les autres modules (messages de contact, stock produit) pour notifier. */
  async create(type: NotificationType, message: string, link?: string) {
    return this.prisma.notification.create({ data: { type, message, link } });
  }

  /**
   * Liste combinée pour le back-office (§29) : notifications stockées (message de contact,
   * stock faible/rupture) + notifications "virtuelles" calculées à la volée (promotions
   * expirant sous 48h, voir PromotionsService.findExpiringSoon) — ces dernières n'ont pas
   * de ligne en base et ne peuvent donc pas être marquées comme lues individuellement.
   *
   * Chaque entrée est filtrée selon la permission de lecture de la ressource concernée (voir
   * PERMISSION_BY_TYPE) : un rôle qui n'a pas `messages:read` ne voit tout simplement pas les
   * notifications de type CONTACT_MESSAGE, et ainsi de suite. Les éléments sont omis (pas
   * mis à zéro comme sur le tableau de bord) car il s'agit ici d'une liste, pas d'un objet à
   * forme fixe : le front-end n'est donc pas cassé par une liste plus courte.
   */
  async findAllAdmin(callerPermissions: string[] = [], limit = 50) {
    const has = (type: NotificationType) => callerPermissions.includes(PERMISSION_BY_TYPE[type]);

    const [stored, expiringSoon] = await Promise.all([
      this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
      has('PROMOTION_EXPIRING') ? this.promotionsService.findExpiringSoon(48) : Promise.resolve([]),
    ]);

    const virtual = expiringSoon.map((promo) => ({
      id: `${VIRTUAL_ID_PREFIX}${promo.id}`,
      type: 'PROMOTION_EXPIRING' as const,
      message: `La promotion « ${promo.name} » expire le ${promo.endsAt.toLocaleDateString('fr-FR')}.`,
      link: '/espace/promotions',
      isRead: false,
      virtual: true,
      createdAt: promo.endsAt,
    }));

    const combined = [
      ...stored.filter((n) => has(n.type)).map((n) => ({ ...n, virtual: false })),
      ...virtual,
    ];
    combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return combined;
  }

  async unreadCount(callerPermissions: string[] = []) {
    const has = (type: NotificationType) => callerPermissions.includes(PERMISSION_BY_TYPE[type]);

    const [storedUnread, expiringSoon] = await Promise.all([
      this.prisma.notification.findMany({ where: { isRead: false }, select: { type: true } }),
      has('PROMOTION_EXPIRING') ? this.promotionsService.findExpiringSoon(48) : Promise.resolve([]),
    ]);
    return storedUnread.filter((n) => has(n.type)).length + expiringSoon.length;
  }

  async markRead(id: string, callerPermissions: string[] = []) {
    if (id.startsWith(VIRTUAL_ID_PREFIX)) {
      // Notification virtuelle : rien à persister, elle disparaîtra d'elle-même une fois
      // la promotion expirée ou désactivée. On vérifie quand même la permission par
      // cohérence (pas de fuite d'information via un succès silencieux sur un id deviné).
      if (!callerPermissions.includes(PERMISSION_BY_TYPE.PROMOTION_EXPIRING)) {
        throw new ForbiddenException("Vous n'avez pas accès à cette notification.");
      }
      return { success: true };
    }
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification introuvable.');
    if (!callerPermissions.includes(PERMISSION_BY_TYPE[existing.type])) {
      // Empêche un rôle qui ne voit pas une notification de la marquer comme lue quand même —
      // ce qui, `isRead` étant un statut global (pas par utilisateur, voir schema.prisma),
      // la ferait disparaître de la cloche de TOUS les administrateurs, y compris ceux qui,
      // eux, ont le droit de la voir.
      throw new ForbiddenException("Vous n'avez pas accès à cette notification.");
    }
    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { success: true };
  }

  async markAllRead(callerPermissions: string[] = []) {
    // `isRead` étant global et non par utilisateur, "tout marquer comme lu" ne doit marquer
    // que les types que l'appelant a le droit de voir — sinon un rôle à faibles permissions
    // (l'Éditeur, par exemple) pourrait faire disparaître de la cloche, pour tous les autres
    // administrateurs, des alertes qu'il n'a lui-même pas le droit de consulter.
    const allowedTypes = (Object.keys(PERMISSION_BY_TYPE) as NotificationType[]).filter((type) =>
      callerPermissions.includes(PERMISSION_BY_TYPE[type]),
    );
    if (allowedTypes.length === 0) return { success: true };
    await this.prisma.notification.updateMany({
      where: { isRead: false, type: { in: allowedTypes } },
      data: { isRead: true },
    });
    return { success: true };
  }
}
