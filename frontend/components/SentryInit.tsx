'use client';

import '../lib/sentry-client';

/**
 * Ne rend rien : sert uniquement à faire exécuter, côté navigateur, l'import de
 * lib/sentry-client.ts (donc `Sentry.init`) une seule fois au chargement du site. Un composant
 * client plutôt qu'un import direct dans le layout (composant serveur) — le SDK Sentry pour le
 * navigateur ne doit jamais s'exécuter côté serveur.
 */
export function SentryInit() {
  return null;
}
