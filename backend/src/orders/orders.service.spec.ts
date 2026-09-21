import { BadRequestException, HttpException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { TenantPrisma } from '../tenancy/tenant-prisma';
import { PromotionsService } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
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
    $transaction: jest.Mock;
  };
  let promotionsService: { getApplicablePromotionsFor: jest.Mock };
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
      // Simule tx.product.updateMany / tx.order.create en réutilisant les mêmes mocks que prisma
      // directement : le comportement testé (compte de lignes affectées) est identique.
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({ product: prisma.product, order: prisma.order }),
      ),
    };
    promotionsService = { getApplicablePromotionsFor: jest.fn().mockResolvedValue(new Map()) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    mailService = { send: jest.fn().mockResolvedValue(undefined) };

    service = new OrdersService(
      prisma as unknown as TenantPrisma,
      promotionsService as unknown as PromotionsService,
      notificationsService as unknown as NotificationsService,
      mailService as unknown as MailService,
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
    );

    await expect(service.findByReference('ABC12345', 'mauvais-contact@example.com')).rejects.toThrow(
      'Aucune commande trouvée avec cette référence et ce contact.',
    );
  });
});
