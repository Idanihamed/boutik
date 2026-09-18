import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ContactMessageStatus, Prisma } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { QueryContactMessagesDto } from './dto/query-contact-messages.dto';
import { ReplyContactMessageDto } from './dto/reply-contact-message.dto';
import { generateReference } from '../common/utils/reference.util';
import { isEmailLike } from '../common/utils/is-email.util';
import { escapeHtml } from '../common/utils/escape-html.util';
import { currentBusinessId } from '../tenancy/tenant-context';

// Anti-spam simple par adresse IP (§23 : "à valider selon le niveau de trafic attendu").
// En l'absence d'une décision client, une limite prudente est appliquée par défaut.
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_MESSAGES = 5;

@Injectable()
export class ContactMessagesService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  // ---------- Public ----------

  async create(dto: CreateContactMessageDto, ipAddress?: string) {
    if (dto.website) {
      // Piège à bots rempli : on répond succès sans rien enregistrer ni notifier, pour ne
      // pas révéler la défense à un bot qui inspecterait les réponses.
      return { success: true };
    }

    // Accessibilité (§23 étendu) : un message uniquement vocal est accepté pour les
    // personnes ne sachant pas écrire, mais l'un des deux (texte ou vocal) est requis.
    if (!dto.message?.trim() && !dto.voiceUrl) {
      throw new BadRequestException('Merci de saisir un message ou d’enregistrer un message vocal.');
    }

    if (ipAddress) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
      const recentCount = await this.prisma.contactMessage.count({
        where: { ipAddress, createdAt: { gte: since } },
      });
      if (recentCount >= RATE_LIMIT_MAX_MESSAGES) {
        throw new HttpException(
          'Trop de messages envoyés récemment. Merci de réessayer dans quelques minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Collision extrêmement improbable (32^8 combinaisons) mais vérifiée plutôt que supposée
    // impossible, la contrainte @unique ferait sinon échouer create() avec une erreur Prisma
    // brute plutôt qu'un nouveau tirage.
    let reference = generateReference();
    while (await this.prisma.contactMessage.findFirst({ where: { reference }, select: { id: true } })) {
      reference = generateReference();
    }

    await this.prisma.contactMessage.create({
      data: {
        reference,
        name: dto.name,
        contact: dto.contact,
        subject: dto.subject,
        message: dto.message ?? '',
        voiceUrl: dto.voiceUrl,
        attachmentUrl: dto.attachmentUrl,
        ipAddress,
      },
    });

    // §29 : notification interne à la réception d'un nouveau message de contact.
    await this.notificationsService.create(
      'CONTACT_MESSAGE',
      `Nouveau message de ${dto.name} : ${dto.subject}`,
      '/espace/messages',
    );

    // dto.contact accepte un téléphone OU un email (même principe que OrdersService.create).
    if (isEmailLike(dto.contact)) {
      const business = await this.businessName();
      await this.mailService.send({
        to: dto.contact,
        subject: `${business} : votre message a bien été reçu (réf. ${reference})`,
        html: `<p>Merci ${escapeHtml(dto.name)}, votre message concernant « ${escapeHtml(dto.subject)} » a bien été reçu par <strong>${escapeHtml(business)}</strong>. Référence : <strong>${reference}</strong>.</p><p>Vous recevrez la réponse par email et pourrez aussi la consulter avec cette référence.</p>`,
      });
    }

    return { success: true, reference };
  }

  /** Nom de l'entreprise courante, pour signer les emails envoyés à ses clients. */
  private async businessName(): Promise<string> {
    const id = currentBusinessId();
    const business = id ? await this.prisma.business.findUnique({ where: { id }, select: { name: true } }) : null;
    return business?.name ?? 'la boutique';
  }

  /**
   * Suivi public (voir /suivi) : le contact (tél/email) doit correspondre à celui saisi à
   * l'envoi — la référence seule (8 caractères) est déjà difficile à deviner, mais exiger le
   * contact évite qu'une référence vue par-dessus l'épaule de quelqu'un ou traînant dans un
   * historique de navigateur suffise à lire la réponse d'un tiers.
   */
  async findByReference(reference: string, contact: string) {
    const message = await this.prisma.contactMessage.findFirst({ where: { reference: reference.toUpperCase() } });
    if (!message || message.contact.trim().toLowerCase() !== contact.trim().toLowerCase()) {
      // Message générique volontaire : ne pas distinguer "référence inconnue" de "contact
      // incorrect", pour ne pas aider quelqu'un à deviner une référence par tâtonnement.
      throw new NotFoundException('Aucune demande trouvée avec cette référence et ce contact.');
    }

    return {
      reference: message.reference,
      subject: message.subject,
      status: message.status,
      createdAt: message.createdAt,
      reply: message.replyMessage,
      replyVoiceUrl: message.replyVoiceUrl,
      repliedAt: message.repliedAt,
    };
  }

  // ---------- Admin ----------

  async findAllAdmin(query: QueryContactMessagesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.ContactMessageWhereInput = {
      ...(query.status ? { status: query.status as ContactMessageStatus } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          contact: true,
          subject: true,
          message: true,
          voiceUrl: true,
          attachmentUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneAdmin(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message introuvable.');

    // Ouvrir un message "Nouveau" le fait passer automatiquement à "Lu" (§23), à l'image
    // d'une boîte de réception classique — un passage à "Traité" reste une action manuelle.
    if (message.status === 'NOUVEAU') {
      return this.prisma.contactMessage.update({ where: { id }, data: { status: 'LU' } });
    }
    return message;
  }

  async setStatus(id: string, status: ContactMessageStatus) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Message introuvable.');
    return this.prisma.contactMessage.update({ where: { id }, data: { status } });
  }

  // Enregistrer une réponse fait passer le message à "Traité" — une réponse envoyée signifie
  // par définition que la demande a été traitée, pas besoin d'une action manuelle séparée.
  // Réponse texte et/ou vocale (même souplesse que pour l'envoi initial du visiteur, voir
  // create() ci-dessus) : au moins l'une des deux est requise.
  async setReply(id: string, dto: ReplyContactMessageDto) {
    if (!dto.reply?.trim() && !dto.replyVoiceUrl) {
      throw new BadRequestException('Merci de saisir une réponse ou d’enregistrer un message vocal.');
    }
    const existing = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Message introuvable.');
    const updated = await this.prisma.contactMessage.update({
      where: { id },
      data: {
        replyMessage: dto.reply ?? null,
        replyVoiceUrl: dto.replyVoiceUrl ?? null,
        replyAttachmentUrl: dto.replyAttachmentUrl ?? null,
        repliedAt: new Date(),
        status: 'TRAITE',
      },
    });

    // Sans cet email, un client qui n'a pas gardé sa référence ne saurait jamais qu'on lui a
    // répondu. No-op tant que l'envoi d'email n'est pas configuré (voir MailService).
    if (dto.reply?.trim() && isEmailLike(existing.contact)) {
      const business = await this.businessName();
      const body = escapeHtml(dto.reply.trim()).replace(/\n/g, '<br>');
      await this.mailService.send({
        to: existing.contact,
        subject: `${business} a répondu à votre message (réf. ${existing.reference})`,
        html: `<p>Bonjour ${escapeHtml(existing.name)},</p><p>${body}</p><p style="color:#64748b">Réponse de ${escapeHtml(business)} à votre message « ${escapeHtml(existing.subject)} » — référence ${existing.reference}.</p>`,
      });
    }

    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Message introuvable.');
    await this.prisma.contactMessage.delete({ where: { id } });
    return { success: true };
  }

  /** Messages non traités (§25 du tableau de bord). */
  async countUntreated() {
    return this.prisma.contactMessage.count({ where: { status: { not: 'TRAITE' } } });
  }
}
