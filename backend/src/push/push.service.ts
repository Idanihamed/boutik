import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Forme d'un jeton fourni par l'application : ExponentPushToken[...] ou ExpoPushToken[...].
const TOKEN_FORMAT = /^Expo(nent)?PushToken\[[\w-]+\]$/;

export interface PushAlert {
  businessId: string;
  /** Permission (ex. « orders:read ») que doit avoir un membre du personnel pour recevoir l'alerte. */
  permission: string;
  title: string;
  body: string;
  /** Lien de l'alerte (ex. « /espace/commandes »), renvoyé à l'application pour ouvrir le bon écran. */
  link?: string | null;
}

/**
 * Alertes sur téléphone (commande, message, stock) via le service de notifications d'Expo.
 * Envoyer ne demande aucune clé : les identifiants Firebase se règlent côté Expo. Sans jeton
 * enregistré, rien ne part. Un échec d'envoi ne doit JAMAIS faire échouer l'action qui l'a
 * déclenché (une commande client, par exemple) : tout est journalisé et avalé.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async register(userId: string, businessId: string | null, token: string) {
    if (!TOKEN_FORMAT.test(token)) {
      throw new BadRequestException('Jeton de notification invalide.');
    }
    // Un téléphone qui change de compte reprend son jeton : il est rattaché à la dernière personne connectée.
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { token, userId, businessId },
      update: { userId, businessId },
    });
    return { ok: true };
  }

  async unregister(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
    return { ok: true };
  }

  /** Envoie l'alerte aux téléphones des membres actifs de l'entreprise autorisés à la voir. */
  async notifyBusiness(alert: PushAlert): Promise<void> {
    try {
      const [resource, action] = alert.permission.split(':');
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          businessId: alert.businessId,
          user: {
            isActive: true,
            businessId: alert.businessId,
            role: { permissions: { some: { permission: { resource, action } } } },
          },
        },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const messages = tokens.map(({ token }) => ({
        to: token,
        title: alert.title,
        body: alert.body,
        sound: 'default',
        channelId: 'default',
        data: { link: alert.link ?? null },
      }));

      const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.warn(`Envoi des notifications refusé par Expo (${res.status}).`);
        return;
      }

      // Un téléphone désinstallé ou révoqué répond « DeviceNotRegistered » : on oublie son jeton.
      const body = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      const dead = (body.data ?? [])
        .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
        .filter((t): t is string => Boolean(t));
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    } catch (error) {
      this.logger.warn(`Notification sur téléphone non envoyée : ${(error as Error).message}`);
    }
  }
}
