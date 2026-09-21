import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('PushService', () => {
  let service: PushService;
  let prisma: { pushToken: { upsert: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock } };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = { pushToken: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() } };
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    service = new PushService(prisma as unknown as PrismaService, config);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => fetchSpy.mockRestore());

  const alert = { businessId: 'biz-1', permission: 'orders:read', title: 'Nouvelle commande', body: 'Commande de Awa', link: '/espace/commandes' };

  describe('register', () => {
    it('refuse un jeton qui n’a pas la forme d’un jeton Expo', async () => {
      await expect(service.register('u1', 'biz-1', 'nimporte-quoi')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pushToken.upsert).not.toHaveBeenCalled();
    });

    it('rattache le jeton à la dernière personne connectée (un téléphone peut changer de compte)', async () => {
      await service.register('u2', 'biz-2', TOKEN_A);
      expect(prisma.pushToken.upsert).toHaveBeenCalledWith({
        where: { token: TOKEN_A },
        create: { token: TOKEN_A, userId: 'u2', businessId: 'biz-2' },
        update: { userId: 'u2', businessId: 'biz-2' },
      });
    });
  });

  describe('unregister', () => {
    it('ne supprime que les jetons de la personne connectée', async () => {
      await service.unregister('u1', TOKEN_A);
      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { token: TOKEN_A, userId: 'u1' } });
    });
  });

  describe('notifyBusiness', () => {
    it('ne cherche que les membres ACTIFS de la bonne entreprise qui ont la permission', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);
      await service.notifyBusiness(alert);
      expect(prisma.pushToken.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          user: {
            isActive: true,
            businessId: 'biz-1',
            role: { permissions: { some: { permission: { resource: 'orders', action: 'read' } } } },
          },
        },
        select: { token: true },
      });
    });

    it('n’appelle pas Expo quand personne n’a de téléphone enregistré', async () => {
      prisma.pushToken.findMany.mockResolvedValue([]);
      await service.notifyBusiness(alert);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('envoie une alerte par téléphone avec le lien à ouvrir', async () => {
      prisma.pushToken.findMany.mockResolvedValue([{ token: TOKEN_A }, { token: TOKEN_B }]);
      fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: 'ok' }, { status: 'ok' }] }) });

      await service.notifyBusiness(alert);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://exp.host/--/api/v2/push/send');
      const sent = JSON.parse(init.body);
      expect(sent.map((m: { to: string }) => m.to)).toEqual([TOKEN_A, TOKEN_B]);
      expect(sent[0]).toMatchObject({ title: 'Nouvelle commande', body: 'Commande de Awa', data: { link: '/espace/commandes' } });
      expect(prisma.pushToken.deleteMany).not.toHaveBeenCalled();
    });

    it('oublie les téléphones que Expo déclare introuvables (application désinstallée)', async () => {
      prisma.pushToken.findMany.mockResolvedValue([{ token: TOKEN_A }, { token: TOKEN_B }]);
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
      });

      await service.notifyBusiness(alert);
      expect(prisma.pushToken.deleteMany).toHaveBeenCalledWith({ where: { token: { in: [TOKEN_B] } } });
    });

    it('ne fait JAMAIS échouer l’action d’origine si Expo est injoignable', async () => {
      prisma.pushToken.findMany.mockResolvedValue([{ token: TOKEN_A }]);
      fetchSpy.mockRejectedValue(new Error('réseau coupé'));
      await expect(service.notifyBusiness(alert)).resolves.toBeUndefined();
    });

    it('ne fait pas échouer l’action si la base répond une erreur', async () => {
      prisma.pushToken.findMany.mockRejectedValue(new Error('base indisponible'));
      await expect(service.notifyBusiness(alert)).resolves.toBeUndefined();
    });
  });
});
