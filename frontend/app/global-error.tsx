'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Filet de secours au niveau racine (convention Next.js App Router) : se déclenche quand une
 * erreur de rendu survient hors de portée de tout error.tsx plus spécifique, y compris dans le
 * layout racine lui-même. Remplace alors <html>/<body> en entier, d'où leur présence ici.
 * Signale l'erreur à Sentry (no-op sans SENTRY_DSN, voir lib/sentry-client.ts).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1>Une erreur inattendue est survenue.</h1>
          <p>L’équipe technique a été alertée. Réessayez dans un instant.</p>
        </div>
      </body>
    </html>
  );
}
