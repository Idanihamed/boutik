import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OWNER_ROLE } from '../common/roles';
import { PlatformBusinessesService } from './platform-businesses.service';

const REMINDER_WINDOW_DAYS = 5;
const SYSTEM_ACTOR = { id: null, name: 'Système (abonnement)' };

/**
 * Automatise ce qu'un administrateur ferait sinon à la main tous les jours : prévenir une
 * entreprise avant l'échéance de son abonnement, et suspendre celles dont l'essai ou la
 * dernière période payée est dépassé sans renouvellement (voir §modèle économique du projet —
 * paiement manuel Mobile Money, pas de prestataire intégré, donc pas de webhook pour déclencher
 * ça autrement qu'en vérifiant les dates chaque jour).
 */
@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly businessesService: PlatformBusinessesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyCheck() {
    await this.sendReminders();
    await this.suspendExpired();
  }

  private async sendReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.business.findMany({
      where: { status: 'ACTIVE', renewalReminderSentAt: null },
      select: { id: true, name: true, trialEndsAt: true, subscriptionPaidUntil: true },
    });

    for (const business of candidates) {
      const due = PlatformBusinessesService.dueDate(business);
      if (!due || due > windowEnd || due < now) continue;

      const owners = await this.prisma.user.findMany({
        where: { businessId: business.id, role: { name: OWNER_ROLE } },
        select: { email: true },
      });
      const dueLabel = due.toLocaleDateString('fr-FR');
      for (const owner of owners) {
        await this.mailService.send({
          to: owner.email,
          subject: `Votre abonnement Boutik expire le ${dueLabel}`,
          html: `<p>Votre abonnement pour <strong>${business.name}</strong> expire le <strong>${dueLabel}</strong>. Renouvelez avant cette date pour que votre vitrine reste visible.</p>`,
        });
      }
      await this.prisma.business.update({ where: { id: business.id }, data: { renewalReminderSentAt: now } });
      this.logger.log(`Rappel d'échéance envoyé pour l'entreprise ${business.id}.`);
    }
  }

  private async suspendExpired() {
    const now = new Date();
    const candidates = await this.prisma.business.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, trialEndsAt: true, subscriptionPaidUntil: true },
    });

    for (const business of candidates) {
      const due = PlatformBusinessesService.dueDate(business);
      if (!due || due >= now) continue;

      await this.businessesService.moderate(
        business.id,
        'suspend',
        "Abonnement expiré sans renouvellement. Contactez la plateforme pour régler votre abonnement et être réactivé.",
        SYSTEM_ACTOR,
      );
      this.logger.log(`Entreprise ${business.id} suspendue automatiquement (abonnement expiré).`);
    }
  }
}
