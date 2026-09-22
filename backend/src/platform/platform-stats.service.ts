import { Injectable } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALL_STATUSES: BusinessStatus[] = ['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'BANNED'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Vue d'ensemble de la plateforme pour son administrateur (§ pilotage) : combien d'entreprises,
 * de commandes, de produits, et lesquelles sont les plus actives. Requêtes délibérément HORS
 * contexte d'entreprise (le PrismaService normal, jamais celui isolé par tenant) : c'est
 * justement le seul endroit du produit qui doit voir TOUTES les entreprises à la fois.
 */
@Injectable()
export class PlatformStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const now = new Date();
    const since7d = new Date(now.getTime() - 7 * DAY_MS);
    const since30d = new Date(now.getTime() - 30 * DAY_MS);

    const [
      byStatusRaw,
      newBusinesses7d,
      newBusinesses30d,
      ordersTotal,
      orders7d,
      orders30d,
      productsTotal,
      productsPublished,
      openReports,
      topBusinessesRaw,
    ] = await Promise.all([
      this.prisma.business.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.business.count({ where: { createdAt: { gte: since7d } } }),
      this.prisma.business.count({ where: { createdAt: { gte: since30d } } }),
      this.prisma.order.count({ where: { status: { not: 'ANNULEE' } } }),
      this.prisma.order.count({ where: { status: { not: 'ANNULEE' }, createdAt: { gte: since7d } } }),
      this.prisma.order.count({ where: { status: { not: 'ANNULEE' }, createdAt: { gte: since30d } } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.businessReport.count({ where: { status: 'OPEN' } }),
      // Classement par NOMBRE de commandes, jamais par montant : chaque entreprise a sa propre
      // devise, additionner des montants dans des devises différentes n'aurait aucun sens.
      this.prisma.order.groupBy({
        by: ['businessId'],
        where: { status: { not: 'ANNULEE' }, createdAt: { gte: since30d } },
        _count: { _all: true },
        orderBy: { _count: { businessId: 'desc' } },
        take: 5,
      }),
    ]);

    const byStatus = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<BusinessStatus, number>;
    for (const row of byStatusRaw) byStatus[row.status] = row._count._all;

    const topBusinessDetails = await this.prisma.business.findMany({
      where: { id: { in: topBusinessesRaw.map((row) => row.businessId) } },
      select: { id: true, name: true, slug: true },
    });
    const businessById = new Map(topBusinessDetails.map((b) => [b.id, b]));
    const topBusinesses = topBusinessesRaw
      .map((row) => {
        const business = businessById.get(row.businessId);
        return business ? { name: business.name, slug: business.slug, orderCount: row._count._all } : null;
      })
      .filter((row): row is { name: string; slug: string; orderCount: number } => row !== null);

    return {
      businesses: {
        total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
        byStatus,
        newLast7Days: newBusinesses7d,
        newLast30Days: newBusinesses30d,
      },
      orders: { total: ordersTotal, last7Days: orders7d, last30Days: orders30d },
      products: { total: productsTotal, published: productsPublished },
      reports: { open: openReports },
      topBusinessesLast30Days: topBusinesses,
    };
  }
}
