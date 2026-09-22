// Hook d'instrumentation Next.js (App Router) : exécuté une fois au démarrage du serveur,
// avant que la moindre requête ne soit traitée. Charge la configuration Sentry adaptée au
// runtime réellement utilisé (Node.js pour le rendu serveur normal, "edge" pour un éventuel
// middleware) — voir sentry.server.config.ts / sentry.edge.config.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
