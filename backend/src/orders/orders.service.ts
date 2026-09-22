import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { TENANT_PRISMA, TenantPrisma } from '../tenancy/tenant-prisma';
import { PrismaService } from '../prisma/prisma.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { PromotionsService } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { resolveEffectivePrice } from '../common/utils/pricing.util';
import { generateReference } from '../common/utils/reference.util';
import { isEmailLike } from '../common/utils/is-email.util';
import { escapeHtml } from '../common/utils/escape-html.util';
import { formatMoney } from '../common/utils/money.util';
import { computeStockStatus } from '../common/utils/stock-status.util';
import { computeShippingFee, evaluatePromoCode, normalizePromoCode } from '../common/utils/order-pricing.util';
import { currentBusinessId } from '../tenancy/tenant-context';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

// Anti-spam par IP : même principe et mêmes valeurs par défaut que pour le formulaire de
// contact (voir ContactMessagesService) — pas de raison qu'une commande invitée soit moins
// protégée qu'un simple message.
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_ORDERS = 5;

// Une commande annulée puis réactivée ne doit décrémenter le stock qu'une fois ; à l'inverse,
// annuler une commande déjà annulée ne doit pas restocker deux fois. `ANNULEE` est donc traité
// comme un état, pas un événement, des deux côtés de setStatus() ci-dessous.
const CANCELLED: OrderStatus = 'ANNULEE';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly promotionsService: PromotionsService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly promoCodesService: PromoCodesService,
    // Requêtes HORS contexte d'entreprise (l'historique d'un client traverse toutes les
    // entreprises où il a commandé) : le client Prisma normal, jamais celui isolé par tenant.
    private readonly rawPrisma: PrismaService,
  ) {}

  /** Nom et devise de l'entreprise courante (pour les messages envoyés à ses clients). */
  private async currentBusiness(): Promise<{ name: string; currency: string }> {
    const id = currentBusinessId();
    const business = id
      ? await this.prisma.business.findUnique({ where: { id }, select: { name: true, currency: true } })
      : null;
    return business ?? { name: 'la boutique', currency: 'XOF' };
  }

  /**
   * Prix d'une commande, calculé côté serveur uniquement (jamais transmis par le client) : lignes,
   * code promo, livraison, total. Partagé par l'aperçu du panier (quote) et la commande réelle
   * (create), pour que le montant affiché soit toujours celui facturé.
   */
  private async priceOrder(dto: { items: { productId: string; quantity: number }[]; boutiqueId?: string; promoCode?: string }) {
    if (dto.boutiqueId) {
      const boutique = await this.prisma.boutique.findUnique({ where: { id: dto.boutiqueId } });
      if (!boutique || !boutique.isActive) {
        throw new BadRequestException('Boutique de retrait invalide.');
      }
    }

    // Un seul produit commandé plusieurs fois dans la même requête (deux lignes distinctes
    // pour le même productId) fusionnerait silencieusement les quantités si on ne le
    // détectait pas : sans ça, la vérification de stock ci-dessous porterait sur chaque
    // ligne séparément (chacune < stock dispo) alors que leur somme pourrait le dépasser.
    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Un même produit ne peut apparaître qu’une seule fois dans la commande.');
    }

    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productById.get(item.productId);
      if (!product || product.status !== 'PUBLISHED') {
        throw new BadRequestException(`Produit introuvable ou indisponible (${item.productId}).`);
      }
    }

    // Prix effectif calculé côté serveur à partir des promotions actives — jamais transmis
    // par le client (voir resolveEffectivePrice / PromotionsService.getApplicablePromotionsFor,
    // déjà utilisés par ProductsService pour l'affichage catalogue : même règle de priorité).
    const promotionsByProduct = await this.promotionsService.getApplicablePromotionsFor(
      products.map((p) => ({ id: p.id, categoryId: p.categoryId })),
    );

    const lines = dto.items.map((item) => {
      const product = productById.get(item.productId)!;
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour « ${product.name} » (${product.stock} disponible(s)).`,
        );
      }
      const pricing = resolveEffectivePrice(product.price, product.promoPrice, promotionsByProduct.get(product.id) ?? []);
      const subtotal = pricing.effectivePrice * item.quantity;
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: pricing.effectivePrice,
        quantity: item.quantity,
        subtotal,
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const business = await this.currentBusiness();

    const promoText = dto.promoCode?.trim();
    const promo = promoText ? await this.promoCodesService.findByCode(promoText) : null;
    const promoCheck = promoText ? evaluatePromoCode(promo, subtotal, business.currency) : null;
    const discount = promoCheck?.valid ? promoCheck.discount : 0;

    const settings = await this.prisma.setting.findFirst();
    const shippingSettings = {
      shippingFee: settings?.shippingFee ?? 0,
      freeShippingThreshold: settings?.freeShippingThreshold ?? null,
    };
    const shippingFee = computeShippingFee(shippingSettings, subtotal - discount, Boolean(dto.boutiqueId));

    return {
      productById,
      lines,
      subtotal,
      discount,
      shippingFee,
      totalAmount: subtotal - discount + shippingFee,
      freeShippingThreshold: shippingSettings.freeShippingThreshold,
      promo,
      promoText: promoText ? normalizePromoCode(promoText) : null,
      promoCheck,
    };
  }

  /** Aperçu du panier : sous-total, code promo, livraison et total, sans rien enregistrer. */
  async quote(dto: QuoteOrderDto) {
    const priced = await this.priceOrder(dto);
    return {
      subtotal: priced.subtotal,
      discount: priced.discount,
      shippingFee: priced.shippingFee,
      total: priced.totalAmount,
      freeShippingThreshold: priced.freeShippingThreshold,
      promoCode: priced.promoText
        ? { code: priced.promoText, valid: Boolean(priced.promoCheck?.valid), message: priced.promoCheck && !priced.promoCheck.valid ? priced.promoCheck.message : null }
        : null,
    };
  }

  // ---------- Public ----------

  async create(dto: CreateOrderDto, ipAddress?: string, customerId?: string) {
    if (dto.website) {
      // Piège à bots rempli : voir ContactMessagesService.create pour le même mécanisme.
      return { success: true };
    }

    if (ipAddress) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
      const recentCount = await this.prisma.order.count({ where: { ipAddress, createdAt: { gte: since } } });
      if (recentCount >= RATE_LIMIT_MAX_ORDERS) {
        throw new HttpException(
          'Trop de commandes envoyées récemment. Merci de réessayer dans quelques minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const priced = await this.priceOrder(dto);
    const { lines, productById, discount, shippingFee, totalAmount, promo, promoText, promoCheck } = priced;

    // Un code saisi mais refusé bloque la commande : le client ne doit pas payer plein tarif sans le savoir.
    if (promoCheck && !promoCheck.valid) {
      throw new BadRequestException(promoCheck.message);
    }

    let reference = generateReference();
    while (await this.prisma.order.findFirst({ where: { reference }, select: { id: true } })) {
      reference = generateReference();
    }

    // Transaction : décrémenter le stock et créer la commande doivent réussir ensemble, sinon
    // une commande pourrait être enregistrée sans que le stock ne baisse (ou l'inverse) en cas
    // d'erreur en cours de route.
    const order = await this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        // updateMany + where stock >= quantity plutôt qu'update simple : verrou optimiste qui
        // empêche deux commandes concurrentes de vendre le même dernier exemplaire (l'une des
        // deux ne trouvera plus assez de stock au moment de cette requête et échouera proprement
        // ci-dessous, plutôt que de laisser le stock passer négatif).
        const result = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          throw new BadRequestException(`Stock insuffisant pour « ${line.productName} », réessayez.`);
        }
      }

      // Code promo : consommation atomique (le compteur ne dépasse jamais maxUses, même avec deux
      // commandes simultanées sur la dernière utilisation).
      if (promo && promoCheck?.valid) {
        const used = await tx.promoCode.updateMany({
          where: { id: promo.id, ...(promo.maxUses !== null ? { usedCount: { lt: promo.maxUses } } : {}) },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0) {
          throw new BadRequestException('Ce code promo a atteint son nombre maximal d’utilisations.');
        }
      }

      return tx.order.create({
        data: {
          reference,
          customerName: dto.customerName,
          customerContact: dto.customerContact,
          customerAddress: dto.customerAddress,
          boutiqueId: dto.boutiqueId,
          notes: dto.notes,
          totalAmount,
          discountAmount: discount,
          shippingFee,
          promoCode: promoText && promoCheck?.valid ? promoText : null,
          customerId,
          ipAddress,
          items: { create: lines },
        },
      });
    });

    const business = await this.currentBusiness();
    await this.notificationsService.create(
      'NEW_ORDER',
      `Nouvelle commande de ${dto.customerName} (${formatMoney(totalAmount, business.currency)})`,
      '/espace/commandes',
    );

    // Une vente peut faire passer un produit en stock faible ou en rupture : le responsable doit
    // en être alerté comme lors d'une modification manuelle du stock (voir
    // ProductsService.notifyIfStockWorsened), sinon il ne le découvre qu'au prochain client déçu.
    for (const line of lines) {
      const product = productById.get(line.productId)!;
      const before = computeStockStatus(product.stock, product.lowStockThreshold);
      const after = computeStockStatus(product.stock - line.quantity, product.lowStockThreshold);
      if (after === before) continue;
      if (after === 'RUPTURE') {
        await this.notificationsService.create(
          'OUT_OF_STOCK',
          `Le produit « ${product.name} » est en rupture de stock.`,
          `/espace/produits/${product.id}`,
        );
      } else if (after === 'STOCK_FAIBLE') {
        await this.notificationsService.create(
          'LOW_STOCK',
          `Le produit « ${product.name} » passe en stock faible.`,
          `/espace/produits/${product.id}`,
        );
      }
    }

    // customerContact accepte un téléphone OU un email (voir CreateOrderDto) : pas d'envoi si
    // ce n'est manifestement pas une adresse email. No-op tant qu'aucun SMTP n'est configuré
    // (voir MailService).
    if (isEmailLike(dto.customerContact)) {
      const itemsHtml = lines.map((l) => `<li>${l.quantity} × ${escapeHtml(l.productName)}</li>`).join('');
      await this.mailService.send({
        to: dto.customerContact,
        subject: `${business.name} : confirmation de votre commande ${reference}`,
        html: `<p>Merci ${escapeHtml(dto.customerName)}, votre commande <strong>${reference}</strong> a bien été reçue par <strong>${escapeHtml(business.name)}</strong>.</p><ul>${itemsHtml}</ul>${discount > 0 ? `<p>Réduction (${escapeHtml(promoText ?? '')}) : -${formatMoney(discount, business.currency)}</p>` : ''}${shippingFee > 0 ? `<p>Livraison : ${formatMoney(shippingFee, business.currency)}</p>` : ''}<p>Total : ${formatMoney(totalAmount, business.currency)}</p><p>L'entreprise vous contactera pour la confirmer. Vous pouvez suivre votre commande avec la référence ci-dessus.</p>`,
      });
    }

    return { success: true, reference, totalAmount };
  }

  /**
   * Suivi public (voir /commandes/suivi côté front) : même principe que
   * ContactMessagesService.findByReference — le contact doit correspondre à celui saisi à la
   * commande, pour qu'une référence égarée ne suffise pas à consulter la commande d'un tiers.
   */
  async findByReference(reference: string, contact: string) {
    const order = await this.prisma.order.findFirst({
      where: { reference: reference.toUpperCase() },
      include: { items: true, boutique: true },
    });
    if (!order || order.customerContact.trim().toLowerCase() !== contact.trim().toLowerCase()) {
      throw new NotFoundException('Aucune commande trouvée avec cette référence et ce contact.');
    }

    return {
      reference: order.reference,
      status: order.status,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      promoCode: order.promoCode,
      customerAddress: order.customerAddress,
      boutique: order.boutique ? { name: order.boutique.name, address: order.boutique.address } : null,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    };
  }

  // ---------- Compte client ----------

  /** Historique des commandes d'un client connecté, TOUTES entreprises confondues. */
  async findMineList(customerId: string, page: number, limit: number) {
    const where: Prisma.OrderWhereInput = { customerId };
    const [items, total] = await this.rawPrisma.$transaction([
      this.rawPrisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { business: { select: { name: true, slug: true, currency: true } }, items: true },
      }),
      this.rawPrisma.order.count({ where }),
    ]);
    return {
      data: items.map((order) => ({
        id: order.id,
        reference: order.reference,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        business: order.business,
        createdAt: order.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** Détail d'une commande de l'historique du client — jamais celle d'un autre (filtrée par customerId). */
  async findMineOne(customerId: string, id: string) {
    const order = await this.rawPrisma.order.findFirst({
      where: { id, customerId },
      include: { items: true, boutique: true, business: { select: { name: true, slug: true, currency: true } } },
    });
    if (!order) throw new NotFoundException('Commande introuvable.');
    return {
      id: order.id,
      reference: order.reference,
      status: order.status,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      promoCode: order.promoCode,
      customerAddress: order.customerAddress,
      boutique: order.boutique ? { name: order.boutique.name, address: order.boutique.address } : null,
      business: order.business,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
    };
  }

  // ---------- Admin ----------

  async findAllAdmin(query: QueryOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true, boutique: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneAdmin(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true, boutique: true } });
    if (!order) throw new NotFoundException('Commande introuvable.');
    return order;
  }

  /**
   * Annuler une commande restocke ses articles ; réactiver une commande précédemment annulée
   * la redéduit — symétrique, pour que le stock reste cohérent quel que soit le nombre
   * d'allers-retours. Si un produit a été supprimé entre-temps (productId devenu null), sa
   * ligne est ignorée : il n'y a plus de stock à ajuster pour un produit qui n'existe plus.
   */
  async setStatus(id: string, status: OrderStatus) {
    const existing = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!existing) throw new NotFoundException('Commande introuvable.');

    const wasCancelled = existing.status === CANCELLED;
    const willBeCancelled = status === CANCELLED;

    if (wasCancelled !== willBeCancelled) {
      const itemsWithProduct = existing.items.filter((item) => item.productId);
      if (willBeCancelled) {
        // Annulation : toujours possible de restocker (une incrémentation ne peut pas échouer).
        await this.prisma.$transaction(
          itemsWithProduct.map((item) =>
            this.prisma.product.update({
              where: { id: item.productId! },
              data: { stock: { increment: item.quantity } },
            }),
          ),
        );
      } else {
        // Réactivation d'une commande annulée : même garde-fou que create() contre un stock
        // qui serait entre-temps devenu insuffisant (vendu ailleurs pendant l'annulation).
        await this.prisma.$transaction(async (tx) => {
          for (const item of itemsWithProduct) {
            const result = await tx.product.updateMany({
              where: { id: item.productId!, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (result.count === 0) {
              throw new BadRequestException(
                `Stock insuffisant pour réactiver cette commande (« ${item.productName} » n’a plus assez de stock).`,
              );
            }
          }
        });
      }
    }

    return this.prisma.order.update({ where: { id }, data: { status }, include: { items: true, boutique: true } });
  }

  /** Commandes non finalisées (§25 du tableau de bord, même principe que les messages). */
  async countPending() {
    return this.prisma.order.count({ where: { status: { notIn: ['LIVREE', 'ANNULEE'] } } });
  }
}
