import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marque une route comme publique : elle ne nécessite pas d'authentification.
 * Utilisé par les endpoints du site public (catalogue, fiches produits...).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
