import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { PrismaService } from './prisma/prisma.service';
import { createTenantSlugMiddleware } from './tenancy/tenant-slug.middleware';

/**
 * Configuration HTTP commune à l'application réelle (main.ts) et aux tests e2e : les tests
 * doivent exercer EXACTEMENT le même pipeline (cookies, préfixe /api, résolution des vitrines
 * /api/b/:slug, validation), sinon ils ne prouveraient rien sur le comportement réel.
 */
export function configureApp(app: NestExpressApplication, config: ConfigService): void {
  // Nécessaire pour lire les cookies d'authentification httpOnly (voir auth/cookies.ts) :
  // Express n'expose pas `req.cookies` par défaut, seulement l'en-tête brut `Cookie`.
  app.use(cookieParser());

  // Nécessaire dès que l'API tourne derrière un reverse proxy/load balancer (Nginx,
  // Cloudflare, Render...) : sans ça, Express voit l'IP du proxy comme `req.ip` pour CHAQUE
  // visiteur, donc l'anti-spam (contact, commandes) et la limitation des tentatives de
  // connexion partageraient tous le même quota. Non activé par défaut : faire confiance à un
  // `X-Forwarded-For` arbitraire permettrait au contraire de FALSIFIER `req.ip`. Valeurs
  // acceptées (voir doc Express `trust proxy`) : nombre de sauts (ex. "1"), IP/sous-réseau(x),
  // ou "true" (à réserver à une chaîne réseau entièrement maîtrisée).
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  // En-têtes de sécurité standard. `crossOriginResourcePolicy` est désactivé car les images de
  // /uploads sont volontairement consommées cross-origin par les clients web et mobile.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.setGlobalPrefix('api');

  // Résout /api/b/:slug/... (vitrine publique d'une entreprise) AVANT le routage : voir
  // tenant-slug.middleware.ts. Monté sur l'application (sans chemin) pour pouvoir réécrire l'URL.
  app.use(createTenantSlugMiddleware(app.get(PrismaService)));

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
