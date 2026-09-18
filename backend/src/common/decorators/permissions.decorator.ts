import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Déclare la ou les permissions ("resource:action") requises pour accéder à une route.
 * Exemple : @RequirePermissions('products:create')
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
