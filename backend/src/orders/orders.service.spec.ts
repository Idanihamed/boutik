import { BadRequestException, HttpException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { TenantPrisma } from '../tenancy/tenant-prisma';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { PromotionsService } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from '../tenancy/tenant-context';
import { CreateOrderDto } from './dto/create-order.dto';

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-1',
    name: 'Produit test',
    categoryId: 'cat-1',
    price: 10000,
    promoPrice: null,
    stock: 5,
    lowStockThreshold: 2,
    status: 'PUBLISHED',
    ...overrides,
  };
}

function buildDto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    customerName: 'Client Test',
    customerContact: '0700000000',
    items: [{ productId: 'prod-1', quantity: 1 }],
    ...overrides,
  } as CreateOrderDto;
}

// Les emails sont signés du nom de l'entreprise courante : comme à l'exécution, l'appel se fait
// dans un contexte d'entreprise (posé par TenantInterceptor).
const inBusiness = <T,>(fn: () => Promise<T>) => tenantStorage.run({ businessId: 'business-1' }, fn);

describe('OrdersService.create', () => {
  let service: OrdersService;
  let prisma: {
    order: { count: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    boutique: { findUnique: jest.Mock };
    business: { findUnique: jest.Mock };
    product: { findMany: jest.Mock; updateMany: jest.Mock };
    setting: { findFirst: jest.Mock };
    promoCode: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let promotionsService: { getApplicablePromotionsFor: jest.Mock };
  let promoCodesService: { findByCode: jest.Mock };
  let notificationsService: { create: jest.Mock };
  let mailService: { send: jest.Mock };

  beforeEach(() => {
    prisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null), // pas de collision de référence
        create: jest.fn(),
      },
      boutique: { findUnique: jest.fn() },
      business: { findUnique: jest.fn().mockResolvedValue({ name: 'Ma Boutique', currency: 'XOF' }) },
      product: {
        findMany: jest.fn().mockResolvedValue([buildProduct()]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      setting: { findFirst: jest.fn().mockResolvedValue(null) }, // pas de frais de livraison configurés
      promoCode: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      // Simule tx.product.updateMany / tx.order.create en réutilisant les mêmes mocks que prisma
      // directement : le comportement testé (compte de lignes affectées) est identique.
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({ product: prisma.product, order: prisma.order, promoCode: prisma.promoCode }),
      ),
    };
    promotionsService = { getApplicablePromotionsFor: jest.fn().mockResolvedValue(new Map()) };
    promoCodesService = { findByCode: jest.fn().mockResolvedValue(null) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    mailService = { send: jest.fn().mockResolvedValue(undefined) };

    service = new OrdersService(
      prisma as unknown as TenantPrisma,
      promotionsService as unknown as PromotionsService,
      notificationsService as unknown as NotificationsService,
      mailService as unknown as MailService,
      promoCodesService as unknown as PromoCodesService,
      {} as PrismaService,
    );

    prisma.order.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'order-1', ...data }),
    );
  });

  it('piège à bots : une requête avec le champ honeypot rempli ne crée aucune commande', async () => {
    const result = await service.create(buildDto({ website: 'http://spam.example' }));
    expect(result).toEqual({ success: true });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  describe('rattachement au compte client', () => {
    it('rattache la commande au compte du client connecté (customerId)', async () => {
      await service.create(buildDto(), undefined, 'customer-1');
      expect(prisma.order.create.mock.calls[0][0].data).toMatchObject({ customerId: 'customer-1' });
    });

    it('un achat invité (sans compte connecté) n’enregistre aucun customerId', async () => {
      await service.create(buildDto());
      expect(prisma.order.create.mock.calls[0][0].data.customerId).toBeUndefined();
    });
  });

  it('rejette une commande contenant deux fois le même produit', async () => {
    await expect(
      service.create(
        buildDto({
          items: [
            { productId: 'prod-1', quantity: 1 },
            { productId: 'prod-1', quantity: 2 },
          ],
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejette un produit introuvable ou non publié', async () => {
    prisma.product.findMany.mockResolvedValue([buildProduct({ status: 'DRAFT' })]);
    await expect(service.create(buildDto())).rejects.toThrow(BadRequestException);
  });

  it('rejette si le stock est insuffisant', async () => {
    prisma.product.findMany.mockResolvedValue([buildProduct({ stock: 0 })]);
    await expect(service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 1 }] }))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('ne fait jamais confiance à un prix envoyé par le client : le prix vient du produit en base', async () => {
    // Le DTO/CreateOrderItemDto n'a même pas de champ prix (voir dto/create-order-item.dto.ts) :
    // ce test verrouille le calcul serveur pour qu'une évolution future n'introduise pas
    // accidentellement un prix transmis par le client.
    await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 3 }] }));

    const created = prisma.order.create.mock.calls[0][0].data;
    expect(created.totalAmount).toBe(30000); // 10000 * 3, prix du produit en base
    expect(created.items.create[0].unitPrice).toBe(10000);
  });

  it('applique le prix effectif calculé par PromotionsService (pas le prix catalogue)', async () => {
    promotionsService.getApplicablePromotionsFor.mockResolvedValue(
      new Map([
        [
          'prod-1',
          [{ promotionId: 'promo-1', name: 'Promo', type: 'PERCENTAGE', value: 20, priority: 1, createdAt: new Date() }],
        ],
      ]),
    );

    await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 2 }] }));

    const created = prisma.order.create.mock.calls[0][0].data;
    expect(created.items.create[0].unitPrice).toBe(8000); // -20%
    expect(created.totalAmount).toBe(16000);
  });

  it('échoue proprement (verrou optimiste) si le stock a été vendu entre-temps', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.create(buildDto())).rejects.toThrow(BadRequestException);
  });

  it('rejette une boutique de retrait inexistante ou désactivée', async () => {
    prisma.boutique.findUnique.mockResolvedValue({ id: 'b1', isActive: false });
    await expect(service.create(buildDto({ boutiqueId: 'b1' }))).rejects.toThrow(BadRequestException);
  });

  it('bloque au-delà de la limite anti-spam par IP (429)', async () => {
    prisma.order.count.mockResolvedValue(5);
    await expect(service.create(buildDto(), '1.2.3.4')).rejects.toThrow(HttpException);
  });

  it('n’applique pas la limite anti-spam sans adresse IP connue', async () => {
    prisma.order.count.mockResolvedValue(5);
    await expect(service.create(buildDto())).resolves.toMatchObject({ success: true });
  });

  it('envoie un email de confirmation quand customerContact ressemble à un email', async () => {
    await inBusiness(() => service.create(buildDto({ customerContact: 'client@example.com' })));
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        // L'email est signé du nom de l'entreprise (plusieurs entreprises partagent la plateforme).
        subject: expect.stringContaining('Ma Boutique : confirmation de votre commande'),
      }),
    );
  });

  it('échappe le texte saisi par le client dans l’email (pas d’injection HTML)', async () => {
    await inBusiness(() =>
      service.create(buildDto({ customerContact: 'client@example.com', customerName: '<script>alert(1)</script>' })),
    );
    const { html } = mailService.send.mock.calls[0][0] as { html: string };
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  describe('alertes de stock après une vente', () => {
    const stockAlerts = () =>
      notificationsService.create.mock.calls.filter(([type]) => type === 'OUT_OF_STOCK' || type === 'LOW_STOCK');

    it('alerte « rupture » quand la vente vide le stock', async () => {
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 5 }] }));
      expect(stockAlerts()).toEqual([
        ['OUT_OF_STOCK', 'Le produit « Produit test » est en rupture de stock.', '/espace/produits/prod-1'],
      ]);
    });

    it('alerte « stock faible » quand la vente atteint le seuil sans vider le stock', async () => {
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 3 }] })); // 5 -> 2 (seuil 2)
      expect(stockAlerts()).toEqual([
        ['LOW_STOCK', 'Le produit « Produit test » passe en stock faible.', '/espace/produits/prod-1'],
      ]);
    });

    it('n’alerte pas tant que le stock reste au-dessus du seuil', async () => {
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 2 }] })); // 5 -> 3
      expect(stockAlerts()).toEqual([]);
    });
  });

  describe('livraison et code promo', () => {
    const promo = (overrides: Record<string, unknown> = {}) => ({
      id: 'promo-1', code: 'BIENVENUE10', type: 'PERCENTAGE', value: 10, minOrderAmount: null, maxUses: null,
      usedCount: 0, startsAt: null, endsAt: null, isActive: true, ...overrides,
    });
    const createdData = () => prisma.order.create.mock.calls[0][0].data;

    it('sans réglage, la commande n’a ni frais ni réduction (total = somme des lignes)', async () => {
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 2 }] }));
      expect(createdData()).toMatchObject({ totalAmount: 20000, shippingFee: 0, discountAmount: 0, promoCode: null });
    });

    it('ajoute les frais de livraison à domicile au total', async () => {
      prisma.setting.findFirst.mockResolvedValue({ shippingFee: 1500, freeShippingThreshold: null });
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 1 }] }));
      expect(createdData()).toMatchObject({ totalAmount: 11500, shippingFee: 1500 });
    });

    it('n’ajoute aucun frais pour un retrait en boutique', async () => {
      prisma.setting.findFirst.mockResolvedValue({ shippingFee: 1500, freeShippingThreshold: null });
      prisma.boutique.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
      await service.create(buildDto({ boutiqueId: 'b1' }));
      expect(createdData()).toMatchObject({ totalAmount: 10000, shippingFee: 0 });
    });

    it('offre la livraison au-delà du seuil', async () => {
      prisma.setting.findFirst.mockResolvedValue({ shippingFee: 1500, freeShippingThreshold: 20000 });
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 2 }] }));
      expect(createdData()).toMatchObject({ totalAmount: 20000, shippingFee: 0 });
    });

    it('applique un code promo, garde son texte et consomme une utilisation', async () => {
      promoCodesService.findByCode.mockResolvedValue(promo());
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 2 }], promoCode: ' bienvenue10 ' }));
      expect(createdData()).toMatchObject({ discountAmount: 2000, totalAmount: 18000, promoCode: 'BIENVENUE10' });
      expect(prisma.promoCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'promo-1' },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('le seuil de livraison offerte se calcule APRÈS le code promo', async () => {
      prisma.setting.findFirst.mockResolvedValue({ shippingFee: 1500, freeShippingThreshold: 20000 });
      promoCodesService.findByCode.mockResolvedValue(promo({ value: 10 }));
      await service.create(buildDto({ items: [{ productId: 'prod-1', quantity: 2 }], promoCode: 'BIENVENUE10' }));
      // 20000 - 2000 = 18000 < 20000 : la livraison redevient payante.
      expect(createdData()).toMatchObject({ discountAmount: 2000, shippingFee: 1500, totalAmount: 19500 });
    });

    it('refuse la commande si le code saisi est invalide (le client n’est pas facturé plein tarif à son insu)', async () => {
      promoCodesService.findByCode.mockResolvedValue(null);
      await expect(service.create(buildDto({ promoCode: 'FAUX' }))).rejects.toThrow('n’existe pas');
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });

    it('refuse la commande si le dernier usage du code a été pris entre-temps (consommation atomique)', async () => {
      promoCodesService.findByCode.mockResolvedValue(promo({ maxUses: 1, usedCount: 0 }));
      prisma.promoCode.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.create(buildDto({ promoCode: 'BIENVENUE10' }))).rejects.toThrow('nombre maximal');
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('quote renvoie le même calcul sans rien enregistrer', async () => {
      prisma.setting.findFirst.mockResolvedValue({ shippingFee: 1500, freeShippingThreshold: 30000 });
      promoCodesService.findByCode.mockResolvedValue(promo());
      const res = await inBusiness(() =>
        service.quote({ items: [{ productId: 'prod-1', quantity: 2 }], promoCode: 'bienvenue10' }),
      );
      expect(res).toEqual({
        subtotal: 20000,
        discount: 2000,
        shippingFee: 1500,
        total: 19500,
        freeShippingThreshold: 30000,
        promoCode: { code: 'BIENVENUE10', valid: true, message: null },
      });
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(prisma.promoCode.updateMany).not.toHaveBeenCalled();
    });

    it('quote signale un code refusé sans faire échouer l’aperçu', async () => {
      promoCodesService.findByCode.mockResolvedValue(null);
      const res = await inBusiness(() => service.quote({ items: [{ productId: 'prod-1', quantity: 1 }], promoCode: 'FAUX' }));
      expect(res.discount).toBe(0);
      expect(res.total).toBe(10000);
      expect(res.promoCode).toMatchObject({ code: 'FAUX', valid: false });
    });
  });

  it('n’envoie aucun email quand customerContact est un numéro de téléphone', async () => {
    await service.create(buildDto({ customerContact: '0700000000' }));
    expect(mailService.send).not.toHaveBeenCalled();
  });
});

describe('OrdersService.findByReference', () => {
  it('refuse un contact qui ne correspond pas à celui de la commande (anti-IDOR)', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          reference: 'ABC12345',
          customerContact: 'bon-contact@example.com',
          items: [],
        }),
      },
    };
    const service = new OrdersService(
      prisma as unknown as TenantPrisma,
      {} as PromotionsService,
      {} as NotificationsService,
      {} as MailService,
      {} as PromoCodesService,
      {} as PrismaService,
    );

    await expect(service.findByReference('ABC12345', 'mauvais-contact@example.com')).rejects.toThrow(
      'Aucune commande trouvée avec cette référence et ce contact.',
    );
  });
});

describe('OrdersService.findMineList / findMineOne (historique du client)', () => {
  let service: OrdersService;
  let rawPrisma: { order: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock }; $transaction: jest.Mock };

  beforeEach(() => {
    rawPrisma = {
      order: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    service = new OrdersService(
      {} as TenantPrisma,
      {} as PromotionsService,
      {} as NotificationsService,
      {} as MailService,
      {} as PromoCodesService,
      rawPrisma as unknown as PrismaService,
    );
  });

  it('findMineList interroge le Prisma NON isolé par entreprise, filtré par customerId', async () => {
    await service.findMineList('customer-1', 1, 20);
    const [findManyArgs] = rawPrisma.order.findMany.mock.calls[0];
    expect(findManyArgs.where).toEqual({ customerId: 'customer-1' });
    expect(rawPrisma.order.count).toHaveBeenCalledWith({ where: { customerId: 'customer-1' } });
  });

  it('findMineList résume chaque commande (référence, entreprise, quantité totale)', async () => {
    rawPrisma.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        reference: 'REF1',
        status: 'CONFIRMEE',
        totalAmount: 15000,
        items: [{ quantity: 2 }, { quantity: 1 }],
        business: { name: 'Chez Awa', slug: 'chez-awa' },
        createdAt: new Date('2026-01-01'),
      },
    ]);
    rawPrisma.order.count.mockResolvedValue(1);
    const res = await service.findMineList('customer-1', 1, 20);
    expect(res.data).toEqual([
      {
        id: 'o1',
        reference: 'REF1',
        status: 'CONFIRMEE',
        totalAmount: 15000,
        itemCount: 3,
        business: { name: 'Chez Awa', slug: 'chez-awa' },
        createdAt: new Date('2026-01-01'),
      },
    ]);
    expect(res.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('findMineOne filtre par id ET customerId (impossible de voir la commande d’un autre)', async () => {
    await expect(service.findMineOne('customer-1', 'order-of-someone-else')).rejects.toThrow('Commande introuvable.');
    expect(rawPrisma.order.findFirst.mock.calls[0][0].where).toEqual({ id: 'order-of-someone-else', customerId: 'customer-1' });
  });

  it('findMineOne renvoie le détail complet, avec le nom de l’entreprise', async () => {
    rawPrisma.order.findFirst.mockResolvedValue({
      id: 'o1', reference: 'REF1', status: 'LIVREE', totalAmount: 11500, discountAmount: 1000, shippingFee: 1500,
      promoCode: 'BIENVENUE10', customerAddress: 'Riviera 2', boutique: null,
      business: { name: 'Chez Awa', slug: 'chez-awa', currency: 'XOF' },
      createdAt: new Date('2026-01-01'),
      items: [{ productName: 'Chapeau', unitPrice: 5000, quantity: 2, subtotal: 10000 }],
    });
    const res = await service.findMineOne('customer-1', 'o1');
    expect(res.business).toEqual({ name: 'Chez Awa', slug: 'chez-awa', currency: 'XOF' });
    expect(res.items).toEqual([{ productName: 'Chapeau', unitPrice: 5000, quantity: 2, subtotal: 10000 }]);
    expect(res.discountAmount).toBe(1000);
  });
});
