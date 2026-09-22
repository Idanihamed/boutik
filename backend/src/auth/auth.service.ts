import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { JwtAccessPayload, JwtRefreshPayload } from './types/authenticated-user.type';
import { ACCESS_TOKEN_COOKIE } from './cookies';
import type { Request } from 'express';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private dummyHashPromise: Promise<string> | null = null;
  /**
   * Hash bcrypt "bidon" (contre lequel aucun mot de passe ne correspondra jamais), calculé
   * une seule fois puis réutilisé. Sert à égaliser le temps de réponse de login() entre "cet
   * email n'existe pas" et "cet email existe mais le mot de passe est faux" : sans ça, un
   * email inconnu répondrait quasi instantanément (aucun bcrypt.compare exécuté) alors qu'un
   * email existant prendrait ~100 ms (coût du bcrypt), ce qui permettrait à un attaquant de
   * deviner par chronométrage quels comptes existent (énumération d'emails).
   */
  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = bcrypt.hash('mot-de-passe-bidon-jamais-utilise', 10);
    }
    return this.dummyHashPromise;
  }

  private async loadUserWithPermissions(userId: string) {
    // findUnique (pas findUniqueOrThrow) : un compte peut avoir été supprimé entre l'émission
    // d'un token et son utilisation (le refresh token cascade à la suppression du compte —
    // voir schema.prisma — mais l'access token, lui, reste valable jusqu'à son expiration
    // naturelle de 15 min). On veut un 401 propre dans ce cas, pas une 500 issue de Prisma.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: { include: { permission: true } } } }, business: true },
    });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }
    return user;
  }

  private buildAccessToken(user: Awaited<ReturnType<AuthService['loadUserWithPermissions']>>): string {
    const permissions = user.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`);
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      businessId: user.businessId,
      permissions,
    };
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const tokenId = crypto.randomUUID();
    const expiresInDays = 30;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const refreshPayload: JwtRefreshPayload = { sub: userId, tokenId };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return refreshToken;
  }

  async login(dto: LoginDto): Promise<TokenPair & { user: { id: string; name: string; email: string; role: string; businessId: string | null } }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: { include: { permissions: { include: { permission: true } } } }, business: true },
    });

    // bcrypt.compare est systématiquement exécuté, même quand l'utilisateur n'existe pas
    // (comparaison contre un hash bidon — voir getDummyHash) : voir le commentaire de
    // getDummyHash() pour la raison (protection contre l'énumération d'emails par chronométrage).
    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? (await this.getDummyHash()));

    if (!user || !user.isActive || !passwordOk) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    // Vérifié APRÈS les identifiants : on ne révèle l'état d'une entreprise qu'à quelqu'un qui
    // connaît réellement le mot de passe du compte.
    this.assertBusinessAllowsLogin(user.business);

    const accessToken = this.buildAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    // Journalisé ici plutôt que par ActivityLogInterceptor : la route de connexion est
    // publique (@Public()), donc aucun utilisateur authentifié n'est disponible côté
    // interceptor au moment de la requête (voir §28 du cahier des charges).
    await this.activityLogService.record({
      businessId: user.businessId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'LOGIN',
      resource: 'auth',
      method: 'POST',
      path: '/api/auth/login',
      description: `${user.name} s'est connecté(e).`,
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name, businessId: user.businessId },
    };
  }

  /**
   * Une entreprise refusée, suspendue ou bannie ne peut plus utiliser son back-office (voir
   * TenantInterceptor) : on l'annonce dès la connexion, avec le motif, plutôt que de laisser le
   * responsable se heurter à des erreurs 403 sur chaque écran. Une entreprise en attente de
   * validation peut se connecter pour préparer son catalogue.
   */
  private assertBusinessAllowsLogin(business: { status: string; statusReason: string | null } | null) {
    if (!business || business.status === 'ACTIVE' || business.status === 'PENDING') return;
    const labels: Record<string, string> = {
      REJECTED: "L'inscription de cette entreprise a été refusée.",
      SUSPENDED: 'Cette entreprise est suspendue.',
      BANNED: 'Cette entreprise a été bannie de la plateforme.',
    };
    const reason = business.statusReason ? ` Motif : ${business.statusReason}` : '';
    throw new ForbiddenException(`${labels[business.status] ?? 'Accès désactivé.'}${reason}`);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });
    if (!stored) {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }
    if (stored.revoked) {
      // Un refresh token déjà révoqué qui ressert (rejeu après rotation, ou après une
      // déconnexion) est le signal classique d'un vol de token (rotation avec détection de
      // réutilisation — pratique recommandée pour les refresh tokens). Par précaution, on
      // révoque immédiatement TOUTES les sessions actives de cet utilisateur plutôt que de se
      // contenter de rejeter cette seule requête : si un attaquant a bien volé un ancien
      // refresh token, sa propre session (et celle du légitime détenteur du token volé) sont
      // coupées, forçant une reconnexion partout.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }
    if (stored.tokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    // Rotation : on révoque l'ancien refresh token et on en émet un nouveau.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const user = await this.loadUserWithPermissions(payload.sub);
    // CRITIQUE : sans cette vérification, désactiver un compte (§26, UsersService.update)
    // n'empêchait pas ce compte de continuer à renouveler indéfiniment son access token tant
    // qu'il détenait un refresh token valide (jusqu'à 30 jours) — seul login() vérifiait
    // isActive, pas refresh(). Un compte désactivé doit perdre l'accès immédiatement.
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé.');
    }
    this.assertBusinessAllowsLogin(user.business);

    const accessToken = this.buildAccessToken(user);
    const newRefreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.tokenId },
        data: { revoked: true },
      });
    } catch {
      // Token déjà invalide ou expiré : rien à faire, la déconnexion est idempotente.
    }
  }

  /**
   * Compte connecté au moment d'une requête PUBLIQUE (ex. passer une commande), sans jamais
   * exiger de session : un jeton absent, expiré ou invalide renvoie simplement `null` plutôt
   * que de faire échouer l'action. Utilisé pour rattacher une commande à son auteur quand il
   * est connecté, sans transformer le passage de commande en route protégée.
   */
  tryGetCurrentUser(req: Request): { id: string; role: string } | null {
    const token =
      req.cookies?.[ACCESS_TOKEN_COOKIE] ??
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<JwtAccessPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      return { id: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  async me(userId: string) {
    const user = await this.loadUserWithPermissions(userId);
    // Ceinture et bretelles : l'access token reste valable jusqu'à son expiration naturelle
    // (15 min par défaut) même après désactivation du compte (voir refresh(), qui bloque le
    // renouvellement) — autant que cette route reflète l'état réel dès qu'elle touche la base.
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé.');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      businessId: user.businessId,
      business: user.business
        ? {
            id: user.business.id,
            name: user.business.name,
            slug: user.business.slug,
            status: user.business.status,
            country: user.business.country,
            currency: user.business.currency,
          }
        : null,
      permissions: user.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`),
    };
  }

  /** Inscription libre d'un client (compte de la plateforme, sans entreprise). */
  async registerCustomer(dto: RegisterCustomerDto): Promise<{ id: string; name: string; email: string }> {
    await this.assertEmailAvailable(dto.email);
    const role = await this.prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if (!role) {
      throw new BadRequestException("Inscription indisponible : le rôle CUSTOMER n'existe pas (seed non exécuté).");
    }
    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, roleId: role.id },
    });
    return { id: user.id, name: user.name, email: user.email };
  }

  /**
   * Libre-service (§26) : contrairement à UsersService.update (réservé aux comptes disposant
   * de `users:update`, donc au Super Admin), N'IMPORTE QUEL compte connecté peut changer son
   * propre mot de passe ici — aucune permission requise puisqu'on n'agit que sur soi-même
   * (userId vient du token de la session en cours, jamais d'un paramètre choisi par l'appelant).
   */
  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) {
      throw new BadRequestException('Mot de passe actuel incorrect.');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Même raison que UsersService.update() : un mot de passe qu'on vient de changer doit
    // invalider tout refresh token émis avec l'ancien, pas seulement l'access token en cours.
    await this.prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
  }

  /** Utilisé par le module Utilisateurs pour créer un nouvel administrateur. */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }
  }
}
