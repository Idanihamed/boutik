import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envoi d'email via l'API HTTP de Resend (RESEND_API_KEY/SMTP_FROM — voir .env.example).
 * Choix du HTTP plutôt que du SMTP (essayé en premier) : sur Render, les connexions SMTP
 * sortantes vers Resend (ports 587 et 465) se sont montrées peu fiables (timeouts
 * intermittents), alors que l'API HTTP (HTTPS/443, jamais bloqué) fonctionne de façon stable —
 * c'est d'ailleurs la voie que Resend recommande en priorité, le SMTP n'étant qu'une couche de
 * compatibilité chez eux.
 *
 * Tant que RESEND_API_KEY n'est pas renseignée, ce service ne plante jamais : il journalise
 * l'email qu'il AURAIT envoyé et ne fait rien d'autre (no-op). Ça permet de brancher dès
 * maintenant les appels (confirmation de commande, accusé de réception de message) sans
 * attendre que ce compte existe, et de les activer plus tard par simple ajout d'une variable
 * d'environnement, sans changement de code.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('SMTP_FROM', 'Boutik <onboarding@resend.dev>');
  }

  async send({ to, subject, html }: SendMailInput): Promise<void> {
    if (!this.apiKey) {
      this.logger.log(`[Resend non configuré, email non envoyé] À: ${to} — Sujet: ${subject}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }

      this.logger.log(`Email envoyé à ${to} — Sujet: ${subject}`);
    } catch (error) {
      // Ne doit JAMAIS faire échouer l'action métier qui déclenche l'email (même principe
      // que ActivityLogService.record) : une commande passée avec succès ne doit pas devenir
      // une erreur 500 juste parce que l'envoi de sa confirmation par email a échoué.
      this.logger.error(`Échec d'envoi d'email à ${to} : ${(error as Error).message}`);
    }
  }
}
