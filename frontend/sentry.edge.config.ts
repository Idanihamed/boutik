import * as Sentry from '@sentry/nextjs';

// Même configuration que sentry.server.config.ts, pour le runtime "edge" (middleware Next
// éventuel) — voir instrumentation.ts pour le choix du fichier chargé selon le runtime.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
  tracesSampleRate: 0,
});
