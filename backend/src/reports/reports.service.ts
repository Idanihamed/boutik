import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { escapeHtml } from '../common/utils/escape-html.util';
import { QueryPlatformReportsDto } from '../platform/dto/platform.dto';
import { ReportBusinessDto } from './dto/report-business.dto';

// Au-delà de cette limite, un même compte ne peut plus signaler pendant 24 h : freine un compte
// qui chercherait à noyer la modération ou à s'acharner sur des concurrents.
const MAX_REPORTS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Nombre de signalements ouverts à partir duquel l'administrateur est alerté (par défaut 3). */
  private get alertThreshold(): number {
    return Number(this.config.get<string>('REPORT_ALERT_THRESHOLD', '3')) || 3;
  }

  /**
   * Signalement d'une entreprise par un compte connecté (client ou autre entreprise). Ne suspend
   * JAMAIS automatiquement : plusieurs signalements alertent l'administrateur, qui décide. Sans
   * cela, des comptes complices pourraient faire disparaître une entreprise honnête.
   */
  async report(slug: string, reporter: AuthenticatedUser, dto: ReportBusinessDto) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business || business.status !== 'ACTIVE') {
      throw new NotFoundException('Entreprise introuvable.');
    }
    if (reporter.businessId === business.id) {
      throw new ForbiddenException('Vous ne pouvez pas signaler votre propre entreprise.');
    }

    const recent = await this.prisma.businessReport.count({
      where: { reporterId: reporter.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (recent >= MAX_REPORTS_PER_DAY) {
      throw new HttpException(
        'Trop de signalements envoyés aujourd’hui. Merci de réessayer demain.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      await this.prisma.businessReport.create({
        data: { businessId: business.id, reporterId: reporter.id, reason: dto.reason, comment: dto.comment },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Vous avez déjà signalé cette entreprise.');
      }
      throw error;
    }

    const openCount = await this.prisma.businessReport.count({ where: { businessId: business.id, status: 'OPEN' } });
    const alertEmail = this.config.get<string>('PLATFORM_ALERT_EMAIL');
    // Une seule alerte, au moment précis où le seuil est atteint (pas à chaque signalement suivant).
    if (alertEmail && openCount === this.alertThreshold) {
      await this.mailService.send({
        to: alertEmail,
        subject: `Entreprise signalée ${openCount} fois : ${business.name}`,
        html: `<p>L'entreprise <strong>${escapeHtml(business.name)}</strong> (${business.slug}) a reçu ${openCount} signalements ouverts. Merci de l'examiner.</p>`,
      });
    }

    return { success: true };
  }

  // ---------- Plateforme ----------

  async list(query: QueryPlatformReportsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.BusinessReportWhereInput = {
      ...(query.status ? { status: query.status as ReportStatus } : {}),
      ...(query.businessId ? { businessId: query.businessId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.businessReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          business: { select: { id: true, name: true, slug: true, status: true } },
          reporter: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.businessReport.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Entreprises ayant au moins `minReports` signalements ouverts, les plus signalées d'abord. */
  async flagged(minReports = this.alertThreshold) {
    const groups = await this.prisma.businessReport.groupBy({
      by: ['businessId'],
      where: { status: 'OPEN' },
      _count: { _all: true },
      having: { businessId: { _count: { gte: minReports } } },
      orderBy: { _count: { businessId: 'desc' } },
    });
    if (groups.length === 0) return [];

    const businesses = await this.prisma.business.findMany({
      where: { id: { in: groups.map((g) => g.businessId) } },
      select: { id: true, name: true, slug: true, status: true },
    });
    const byId = new Map(businesses.map((b) => [b.id, b]));
    return groups.flatMap((g) => {
      const business = byId.get(g.businessId);
      return business ? [{ ...business, openReports: g._count._all }] : [];
    });
  }

  async setStatus(id: string, status: 'DISMISSED' | 'ACTIONED') {
    const existing = await this.prisma.businessReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Signalement introuvable.');
    return this.prisma.businessReport.update({ where: { id }, data: { status } });
  }
}
