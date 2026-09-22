import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

const logger = new Logger('Sentry');

/**
 * Surveillance des erreurs en production (Sentry). Même principe que MailService/Cloudinary
 * (voir mail.service.ts, media.service.ts) : tant que SENTRY_DSN n'est pas renseignée, ce
 * module ne fait STRICTEMENT rien — pas d'appel réseau, pas d'erreur au démarrage — pour ne
 * jamais bloquer le développement local ou un déploiement avant qu'un compte Sentry existe.
 *
 * Sans ça, une erreur 500 en production (bug non prévu par les tests, panne d'un prestataire
 * externe non prévue par un try/catch...) n'est visible que si un client se plaint — voir la
 * discussion avec l'utilisateur sur les manques identifiés le 2026-09-22.
 */
export function initSentry(config: ConfigService): void {
  const dsn = config.get<string>('SENTRY_DSN');
  if (!dsn) {
    logger.log('SENTRY_DSN non configurée : surveillance des erreurs désactivée (voir .env.example).');
    return;
  }

  Sentry.init({
    dsn,
    environment: config.get<string>('SENTRY_ENVIRONMENT', 'production'),
    // Aucun suivi de performance (« tracing ») pour l'instant : seules les erreurs comptent
    // ici, et un compte Sentry gratuit a un quota mensuel qu'on ne veut pas consommer pour
    // autre chose que ce qui justifie réellement ce chantier (être alerté d'un bug en prod).
    tracesSampleRate: 0,
  });
  logger.log('Surveillance des erreurs activée (Sentry).');
}

/** true si Sentry a été initialisé (DSN configurée) — évite d'appeler l'API Sentry pour rien. */
export function isSentryEnabled(): boolean {
  return Boolean(Sentry.getClient());
}
