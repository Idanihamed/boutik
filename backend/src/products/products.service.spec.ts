import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { TenantPrisma } from '../tenancy/tenant-prisma';
import { PromotionsService } from '../promotions/promotions.service';
import { NotificationsService } from '../notifications/notifications.service';

function buildProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-1',
    name: 'Robe wax',
    slug: 'robe-wax',
    sku: 'ROBE-1',
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Robes', slug: 'robes' },
    brand: null,
    shortDescription: null,
    description: null,
    price: 15000,
    promoPrice: null,
    stock: 10,
    lowStockThreshold: 3,
    warranty: null,
    isFeatured: false,
    status: 'PUBLISHED',
    hasVariants: false,
    variantOption1Name: null,
    variantOption2Name: null,
    images: [],
    attributes: [],
    variants: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'var-1',
    productId: 'prod-1',
    option1Value: 'M',
    option2Value: null,
    sku: null,
    price: null,
    promoPrice: null,
    stock: 5,
    image: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ProductsService — variantes', () => {
  let service: ProductsService;
  let prisma: {
    product: { findFirst: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; create: jest.Mock; update: jest.Mock };
    productVariant: { findFirst: jest.Mock; update: jest.Mock; deleteMany: jest.Mock };
    category: { findUnique: jest.Mock };
    brand: { findUnique: jest.Mock };
  };
  let notificationsService: { create: jest.Mock };

  beforeEach(() => {
    prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(null), // pas de conflit de SKU par défaut
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productVariant: {
        findFirst: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
      brand: { findUnique: jest.fn() },
    };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    const promotionsService = { getApplicablePromotionsFor: jest.fn().mockResolvedValue(new Map()) };
    service = new ProductsService(
      prisma as unknown as TenantPrisma,
      promotionsService as unknown as PromotionsService,
      notificationsService as unknown as NotificationsService,
    );
  });

  const baseDto = {
    name: 'Robe wax',
    sku: 'ROBE-1',
    categoryId: 'cat-1',
    price: 15000,
  };

  describe('create — validation des variantes', () => {
    it('refuse hasVariants sans nom de première dimension', async () => {
      await expect(
        service.create({ ...baseDto, hasVariants: true, variants: [{ option1Value: 'M', stock: 5 }] } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse hasVariants sans aucune variante', async () => {
      await expect(
        service.create({ ...baseDto, hasVariants: true, variantOption1Name: 'Taille', variants: [] } as never),
      ).rejects.toThrow('Ajoutez au moins une variante');
    });

    it('refuse deux variantes avec exactement les mêmes valeurs', async () => {
      await expect(
        service.create({
          ...baseDto,
          hasVariants: true,
          variantOption1Name: 'Taille',
          variants: [
            { option1Value: 'M', stock: 5 },
            { option1Value: ' m ', stock: 3 }, // même valeur, casse et espaces différents
          ],
        } as never),
      ).rejects.toThrow('mêmes valeurs');
    });

    it('refuse une valeur pour la 2e dimension si elle n’est pas définie sur le produit', async () => {
      await expect(
        service.create({
          ...baseDto,
          hasVariants: true,
          variantOption1Name: 'Taille',
          variants: [{ option1Value: 'M', option2Value: 'Rouge', stock: 5 }],
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('exige la 2e dimension sur chaque variante si le produit la définit', async () => {
      await expect(
        service.create({
          ...baseDto,
          hasVariants: true,
          variantOption1Name: 'Taille',
          variantOption2Name: 'Couleur',
          variants: [{ option1Value: 'M', stock: 5 }],
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse un prix promo de variante supérieur ou égal à son prix effectif', async () => {
      await expect(
        service.create({
          ...baseDto,
          hasVariants: true,
          variantOption1Name: 'Taille',
          variants: [{ option1Value: 'M', stock: 5, price: 18000, promoPrice: 18000 }],
        } as never),
      ).rejects.toThrow('prix promotionnel');
    });

    it('accepte un produit à variantes valide et crée les lignes attendues', async () => {
      prisma.product.create.mockResolvedValue(buildProduct({ hasVariants: true, variantOption1Name: 'Taille' }));
      await service.create({
        ...baseDto,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [
          { option1Value: 'S', stock: 3 },
          { option1Value: 'M', stock: 5, price: 16000 },
        ],
      } as never);

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.hasVariants).toBe(true);
      expect(data.variants.create).toEqual([
        { option1Value: 'S', option2Value: null, sku: null, price: null, promoPrice: null, stock: 3, image: null, isActive: true, sortOrder: 0 },
        { option1Value: 'M', option2Value: null, sku: null, price: 16000, promoPrice: null, stock: 5, image: null, isActive: true, sortOrder: 1 },
      ]);
    });

    it('un produit SANS variantes n’envoie aucune donnée de variante à Prisma', async () => {
      prisma.product.create.mockResolvedValue(buildProduct());
      await service.create({ ...baseDto } as never);
      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data.hasVariants).toBe(false);
      expect(data.variants).toBeUndefined();
    });
  });

  describe('update — activation, remplacement et désactivation des variantes', () => {
    it('refuse d’activer les variantes sans fournir de tableau de variantes', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct());
      await expect(service.update('prod-1', { hasVariants: true } as never)).rejects.toThrow(
        'Ajoutez au moins une variante',
      );
    });

    it('remplace entièrement les anciennes variantes par les nouvelles', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(buildProduct({ hasVariants: true, variantOption1Name: 'Taille', variants: [buildVariant()] }))
        .mockResolvedValueOnce(undefined as never);
      prisma.product.update.mockResolvedValue(buildProduct({ hasVariants: true, variantOption1Name: 'Taille' }));

      await service.update('prod-1', {
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [{ option1Value: 'L', stock: 2 }],
      } as never);

      expect(prisma.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data.variants.create).toEqual([
        { option1Value: 'L', option2Value: null, sku: null, price: null, promoPrice: null, stock: 2, image: null, isActive: true, sortOrder: 0 },
      ]);
    });

    it('un tableau de variantes ABSENT ne touche à rien (comme pour les images/attributs)', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true, variantOption1Name: 'Taille', variants: [buildVariant()] }));
      prisma.product.update.mockResolvedValue(buildProduct({ hasVariants: true, variantOption1Name: 'Taille' }));

      await service.update('prod-1', { name: 'Robe wax (v2)' } as never);

      expect(prisma.productVariant.deleteMany).not.toHaveBeenCalled();
    });

    it('repasser à « sans variantes » efface les anciennes lignes même sans nouveau tableau', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true, variantOption1Name: 'Taille', variants: [buildVariant()] }));
      prisma.product.update.mockResolvedValue(buildProduct());

      await service.update('prod-1', { hasVariants: false } as never);

      expect(prisma.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 'prod-1' } });
      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data.hasVariants).toBe(false);
      expect(data.variantOption1Name).toBeNull();
    });
  });

  describe('adjustStock / adjustVariantStock', () => {
    it('adjustStock refuse un produit à variantes (redirige vers le stock par variante)', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true }));
      await expect(service.adjustStock('prod-1', 5)).rejects.toThrow('variantes');
    });

    it('adjustVariantStock refuse un produit SANS variantes', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: false }));
      await expect(service.adjustVariantStock('prod-1', 'var-1', 5)).rejects.toThrow(BadRequestException);
    });

    it('adjustVariantStock refuse une variante qui n’appartient pas à ce produit', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true }));
      prisma.productVariant.findFirst.mockResolvedValue(null);
      await expect(service.adjustVariantStock('prod-1', 'var-x', 5)).rejects.toThrow(NotFoundException);
    });

    it('adjustVariantStock ajuste uniquement le stock de la variante, jamais celui du produit', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true }));
      prisma.productVariant.findFirst.mockResolvedValue(buildVariant({ stock: 5 }));
      prisma.product.findUniqueOrThrow.mockResolvedValue(buildProduct({ hasVariants: true, variants: [buildVariant({ stock: 8 })] }));

      await service.adjustVariantStock('prod-1', 'var-1', 3);

      expect(prisma.productVariant.update).toHaveBeenCalledWith({ where: { id: 'var-1' }, data: { stock: 8 } });
    });

    it('adjustVariantStock ne descend jamais sous zéro', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true }));
      prisma.productVariant.findFirst.mockResolvedValue(buildVariant({ stock: 2 }));
      prisma.product.findUniqueOrThrow.mockResolvedValue(buildProduct({ hasVariants: true }));

      await service.adjustVariantStock('prod-1', 'var-1', -10);

      expect(prisma.productVariant.update).toHaveBeenCalledWith({ where: { id: 'var-1' }, data: { stock: 0 } });
    });

    it('alerte quand une variante passe en rupture, avec son étiquette dans le message', async () => {
      prisma.product.findUnique.mockResolvedValue(buildProduct({ hasVariants: true, lowStockThreshold: 3 }));
      prisma.productVariant.findFirst.mockResolvedValue(buildVariant({ stock: 2 }));
      prisma.product.findUniqueOrThrow.mockResolvedValue(buildProduct({ hasVariants: true }));

      await service.adjustVariantStock('prod-1', 'var-1', -2);

      expect(notificationsService.create).toHaveBeenCalledWith(
        'OUT_OF_STOCK',
        expect.stringContaining('Robe wax (M)'),
        '/espace/produits/prod-1',
      );
    });
  });
});
