import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

export interface RecordActivityInput {
  // null : action de la plateforme elle-même (modération) ; sinon, l'entreprise concernée.
  businessId?: string | null;
  userId?: string | null;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  method: string;
  path: string;
  description: string;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une entrée du journal (§28). Ne doit JAMAIS faire échouer la requête qui
   * vient de réussir : une erreur d'écriture du journal est avalée et journalisée côté
   * serveur uniquement (voir ActivityLogInterceptor, qui appelle cette méthode après coup).
   */
  async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          businessId: input.businessId ?? null,
          userId: input.userId ?? null,
          userName: input.userName,
          userEmail: input.userEmail,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          method: input.method,
          path: input.path,
          description: input.description,
        },
      });
    } catch (err) {
      this.logger.error(`Échec de l'écriture du journal d'activité : ${(err as Error).message}`);
    }
  }

  /**
   * `businessId` vient du compte connecté (jamais de la requête) : chaque entreprise ne lit que
   * son propre journal ; `null` (compte de la plateforme) lit uniquement les actions de la
   * plateforme.
   */
  async findAll(query: QueryActivityLogDto, businessId: string | null) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ActivityLogWhereInput = {
      businessId,
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
