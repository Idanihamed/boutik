import { randomUUID } from 'crypto';
import { CookieOptions, Response } from 'express';
import { ConfigService } from '@nestjs/config';

export const ACCESS_TOKEN_COOKIE = 'boutik_access_token';
export const REFRESH_TOKEN_COOKIE = 'boutik_refresh_token';
export const CSRF_TOKEN_COOKIE = 'boutik_csrf_token';

// `SameSite=None` exige `Secure` — sauf exception navigateur pour `localhost`, qui est traité
// comme une origine sécurisée même en HTTP. Ça permet de développer en local (front :3000,
// API :3001, donc cross-site) sans certificat TLS tout en gardant la configuration valide en
// production (déployée en HTTPS). `COOKIE_SECURE=false` reste disponible pour un déploiement
// HTTP interne exceptionnel, mais désactive alors `SameSite=None` (incompatible sans Secure).
function baseCookieOptions(config: ConfigService): CookieOptions {
  const secure = config.get<string>('COOKIE_SECURE', 'true') !== 'false';
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
}

function msFromDuration(duration: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 1000;
  return value * unitMs;
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const base = baseCookieOptions(config);
  const accessMaxAge = msFromDuration(config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'), 15 * 60_000);
  const refreshMaxAge = msFromDuration(config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'), 30 * 86_400_000);

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, { ...base, maxAge: accessMaxAge });
  // Portée restreinte à /api/auth : le refresh token n'a besoin d'être envoyé qu'aux routes
  // login/refresh/logout, jamais aux routes métier — réduit sa surface d'exposition.
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, { ...base, path: '/api/auth', maxAge: refreshMaxAge });
  // Cookie CSRF volontairement lisible en JS (pas httpOnly) : le pattern "double soumission"
  // exige que le front puisse le lire pour le renvoyer dans un en-tête (voir CsrfMiddleware) —
  // un attaquant CSRF ne peut pas lire les cookies de la victime depuis un autre site, donc ne
  // peut pas reproduire cet en-tête, même s'il peut déclencher l'envoi automatique des cookies.
  res.cookie(CSRF_TOKEN_COOKIE, randomUUID(), { ...base, httpOnly: false, maxAge: refreshMaxAge });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const base = baseCookieOptions(config);
  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, path: '/api/auth' });
  res.clearCookie(CSRF_TOKEN_COOKIE, { ...base, httpOnly: false });
}
