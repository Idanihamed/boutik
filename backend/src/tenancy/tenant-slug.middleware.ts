import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { TenantRequest } from './tenant.interceptor';

// Routes publiques de vitrine accessibles sous /api/b/:slug/... — liste blanche volontaire :
// jamais /admin, /platform ni /auth, pour qu'un slug ne puisse pas servir à atteindre le
// back-office d'une AUTRE entreprise que celle du compte connecté.
export const STOREFRONT_ROUTES = new Set([
  'products',
  'categories',
  'brands',
  'promotions',
  'boutiques',
  'actualites',
  'pages',
  'contact',
  'orders',
  'settings',
]);

const STOREFRONT_URL = /^\/api\/b\/([a-z0-9][a-z0-9-]{0,62})(\/[^?]*)?(\?.*)?$/;

function notFound(res: Response) {
  res.status(404).json({ statusCode: 404, message: 'Entreprise introuvable.', error: 'Not Found' });
}

/**
 * Traduit /api/b/:slug/<route> en /api/<route> après avoir résolu l'entreprise :
 * `req.tenantBusinessId` est lu ensuite par TenantInterceptor. Seule une entreprise ACTIVE a une
 * vitrine publique ; les autres (en attente, refusée, suspendue, bannie) répondent 404, comme si
 * elles n'existaient pas. Monté directement sur l'application Express (sans chemin de montage),
 * donc `req.url` est bien l'URL complète et sa réécriture est prise en compte par le routeur.
 */
export function createTenantSlugMiddleware(prisma: PrismaService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const match = STOREFRONT_URL.exec(req.url);
    if (!match) return next();

    const [, slug, rest = '', query = ''] = match;

    if (/\.\.|%2e|%2f|\/\/|\\/i.test(rest)) return notFound(res);

    const firstSegment = rest.split('/')[1] ?? '';
    if (firstSegment && !STOREFRONT_ROUTES.has(firstSegment)) return notFound(res);

    try {
      const business = await prisma.business.findUnique({ where: { slug }, select: { id: true, status: true } });
      if (!business || business.status !== 'ACTIVE') return notFound(res);

      (req as TenantRequest).tenantBusinessId = business.id;
      req.url = `/api${rest || '/storefront'}${query}`;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
