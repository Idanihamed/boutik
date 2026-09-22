import * as Sentry from '@sentry/nextjs';

// Initialisé une seule fois, au premier import de ce module (voir components/SentryInit.tsx).
// `NEXT_PUBLIC_SENTRY_DSN` : contrairement aux autres clés de ce projet, le DSN Sentry n'est
// PAS un secret (il sert uniquement à recevoir des rapports d'erreur, jamais à en lire) — c'est
// pourquoi il est volontairement exposé au navigateur, comme le recommande la documentation
// Sentry. Vide = `Sentry.init` ne fait rien (même principe que côté serveur).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
  tracesSampleRate: 0,
});
