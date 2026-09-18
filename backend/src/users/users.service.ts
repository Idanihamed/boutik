import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OWNER_ROLE, STAFF_ROLES } from '../common/roles';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Gestion du personnel d'UNE entreprise par son responsable. L'entreprise vient toujours du
 * compte connecté (`caller.businessId`), jamais d'un paramètre de la requête : chaque requête
 * ci-dessous filtre explicitement par elle, ce qui rend impossible de lire ou modifier le
 * personnel d'une autre entreprise. (User n'est pas dans l'extension Prisma d'isolation car les
 * comptes de la plateforme et les clients n'appartiennent à aucune entreprise.)
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  private businessIdOf(caller: AuthenticatedUser): string {
    if (!caller.businessId) {
      throw new ForbiddenException("Ce compte n'est rattaché à aucune entreprise.");
    }
    return caller.businessId;
  }

  /**
   * Seuls les rôles du personnel sont attribuables (jamais PLATFORM_ADMIN ni CUSTOMER), et seul un
   * Responsable peut en nommer un autre : un rôle intermédiaire disposant de `users:update` ne
   * doit pas pouvoir s'accorder ni accorder à un tiers le rôle Responsable.
   */
  private assertCanAssignRole(targetRoleName: string, callerRoleName: string) {
    if (!(STAFF_ROLES as readonly string[]).includes(targetRoleName)) {
      throw new ForbiddenException(`Le rôle « ${targetRoleName} » ne peut pas être attribué au personnel.`);
    }
    if (targetRoleName === OWNER_ROLE && callerRoleName !== OWNER_ROLE) {
      throw new ForbiddenException('Seul un Responsable peut accorder le rôle Responsable à un compte.');
    }
  }

  /**
   * Empêche qu'une entreprise se retrouve sans aucun Responsable actif (verrou impossible à lever
   * soi-même) : ni désactiver, ni rétrograder, ni supprimer le dernier Responsable actif.
   */
  private async assertNotLastActiveOwner(businessId: string, userId: string, action: 'désactiver' | 'rétrograder' | 'supprimer') {
    const user = await this.prisma.user.findFirst({ where: { id: userId, businessId }, include: { role: true } });
    if (!user || user.role.name !== OWNER_ROLE || !user.isActive) return;

    const otherActiveOwners = await this.prisma.user.count({
      where: { businessId, role: { name: OWNER_ROLE }, isActive: true, NOT: { id: userId } },
    });
    if (otherActiveOwners === 0) {
      throw new ForbiddenException(
        `Impossible de ${action} ce compte : c'est le dernier Responsable actif de l'entreprise.`,
      );
    }
  }

  async findAll(caller: AuthenticatedUser) {
    const businessId = this.businessIdOf(caller);
    const users = await this.prisma.user.findMany({
      where: { businessId },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.name,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  private async findRoleOrThrow(roleName: string) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Rôle "${roleName}" introuvable.`);
    return role;
  }

  private async findUserOrThrow(businessId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, businessId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  async create(dto: CreateUserDto, caller: AuthenticatedUser) {
    const businessId = this.businessIdOf(caller);
    this.assertCanAssignRole(dto.roleName, caller.role);
    await this.authService.assertEmailAvailable(dto.email);
    const role = await this.findRoleOrThrow(dto.roleName);
    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, roleId: role.id, businessId },
      include: { role: true },
    });

    return { id: user.id, name: user.name, email: user.email, role: user.role.name };
  }

  async update(id: string, dto: UpdateUserDto, caller: AuthenticatedUser) {
    const businessId = this.businessIdOf(caller);
    await this.findUserOrThrow(businessId, id);

    if (dto.email) {
      // Comme à la création (assertEmailAvailable) : évite un 500 brut (violation de
      // contrainte unique Prisma) si l'email choisi appartient déjà à un autre compte.
      const conflicting = await this.prisma.user.findFirst({ where: { email: dto.email, NOT: { id } } });
      if (conflicting) throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    if (dto.roleName) {
      this.assertCanAssignRole(dto.roleName, caller.role);
    }
    if (dto.isActive === false) {
      await this.assertNotLastActiveOwner(businessId, id, 'désactiver');
    }
    if (dto.roleName && dto.roleName !== OWNER_ROLE) {
      // Rétrogradation potentielle du dernier Responsable : assertNotLastActiveOwner relit
      // elle-même le compte et ne bloque que s'il est réellement Responsable et actif.
      await this.assertNotLastActiveOwner(businessId, id, 'rétrograder');
    }

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.email) data.email = dto.email;
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;
    if (dto.roleName) {
      const role = await this.findRoleOrThrow(dto.roleName);
      data.roleId = role.id;
    }
    if (dto.password) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
    }

    // `updateMany` filtré par entreprise : même si findUserOrThrow était contourné un jour, la
    // mise à jour elle-même ne pourrait toucher qu'un compte de cette entreprise.
    await this.prisma.user.updateMany({ where: { id, businessId }, data });
    const user = await this.prisma.user.findFirstOrThrow({ where: { id, businessId }, include: { role: true } });

    if (dto.isActive === false || dto.password) {
      // Un mot de passe réinitialisé (ou un compte désactivé) doit invalider toute session
      // ouverte, plutôt que de laisser un refresh token déjà émis rester utilisable.
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
    }

    return { id: user.id, name: user.name, email: user.email, role: user.role.name, isActive: user.isActive };
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const businessId = this.businessIdOf(caller);
    await this.findUserOrThrow(businessId, id);
    await this.assertNotLastActiveOwner(businessId, id, 'supprimer');
    await this.prisma.user.deleteMany({ where: { id, businessId } });
    return { success: true };
  }
}
