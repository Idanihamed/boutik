import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OWNER_ROLE } from '../common/roles';
import { escapeHtml } from '../common/utils/escape-html.util';
import { QueryPlatformBusinessesDto } from './dto/platform.dto';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export type ModerationAction = 'approve' | 'reject' | 'suspend' | 'ban' | 'reactivate';

interface Transition {
  from: BusinessStatus[];
  to: BusinessStatus;
  requiresReason: boolean;
  event: string;
  emailSubject: (name: string) => string;
  emailLead: (name: string) => string;
}

// Machine à états de la modération : seules ces transitions existent, pour qu'une décision
// incohérente (ex. valider une entreprise bannie sans passer par la réactivation) soit refusée.
const TRANSITIONS: Record<ModerationAction, Transition> = {
  approve: {
    from: ['PENDING', 'REJECTED'],
    to: 'ACTIVE',
    requiresReason: false,
    event: 'APPROVED',
    emailSubject: (n) => `Votre entreprise « ${n} » est validée`,
    emailLead: (n) => `Bonne nouvelle : votre entreprise <strong>${n}</strong> a été validée. Sa vitrine est désormais visible.`,
  },
  reject: {
    from: ['PENDING'],
    to: 'REJECTED',
    requiresReason: true,
    event: 'REJECTED',
    emailSubject: (n) => `Votre inscription « ${n} » a été refusée`,
    emailLead: (n) => `Votre inscription pour l'entreprise <strong>${n}</strong> a été refusée.`,
  },
  suspend: {
    from: ['ACTIVE'],
    to: 'SUSPENDED',
    requiresReason: true,
    event: 'SUSPENDED',
    emailSubject: (n) => `Votre entreprise « ${n} » est suspendue`,
    emailLead: (n) => `Votre entreprise <strong>${n}</strong> a été suspendue et sa vitrine est masquée.`,
  },
  ban: {
    from: ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'],
    to: 'BANNED',
    requiresReason: true,
    event: 'BANNED',
    emailSubject: (n) => `Votre entreprise « ${n} » a été bannie`,
    emailLead: (n) => `Votre entreprise <strong>${n}</strong> a été retirée définitivement de la plateforme.`,
  },
  reactivate: {
    from: ['SUSPENDED', 'BANNED'],
    to: 'ACTIVE',
    requiresReason: false,
    event: 'REACTIVATED',
    emailSubject: (n) => `Votre entreprise « ${n} » est réactivée`,
    emailLead: (n) => `Votre entreprise <strong>${n}</strong> a été réactivée. Sa vitrine est de nouveau visible.`,
  },
};

// Statuts qui coupent l'accès au back-office : les sessions ouvertes sont révoquées tout de suite.
const SESSION_REVOKING_STATUSES = new Set<BusinessStatus>(['REJECTED', 'SUSPENDED', 'BANNED']);

// Durée de l'essai gratuit et de chaque période payée : 30 jours (voir §modèle économique du
// projet). Un seul palier pour l'instant, pas de grille tarifaire — voir SUBSCRIPTION_PRICE.
const SUBSCRIPTION_PERIOD_DAYS = 30;

/** Acteur d'une décision de modération : un administrateur réel, ou le système (voir SubscriptionBillingService). */
export interface ModerationActor {
  id: string | null;
  name: string;
}

/** Espace de modération réservé à l'administrateur de la plateforme. */
@Injectable()
export class PlatformBusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /** Échéance actuelle de l'abonnement : la dernière période payée, sinon la fin de l'essai. */
  static dueDate(business: { trialEndsAt: Date | null; subscriptionPaidUntil: Date | null }): Date | null {
    return business.subscriptionPaidUntil ?? business.trialEndsAt;
  }

  async list(query: QueryPlatformBusinessesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.BusinessWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          country: true,
          currency: true,
          status: true,
          statusReason: true,
          createdAt: true,
          trialEndsAt: true,
          subscriptionPaidUntil: true,
          _count: { select: { reports: { where: { status: 'OPEN' } } } },
        },
      }),
      this.prisma.business.count({ where }),
    ]);

    return {
      data: items.map(({ _count, ...business }) => ({ ...business, openReports: _count.reports })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, isActive: true, role: { select: { name: true } } } },
        moderationLog: { orderBy: { createdAt: 'desc' }, take: 50 },
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { reporter: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!business) throw new NotFoundException('Entreprise introuvable.');
    return business;
  }

  async moderate(id: string, action: ModerationAction, reason: string | undefined, actor: ModerationActor) {
    const transition = TRANSITIONS[action];
    const cleanReason = reason?.trim() || undefined;

    if (transition.requiresReason && !cleanReason) {
      throw new BadRequestException('Un motif est obligatoire pour cette décision.');
    }

    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Entreprise introuvable.');
    if (!transition.from.includes(business.status)) {
      throw new ConflictException(`Cette décision est impossible : l'entreprise est actuellement « ${business.status} ».`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.business.update({
        where: { id },
        data: {
          status: transition.to,
          statusReason: cleanReason ?? null,
          statusChangedAt: new Date(),
          // Première validation : point de départ de l'essai gratuit de 30 jours.
          ...(action === 'approve' && !business.trialEndsAt
            ? { trialEndsAt: addDays(new Date(), SUBSCRIPTION_PERIOD_DAYS) }
            : {}),
        },
      });
      await tx.businessModerationEvent.create({
        data: { businessId: id, actorId: actor.id, actorName: actor.name, action: transition.event, reason: cleanReason ?? null },
      });
      if (SESSION_REVOKING_STATUSES.has(transition.to)) {
        await tx.refreshToken.updateMany({ where: { user: { businessId: id }, revoked: false }, data: { revoked: true } });
      }
      if (transition.to === 'BANNED') {
        // Les signalements en cours ont abouti à une décision : ils passent à « traités ».
        await tx.businessReport.updateMany({ where: { businessId: id, status: 'OPEN' }, data: { status: 'ACTIONED' } });
      }
      return result;
    });

    await this.notifyOwners(id, updated.name, transition, cleanReason);
    return { id: updated.id, name: updated.name, slug: updated.slug, status: updated.status, statusReason: updated.statusReason };
  }

  /**
   * Enregistre un paiement d'abonnement (transfert Mobile Money reçu et vérifié manuellement par
   * la plateforme — voir §modèle économique du projet, pas de prestataire de paiement intégré).
   * Étend l'échéance de 30 jours à partir de l'échéance actuelle si elle n'est pas encore
   * dépassée (renouvellement en avance, rien n'est perdu), sinon à partir d'aujourd'hui
   * (renouvellement en retard, on ne fait pas payer le retard). N'agit jamais sur `status` : si
   * l'entreprise avait été suspendue (faute de paiement ou pour une autre raison), l'administrateur
   * doit encore la réactiver explicitement (action séparée) — un paiement ne doit pas lever
   * silencieusement une suspension décidée pour un motif de modération.
   */
  async markPaid(id: string, actor: ModerationActor) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Entreprise introuvable.');

    const now = new Date();
    const currentDue = PlatformBusinessesService.dueDate(business);
    const base = currentDue && currentDue > now ? currentDue : now;
    const newDue = addDays(base, SUBSCRIPTION_PERIOD_DAYS);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.business.update({
        where: { id },
        data: { subscriptionPaidUntil: newDue, renewalReminderSentAt: null },
      });
      await tx.businessModerationEvent.create({
        data: {
          businessId: id,
          actorId: actor.id,
          actorName: actor.name,
          action: 'SUBSCRIPTION_PAID',
          reason: `Abonnement payé jusqu'au ${newDue.toLocaleDateString('fr-FR')}.`,
        },
      });
      return result;
    });

    const owners = await this.prisma.user.findMany({
      where: { businessId: id, role: { name: OWNER_ROLE } },
      select: { email: true },
    });
    for (const owner of owners) {
      await this.mailService.send({
        to: owner.email,
        subject: `Paiement enregistré pour « ${business.name} »`,
        html: `<p>Votre paiement a bien été enregistré. Votre abonnement est valable jusqu'au <strong>${newDue.toLocaleDateString('fr-FR')}</strong>.</p>`,
      });
    }

    return {
      id: updated.id,
      name: updated.name,
      trialEndsAt: updated.trialEndsAt,
      subscriptionPaidUntil: updated.subscriptionPaidUntil,
    };
  }

  /** Informe les Responsables de la décision (no-op tant que l'envoi d'email n'est pas configuré). */
  private async notifyOwners(businessId: string, name: string, transition: Transition, reason?: string) {
    const owners = await this.prisma.user.findMany({
      where: { businessId, role: { name: OWNER_ROLE } },
      select: { email: true },
    });
    const reasonHtml = reason ? `<p>Motif : ${escapeHtml(reason)}</p>` : '';
    for (const owner of owners) {
      await this.mailService.send({
        to: owner.email,
        subject: transition.emailSubject(name),
        html: `<p>${transition.emailLead(escapeHtml(name))}</p>${reasonHtml}`,
      });
    }
  }
}
