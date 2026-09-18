import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const BUSINESS_ID = 'business-1';

function caller(role: string, businessId: string | null = BUSINESS_ID): AuthenticatedUser {
  return { id: 'caller-1', email: 'caller@example.com', name: 'Appelant', role, businessId, permissions: [] };
}

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    name: 'Compte',
    email: 'compte@example.com',
    isActive: true,
    role: { name: 'OWNER' },
    ...overrides,
  };
}

describe('UsersService (personnel d’une entreprise)', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findFirstOrThrow: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    role: { findUnique: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };
  let authService: { assertEmailAvailable: jest.Mock; hashPassword: jest.Mock };

  // `findFirst` sert à la fois à retrouver le compte visé (where.id) et à détecter un email déjà
  // pris (where.email) : on répond selon la question posée.
  function mockAccounts(target: ReturnType<typeof buildUser> | null, emailOwner: { id: string } | null = null) {
    prisma.user.findFirst.mockImplementation(async ({ where }: { where: { email?: string } }) =>
      where.email ? emailOwner : target,
    );
    prisma.user.findFirstOrThrow.mockResolvedValue(target ?? buildUser());
  }

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findFirstOrThrow: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-1', name: 'EDITEUR' }) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    authService = {
      assertEmailAvailable: jest.fn().mockResolvedValue(undefined),
      hashPassword: jest.fn().mockResolvedValue('hashed'),
    };
    service = new UsersService(prisma as unknown as PrismaService, authService as unknown as AuthService);
  });

  describe('isolation par entreprise', () => {
    it('refuse tout compte qui n’est rattaché à aucune entreprise (plateforme, client)', async () => {
      await expect(service.findAll(caller('PLATFORM_ADMIN', null))).rejects.toThrow(ForbiddenException);
      await expect(service.remove('user-1', caller('CUSTOMER', null))).rejects.toThrow(ForbiddenException);
    });

    it('ne liste que le personnel de l’entreprise de l’appelant', async () => {
      await service.findAll(caller('OWNER'));
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: BUSINESS_ID } }));
    });

    it('rattache toujours le nouveau compte à l’entreprise de l’appelant', async () => {
      prisma.user.create.mockResolvedValue(buildUser({ role: { name: 'EDITEUR' } }));
      await service.create({ name: 'X', email: 'x@example.com', password: '1234567890', roleName: 'EDITEUR' }, caller('OWNER'));
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ businessId: BUSINESS_ID }) }),
      );
    });

    it('ne trouve pas un compte d’une autre entreprise (modification et suppression)', async () => {
      mockAccounts(null);
      await expect(service.update('autre-user', { name: 'Piraté' }, caller('OWNER'))).rejects.toThrow(NotFoundException);
      await expect(service.remove('autre-user', caller('OWNER'))).rejects.toThrow(NotFoundException);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    });

    it('filtre la suppression et la mise à jour par entreprise, même après vérification', async () => {
      mockAccounts(buildUser({ role: { name: 'EDITEUR' } }));
      await service.update('user-1', { name: 'Nouveau' }, caller('OWNER'));
      expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'user-1', businessId: BUSINESS_ID }, data: { name: 'Nouveau' } });

      await service.remove('user-1', caller('OWNER'));
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'user-1', businessId: BUSINESS_ID } });
    });
  });

  describe('create — escalade de privilèges', () => {
    it('refuse qu’un non-Responsable nomme un Responsable', async () => {
      await expect(
        service.create({ name: 'X', email: 'x@example.com', password: '1234567890', roleName: 'OWNER' }, caller('GESTIONNAIRE')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorise un Responsable à nommer un autre Responsable', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-owner', name: 'OWNER' });
      prisma.user.create.mockResolvedValue(buildUser());
      await expect(
        service.create({ name: 'X', email: 'x@example.com', password: '1234567890', roleName: 'OWNER' }, caller('OWNER')),
      ).resolves.toBeDefined();
    });

    it('refuse d’attribuer un rôle de la plateforme ou de client au personnel', async () => {
      for (const roleName of ['PLATFORM_ADMIN', 'CUSTOMER', 'INCONNU']) {
        await expect(
          service.create({ name: 'X', email: 'x@example.com', password: '1234567890', roleName }, caller('OWNER')),
        ).rejects.toThrow(ForbiddenException);
      }
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('autorise un Gestionnaire à créer un compte Éditeur', async () => {
      prisma.user.create.mockResolvedValue(buildUser({ role: { name: 'EDITEUR' } }));
      await expect(
        service.create({ name: 'X', email: 'x@example.com', password: '1234567890', roleName: 'EDITEUR' }, caller('GESTIONNAIRE')),
      ).resolves.toBeDefined();
    });

    it('propage le conflit d’email déjà pris', async () => {
      authService.assertEmailAvailable.mockRejectedValue(new ConflictException());
      await expect(
        service.create({ name: 'X', email: 'x@example.com', password: '1234567890', roleName: 'EDITEUR' }, caller('OWNER')),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update — verrou du dernier Responsable actif', () => {
    it('refuse de désactiver le dernier Responsable actif', async () => {
      mockAccounts(buildUser());
      prisma.user.count.mockResolvedValue(0); // aucun AUTRE Responsable actif
      await expect(service.update('user-1', { isActive: false }, caller('OWNER'))).rejects.toThrow(ForbiddenException);
    });

    it('autorise la désactivation s’il reste un autre Responsable actif', async () => {
      mockAccounts(buildUser());
      prisma.user.count.mockResolvedValue(1);
      await expect(service.update('user-1', { isActive: false }, caller('OWNER'))).resolves.toBeDefined();
    });

    it('refuse de rétrograder le dernier Responsable actif vers un autre rôle', async () => {
      mockAccounts(buildUser());
      prisma.user.count.mockResolvedValue(0);
      await expect(service.update('user-1', { roleName: 'EDITEUR' }, caller('OWNER'))).rejects.toThrow(ForbiddenException);
    });

    it('refuse qu’un non-Responsable élève un compte existant au rôle Responsable', async () => {
      mockAccounts(buildUser({ role: { name: 'EDITEUR' } }));
      await expect(service.update('user-1', { roleName: 'OWNER' }, caller('GESTIONNAIRE'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('révoque les sessions actives après un changement de mot de passe', async () => {
      mockAccounts(buildUser({ role: { name: 'EDITEUR' } }));
      await service.update('user-1', { password: 'nouveauMotDePasse1' }, caller('OWNER'));
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      });
    });

    it('signale un conflit si le nouvel email appartient déjà à un autre compte', async () => {
      mockAccounts(buildUser({ role: { name: 'EDITEUR' } }), { id: 'autre-compte' });
      await expect(service.update('user-1', { email: 'pris@example.com' }, caller('OWNER'))).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove — verrou du dernier Responsable actif', () => {
    it('refuse de supprimer le dernier Responsable actif', async () => {
      mockAccounts(buildUser());
      prisma.user.count.mockResolvedValue(0);
      await expect(service.remove('user-1', caller('OWNER'))).rejects.toThrow(ForbiddenException);
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    });

    it('autorise la suppression d’un compte qui n’est pas Responsable', async () => {
      mockAccounts(buildUser({ role: { name: 'EDITEUR' } }));
      await expect(service.remove('user-1', caller('OWNER'))).resolves.toEqual({ success: true });
    });
  });
});
