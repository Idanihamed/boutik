import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

jest.mock('bcrypt');

const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '30d',
};

function buildConfig(): ConfigService {
  return { get: (key: string, fallback?: string) => SECRETS[key] ?? fallback } as unknown as ConfigService;
}

function buildRole(overrides: Partial<{ name: string; permissions: string[] }> = {}) {
  const permissions = overrides.permissions ?? ['products:read'];
  return {
    name: overrides.name ?? 'ADMIN',
    permissions: permissions.map((p) => {
      const [resource, action] = p.split(':');
      return { permission: { resource, action } };
    }),
  };
}

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    passwordHash: 'hashed-password',
    isActive: true,
    role: buildRole(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let activityLogService: { record: jest.Mock };
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    activityLogService = { record: jest.fn().mockResolvedValue(undefined) };
    jwtService = new JwtService({});
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService,
      buildConfig(),
      activityLogService as unknown as ActivityLogService,
    );
    jest.clearAllMocks();
    activityLogService.record.mockResolvedValue(undefined);
  });

  describe('login', () => {
    it('rejette un email inexistant sans révéler qu il n existe pas', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'inconnu@example.com', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
      // bcrypt.compare doit quand même avoir été appelé (contre le hash bidon) pour égaliser
      // le temps de réponse entre email inconnu et mauvais mot de passe (protection anti-énumération).
      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('rejette un mauvais mot de passe', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'admin@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejette un compte désactivé même avec le bon mot de passe', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login({ email: 'admin@example.com', password: 'good' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('retourne un access token, un refresh token et le user en cas de succès', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'admin@example.com', password: 'good' });

      expect(result.user).toEqual({ id: 'user-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' });
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');

      const payload = jwtService.decode(result.accessToken) as Record<string, unknown>;
      expect(payload.sub).toBe('user-1');
      expect(payload.permissions).toEqual(['products:read']);

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(activityLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN', userId: 'user-1' }),
      );
    });
  });

  describe('refresh', () => {
    function issueRefreshToken(userId: string, tokenId: string) {
      return jwtService.sign(
        { sub: userId, tokenId },
        { secret: SECRETS.JWT_REFRESH_SECRET, expiresIn: SECRETS.JWT_REFRESH_EXPIRES_IN },
      );
    }

    it('rejette un token dont la signature est invalide', async () => {
      await expect(service.refresh('token-invalide')).rejects.toThrow(UnauthorizedException);
    });

    it('rejette un token dont l id ne correspond à aucune ligne en base', async () => {
      const token = issueRefreshToken('user-1', 'token-1');
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
    });

    it('rejette un token expiré (côté base, indépendamment de l expiration JWT)', async () => {
      const token = issueRefreshToken('user-1', 'token-1');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 1000),
        tokenHash: require('crypto').createHash('sha256').update(token).digest('hex'),
      });

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
    });

    it('révoque TOUTES les sessions de l utilisateur si un token déjà révoqué ressert (détection de vol)', async () => {
      const token = issueRefreshToken('user-1', 'token-1');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 1000_000),
        tokenHash: require('crypto').createHash('sha256').update(token).digest('hex'),
      });

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      });
    });

    it('rejette un compte désactivé entre-temps, même avec un refresh token valide', async () => {
      const token = issueRefreshToken('user-1', 'token-1');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 1000_000),
        tokenHash: require('crypto').createHash('sha256').update(token).digest('hex'),
      });
      prisma.user.findUnique.mockResolvedValue(buildUser({ isActive: false }));

      await expect(service.refresh(token)).rejects.toThrow(UnauthorizedException);
    });

    it('effectue la rotation : révoque l ancien token et en émet un nouveau', async () => {
      const token = issueRefreshToken('user-1', 'token-1');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 1000_000),
        tokenHash: require('crypto').createHash('sha256').update(token).digest('hex'),
      });
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(token);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({ where: { id: 'token-1' }, data: { revoked: true } });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.refreshToken).not.toBe(token);
      expect(typeof result.accessToken).toBe('string');
    });
  });

  describe('logout', () => {
    it('révoque le refresh token fourni', async () => {
      const token = jwtService.sign(
        { sub: 'user-1', tokenId: 'token-1' },
        { secret: SECRETS.JWT_REFRESH_SECRET },
      );
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(token);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { revoked: true },
      });
    });

    it('est idempotent (ne lève pas) sur un token déjà invalide', async () => {
      await expect(service.logout('token-invalide')).resolves.toBeUndefined();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('changeOwnPassword', () => {
    it('rejette un mot de passe actuel incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changeOwnPassword('user-1', 'mauvais', 'nouveauMotDePasse1')).rejects.toThrow(
        'Mot de passe actuel incorrect.',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('change le mot de passe et révoque les sessions actives quand le mot de passe actuel est correct', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('nouveau-hash');
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.changeOwnPassword('user-1', 'ancien-bon-mdp', 'nouveauMotDePasse1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'nouveau-hash' },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      });
    });
  });

  describe('assertEmailAvailable', () => {
    it('lève ConflictException si l email est déjà pris', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      await expect(service.assertEmailAvailable('admin@example.com')).rejects.toThrow(ConflictException);
    });

    it('ne lève rien si l email est disponible', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.assertEmailAvailable('libre@example.com')).resolves.toBeUndefined();
    });
  });
});
