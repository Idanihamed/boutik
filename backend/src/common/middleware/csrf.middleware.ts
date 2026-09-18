import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, CSRF_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../auth/cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Protection CSRF par "double soumission de cookie" — nécessaire depuis le passage des tokens
 * d'authentification en cookies httpOnly (voir auth/cookies.ts) : un cookie est envoyé
 * automatiquement par le navigateur sur toute requête vers l'API, y compris déclenchée depuis
 * un site tiers, ce qui n'était pas le cas tant que l'auth reposait sur un header
 * `Authorization` (que seul le JS de notre propre front pouvait poser).
 *
 * Ne s'applique qu'aux requêtes qui portent déjà un cookie d'auth (access ou refresh) : les
 * routes publiques non authentifiées (ex. formulaire de contact) n'ont pas de session à
 * protéger et n'ont donc pas à fournir ce header. `/api/auth/login` est également exemptée
 * (aucune session avant la connexion elle-même).
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // `req.path` ne convient pas ici : ce middleware est monté par Nest sur le pattern
    // `/api/*` (global prefix + `forRoutes('*')`), et Express retire le préfixe de montage de
    // `req.url`/`req.path` le temps de l'exécution d'un middleware monté sur un chemin — dans
    // ce contexte, `req.path` vaut donc `/auth/login`, pas `/api/auth/login`, ce qui rendait
    // cette exemption inopérante (login systématiquement rejeté dès qu'un cookie d'auth
    // périmé traînait). `req.originalUrl` n'est lui jamais réécrit par Express.
    const path = req.originalUrl.split('?')[0];
    if (SAFE_METHODS.has(req.method) || path === '/api/auth/login') {
      return next();
    }

    const hasAuthCookie = Boolean(req.cookies?.[ACCESS_TOKEN_COOKIE] || req.cookies?.[REFRESH_TOKEN_COOKIE]);
    if (!hasAuthCookie) {
      return next();
    }

    const cookieToken = req.cookies?.[CSRF_TOKEN_COOKIE];
    const headerToken = req.header(CSRF_HEADER);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Jeton CSRF manquant ou invalide.');
    }

    next();
  }
}
