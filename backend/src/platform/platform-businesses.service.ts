import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OWNER_ROLE } from '../common/roles';
import { escapeHtml } from '../common/utils/escape-html.util';
import { QueryPlatformBusinessesDto } from './dto/platform.dto';

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

/** Espace de modération réservé à l'administrateur de la plateforme. */
@Injectable()
export class PlatformBusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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

  async moderate(id: string, action: ModerationAction, reason: string | undefined, actor: AuthenticatedUser) {
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
        data: { status: transition.to, statusReason: cleanReason ?? null, statusChangedAt: new Date() },
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
