import * as Sentry from '@sentry/nextjs';

// Surveillance des erreurs (rendu serveur, routes /api internes à Next). Même principe que
// côté backend (voir backend/src/monitoring/sentry.util.ts) : sans SENTRY_DSN, `Sentry.init`
// ne fait rien — aucun appel réseau, rien à configurer pour développer en local.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
  tracesSampleRate: 0,
});
