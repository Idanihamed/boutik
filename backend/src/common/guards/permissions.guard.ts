import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

/**
 * Vérifie que l'utilisateur authentifié possède bien les permissions requises.
 * Les permissions de l'utilisateur ("resource:action") sont embarquées dans le JWT
 * au moment de la connexion (voir AuthService.buildAccessToken) : le RBAC est donc
 * entièrement piloté par les données (Role/Permission en base), pas par du code en dur,
 * conformément au §27 du cahier des charges (matrice de permissions extensible).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié.');
    }

    const hasAll = requiredPermissions.every((perm) => user.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Permission(s) manquante(s) : ${requiredPermissions.join(', ')}.`,
      );
    }

    return true;
  }
}
