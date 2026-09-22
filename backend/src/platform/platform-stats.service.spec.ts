import { PlatformStatsService } from './platform-stats.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlatformStatsService', () => {
  let service: PlatformStatsService;
  let prisma: {
    business: { groupBy: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    order: { count: jest.Mock; groupBy: jest.Mock };
    product: { count: jest.Mock };
    businessReport: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      business: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'ACTIVE', _count: { _all: 3 } },
          { status: 'PENDING', _count: { _all: 2 } },
        ]),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      product: { count: jest.fn().mockResolvedValue(0) },
      businessReport: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new PlatformStatsService(prisma as unknown as PrismaService);
  });

  it('remplit les statuts absents du résultat à zéro (une plateforme sans banni n’en oublie pas la colonne)', async () => {
    const res = await service.get();
    expect(res.businesses.byStatus).toEqual({ ACTIVE: 3, PENDING: 2, REJECTED: 0, SUSPENDED: 0, BANNED: 0 });
    expect(res.businesses.total).toBe(5);
  });

  it('exclut les commandes annulées du décompte', async () => {
    await service.get();
    for (const call of prisma.order.count.mock.calls) {
      expect(call[0].where.status).toEqual({ not: 'ANNULEE' });
    }
    expect(prisma.order.groupBy.mock.calls[0][0].where.status).toEqual({ not: 'ANNULEE' });
  });

  it('classe le top des entreprises par NOMBRE de commandes (jamais par montant, à cause des devises)', async () => {
    prisma.order.groupBy.mockResolvedValue([
      { businessId: 'biz-1', _count: { _all: 12 } },
      { businessId: 'biz-2', _count: { _all: 5 } },
    ]);
    prisma.business.findMany.mockResolvedValue([
      { id: 'biz-1', name: 'Chez Awa', slug: 'chez-awa' },
      { id: 'biz-2', name: 'Atelier Diallo', slug: 'atelier-diallo' },
    ]);
    const res = await service.get();
    expect(res.topBusinessesLast30Days).toEqual([
      { name: 'Chez Awa', slug: 'chez-awa', orderCount: 12 },
      { name: 'Atelier Diallo', slug: 'atelier-diallo', orderCount: 5 },
    ]);
  });

  it('ignore une entreprise du classement si elle a été supprimée entre-temps', async () => {
    prisma.order.groupBy.mockResolvedValue([{ businessId: 'biz-supprimee', _count: { _all: 7 } }]);
    prisma.business.findMany.mockResolvedValue([]); // plus retrouvée
    const res = await service.get();
    expect(res.topBusinessesLast30Days).toEqual([]);
  });

  it('n’a pas besoin de contexte d’entreprise (utilise le Prisma non isolé)', async () => {
    // Si ce test s'exécutait avec le client isolé par tenant, il lèverait une ForbiddenException
    // faute de businessId dans l'AsyncLocalStorage (voir tenancy/tenant-prisma.ts).
    await expect(service.get()).resolves.toBeDefined();
  });
});
