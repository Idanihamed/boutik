import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { DEFAULT_CURRENCY_BY_COUNTRY, RESERVED_SLUGS } from '../common/countries';
import { OWNER_ROLE } from '../common/roles';
import { escapeHtml } from '../common/utils/escape-html.util';
import { toSlug } from '../common/utils/slug.util';
import { QueryDirectoryDto } from './dto/query-directory.dto';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private async slugIsTaken(slug: string): Promise<boolean> {
    return RESERVED_SLUGS.has(slug) || Boolean(await this.prisma.business.findUnique({ where: { slug }, select: { id: true } }));
  }

  private async resolveSlug(requested: string | undefined, businessName: string): Promise<string> {
    if (requested) {
      if (await this.slugIsTaken(requested)) {
        throw new ConflictException('Cet identifiant est déjà utilisé ou réservé. Choisissez-en un autre.');
      }
      return requested;
    }

    const base = toSlug(businessName).slice(0, 55) || 'entreprise';
    let candidate = base.length >= 2 ? base : `${base}-1`;
    let suffix = 2;
    while (await this.slugIsTaken(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  /**
   * Inscription libre : crée l'entreprise (statut PENDING, invisible du public) et son compte
   * Responsable dans une seule transaction. L'entreprise n'apparaît publiquement qu'une fois
   * validée par un administrateur de la plateforme (voir PlatformBusinessesService).
   */
  async register(dto: RegisterBusinessDto) {
    await this.authService.assertEmailAvailable(dto.email);

    const currency = dto.currency ?? DEFAULT_CURRENCY_BY_COUNTRY[dto.country];
    if (!currency) {
      throw new BadRequestException('La devise est obligatoire pour ce pays (ex. XOF, EUR).');
    }

    const ownerRole = await this.prisma.role.findUnique({ where: { name: OWNER_ROLE } });
    if (!ownerRole) {
      throw new BadRequestException("Inscription indisponible : le rôle OWNER n'existe pas (seed non exécuté).");
    }

    const slug = await this.resolveSlug(dto.slug, dto.businessName);
    const passwordHash = await this.authService.hashPassword(dto.password);

    try {
      const { business, owner } = await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: { name: dto.businessName, slug, country: dto.country, currency, description: dto.description },
        });
        const owner = await tx.user.create({
          data: { name: dto.ownerName, email: dto.email, passwordHash, roleId: ownerRole.id, businessId: business.id },
        });
        await tx.setting.create({ data: { businessId: business.id } });
        return { business, owner };
      });

      // Prévient l'administrateur de la plateforme (no-op tant que PLATFORM_ALERT_EMAIL et
      // RESEND_API_KEY ne sont pas renseignés — la file « en attente » reste consultable).
      const alertEmail = this.config.get<string>('PLATFORM_ALERT_EMAIL');
      if (alertEmail) {
        await this.mailService.send({
          to: alertEmail,
          subject: `Nouvelle entreprise à valider : ${business.name}`,
          html: `<p>L'entreprise <strong>${escapeHtml(business.name)}</strong> (${business.slug}, ${business.country}) vient de s'inscrire et attend votre validation.</p>`,
        });
      }

      return {
        business: { id: business.id, name: business.name, slug: business.slug, status: business.status },
        owner: { id: owner.id, name: owner.name, email: owner.email },
      };
    } catch (error) {
      // Course entre deux inscriptions simultanées visant le même identifiant ou le même email.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cet email ou cet identifiant est déjà utilisé.');
      }
      throw error;
    }
  }

  /**
   * Annuaire public : les entreprises validées qui ont au moins un produit publié (une vitrine vide
   * n'aide personne). Seuls des champs déjà publics sur la vitrine sont exposés.
   */
  async listDirectory(query: QueryDirectoryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.BusinessWhereInput = {
      status: 'ACTIVE',
      products: { some: { status: 'PUBLISHED' } },
      ...(query.country ? { country: query.country.toUpperCase() } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        select: { name: true, slug: true, logo: true, description: true, country: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.business.count({ where }),
    ]);

    return {
      data: items.map((b) => ({
        name: b.name,
        slug: b.slug,
        logo: b.logo,
        description: b.description && b.description.length > 160 ? `${b.description.slice(0, 157)}…` : b.description,
        country: b.country,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** Vitrine publique : identité de l'entreprise et réseaux, sans aucune donnée sensible. */
  async getStorefront(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, slug: true, logo: true, description: true, country: true, currency: true },
    });
    if (!business) throw new NotFoundException('Entreprise introuvable.');

    const settings = await this.prisma.setting.findUnique({
      where: { businessId },
      select: {
        whatsappNumber: true,
        facebookUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        linkedinUrl: true,
        xUrl: true,
        heroImage1: true,
        heroImage2: true,
        shippingFee: true,
        freeShippingThreshold: true,
      },
    });

    return { ...business, settings };
  }

  async getMine(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        description: true,
        country: true,
        currency: true,
        status: true,
        statusReason: true,
      },
    });
    if (!business) throw new NotFoundException('Entreprise introuvable.');
    return business;
  }

  async updateMine(businessId: string, dto: UpdateBusinessDto) {
    await this.getMine(businessId);
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logo !== undefined ? { logo: dto.logo } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      },
    });
    return this.getMine(businessId);
  }
}
