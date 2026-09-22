import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PLATFORM_ADMIN } from './test-config';

const stamp = Date.now().toString(36);
const PASSWORD = 'MotDePasse-Solide-1';
const mobile = { 'X-Client': 'mobile' };
const bearer = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

/** Variantes de produit (taille, couleur...) : du back-office jusqu'à la commande d'un client. */
describe('Variantes de produit (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  let shopA: { auth: Record<string, string>; slug: string; id: string };
  let shopB: { auth: Record<string, string>; slug: string; id: string };
  let categoryId: string;
  let categoryIdB: string;

  async function registerShop(name: string) {
    const email = `variant-${name}-${stamp}@test.local`;
    const slug = `variant-${name}-${stamp}`;
    const reg = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: `Responsable ${name}`, email, password: PASSWORD, businessName: `Variant ${name} ${stamp}`, slug, country: 'CI' })
      .expect(201);
    const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
    return { auth: bearer(login.body.accessToken), slug, id: reg.body.business.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();

    const platform = await request(server()).post('/api/auth/login').set(mobile).send(PLATFORM_ADMIN).expect(200);
    shopA = await registerShop('a');
    shopB = await registerShop('b');
    for (const shop of [shopA, shopB]) {
      await request(server()).post(`/api/platform/businesses/${shop.id}/approve`).set(bearer(platform.body.accessToken)).send({}).expect(201);
    }
    const cat = await request(server()).post('/api/admin/categories').set(shopA.auth).send({ name: 'Robes' }).expect(201);
    categoryId = cat.body.id;
    const catB = await request(server()).post('/api/admin/categories').set(shopB.auth).send({ name: 'Robes' }).expect(201);
    categoryIdB = catB.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const createProduct = (auth: Record<string, string>, body: Record<string, unknown>) =>
    request(server()).post('/api/admin/products').set(auth).send({ categoryId, status: 'PUBLISHED', ...body });

  describe('création et validation', () => {
    it('refuse hasVariants sans nom de dimension', async () => {
      await createProduct(shopA.auth, {
        name: 'Robe sans dimension',
        sku: `RSD-${stamp}`,
        price: 15000,
        hasVariants: true,
        variants: [{ option1Value: 'M', stock: 5 }],
      }).expect(400);
    });

    it('refuse deux variantes identiques', async () => {
      await createProduct(shopA.auth, {
        name: 'Robe doublon',
        sku: `RDB-${stamp}`,
        price: 15000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [
          { option1Value: 'M', stock: 5 },
          { option1Value: 'M', stock: 3 },
        ],
      }).expect(400);
    });

    it('crée un produit à deux dimensions (Taille × Couleur) avec des prix par variante', async () => {
      const res = await createProduct(shopA.auth, {
        name: 'Robe wax deux dimensions',
        sku: `RW2D-${stamp}`,
        price: 15000,
        promoPrice: 12000,
        lowStockThreshold: 2,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variantOption2Name: 'Couleur',
        variants: [
          { option1Value: 'M', option2Value: 'Rouge', stock: 4 },
          { option1Value: 'M', option2Value: 'Bleu', stock: 0 },
          { option1Value: 'L', option2Value: 'Rouge', stock: 6, price: 17000 },
        ],
      }).expect(201);

      expect(res.body.hasVariants).toBe(true);
      expect(res.body.variants).toHaveLength(3);
      const rouge = res.body.variants.find((v: { option1Value: string; option2Value: string }) => v.option1Value === 'M' && v.option2Value === 'Rouge');
      expect(rouge).toMatchObject({ label: 'M · Rouge', price: 15000, promoPrice: 12000, effectivePrice: 12000, onSale: true, stock: 4, stockStatus: 'DISPONIBLE' });
      const bleu = res.body.variants.find((v: { option2Value: string }) => v.option2Value === 'Bleu');
      expect(bleu).toMatchObject({ stock: 0, stockStatus: 'RUPTURE' });
      const grande = res.body.variants.find((v: { option1Value: string }) => v.option1Value === 'L');
      // Prix propre à la variante : le promo du PRODUIT (calculé pour 15000) ne s'applique pas.
      expect(grande).toMatchObject({ price: 17000, promoPrice: null, effectivePrice: 17000, onSale: false });

      // Le produit agrège : stock total = 4 + 0 + 6 = 10.
      expect(res.body.stock).toBe(10);
      expect(res.body.stockStatus).toBe('DISPONIBLE');
    });
  });

  describe('vitrine publique et commande', () => {
    let productId: string;
    let variantM: string;
    let variantL: string;

    beforeAll(async () => {
      const res = await createProduct(shopA.auth, {
        name: 'Robe wax fleurie',
        sku: `RWF-${stamp}`,
        price: 15000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [
          { option1Value: 'M', stock: 3 },
          { option1Value: 'L', stock: 1 },
        ],
      }).expect(201);
      productId = res.body.id;
      variantM = res.body.variants.find((v: { option1Value: string }) => v.option1Value === 'M').id;
      variantL = res.body.variants.find((v: { option1Value: string }) => v.option1Value === 'L').id;
    });

    it('la fiche publique expose les variantes actives avec leur propre stock', async () => {
      const res = await request(server()).get(`/api/b/${shopA.slug}/products/robe-wax-fleurie`).expect(200);
      expect(res.body.product.variants).toHaveLength(2);
      expect(res.body.product.variants.map((v: { label: string }) => v.label).sort()).toEqual(['L', 'M']);
    });

    it('refuse une commande sur ce produit sans préciser de variante', async () => {
      const res = await request(server())
        .post(`/api/b/${shopA.slug}/orders`)
        .send({ customerName: 'Client', customerContact: 'c1@test.local', items: [{ productId, quantity: 1 }] });
      expect(res.status).toBe(400);
    });

    it('refuse une commande avec une variante d’une AUTRE entreprise (IDOR)', async () => {
      const other = await createProduct(shopB.auth, {
        name: 'Autre robe',
        sku: `AR-${stamp}`,
        categoryId: categoryIdB,
        price: 9000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [{ option1Value: 'M', stock: 5 }],
      }).expect(201);
      const foreignVariantId = other.body.variants[0].id;

      await request(server())
        .post(`/api/b/${shopA.slug}/orders`)
        .send({ customerName: 'Client', customerContact: 'c2@test.local', items: [{ productId, variantId: foreignVariantId, quantity: 1 }] })
        .expect(400);
    });

    it('accepte deux lignes du même produit avec des tailles différentes, et facture le bon total', async () => {
      const quote = await request(server())
        .post(`/api/b/${shopA.slug}/orders/quote`)
        .send({ items: [{ productId, variantId: variantM, quantity: 2 }, { productId, variantId: variantL, quantity: 1 }] })
        .expect(201);
      expect(quote.body.subtotal).toBe(15000 * 3);

      const order = await request(server())
        .post(`/api/b/${shopA.slug}/orders`)
        .send({
          customerName: 'Awa Cliente',
          customerContact: 'awa@test.local',
          items: [
            { productId, variantId: variantM, quantity: 2 },
            { productId, variantId: variantL, quantity: 1 },
          ],
        })
        .expect(201);
      expect(order.body.totalAmount).toBe(45000);

      const tracking = await request(server())
        .get(`/api/b/${shopA.slug}/orders/suivi/${order.body.reference}?contact=awa@test.local`)
        .expect(200);
      const names = tracking.body.items.map((i: { productName: string }) => i.productName).sort();
      expect(names).toEqual(['Robe wax fleurie · L', 'Robe wax fleurie · M']);
    });

    it('le stock de chaque variante a baissé séparément, jamais le stock (inutilisé) du produit', async () => {
      const res = await request(server()).get(`/api/admin/products/${productId}`).set(shopA.auth).expect(200);
      const m = res.body.variants.find((v: { id: string }) => v.id === variantM);
      const l = res.body.variants.find((v: { id: string }) => v.id === variantL);
      expect(m.stock).toBe(1); // 3 - 2
      expect(l.stock).toBe(0); // 1 - 1
      expect(res.body.stock).toBe(1); // agrégé : 1 + 0
    });

    it('refuse une commande dépassant le stock de la variante (même si le produit en aurait assez au total)', async () => {
      await request(server())
        .post(`/api/b/${shopA.slug}/orders`)
        .send({ customerName: 'Client', customerContact: 'c3@test.local', items: [{ productId, variantId: variantL, quantity: 1 }] })
        .expect(400); // L n'a plus que 0 en stock
    });

    it('adjustStock (produit) est refusé pour un produit à variantes', async () => {
      await request(server()).patch(`/api/admin/products/${productId}/stock`).set(shopA.auth).send({ delta: 5 }).expect(400);
    });

    it('réapprovisionne UNE variante via la route dédiée, sans toucher aux autres', async () => {
      const res = await request(server())
        .patch(`/api/admin/products/${productId}/variants/${variantM}/stock`)
        .set(shopA.auth)
        .send({ delta: 5 })
        .expect(200);
      const m = res.body.variants.find((v: { id: string }) => v.id === variantM);
      const l = res.body.variants.find((v: { id: string }) => v.id === variantL);
      expect(m.stock).toBe(6); // 1 + 5
      expect(l.stock).toBe(0); // inchangé
    });

    it('refuse d’ajuster le stock d’une variante avec l’identifiant d’une autre entreprise', async () => {
      await request(server())
        .patch(`/api/admin/products/${productId}/variants/${variantM}/stock`)
        .set(shopB.auth)
        .send({ delta: 100 })
        .expect(404);
    });
  });

  describe('désactivation, annulation et duplication', () => {
    it('une variante désactivée disparaît de la vitrine mais reste visible en back-office', async () => {
      const created = await createProduct(shopA.auth, {
        name: 'Robe désactivable',
        sku: `RDS-${stamp}`,
        price: 10000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [
          { option1Value: 'S', stock: 2 },
          { option1Value: 'M', stock: 2 },
        ],
      }).expect(201);
      const sId = created.body.variants.find((v: { option1Value: string }) => v.option1Value === 'S').id;

      await request(server())
        .patch(`/api/admin/products/${created.body.id}`)
        .set(shopA.auth)
        .send({
          hasVariants: true,
          variantOption1Name: 'Taille',
          variants: [
            { option1Value: 'S', stock: 2, isActive: false },
            { option1Value: 'M', stock: 2 },
          ],
        })
        .expect(200);

      const pub = await request(server()).get(`/api/b/${shopA.slug}/products/robe-desactivable`).expect(200);
      expect(pub.body.product.variants).toHaveLength(1);
      expect(pub.body.product.variants[0].option1Value).toBe('M');

      const admin = await request(server()).get(`/api/admin/products/${created.body.id}`).set(shopA.auth).expect(200);
      expect(admin.body.variants).toHaveLength(2);
      void sId;
    });

    it('annuler puis réactiver une commande restaure exactement le stock de la bonne variante', async () => {
      const created = await createProduct(shopA.auth, {
        name: 'Robe annulable',
        sku: `RAN-${stamp}`,
        price: 8000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [{ option1Value: 'M', stock: 5 }],
      }).expect(201);
      const variantId = created.body.variants[0].id;

      const order = await request(server())
        .post(`/api/b/${shopA.slug}/orders`)
        .send({ customerName: 'Client', customerContact: 'c4@test.local', items: [{ productId: created.body.id, variantId, quantity: 2 }] })
        .expect(201);
      const list = await request(server()).get('/api/admin/orders?limit=50').set(shopA.auth).expect(200);
      const orderRow = list.body.data.find((o: { reference: string }) => o.reference === order.body.reference);

      let product = await request(server()).get(`/api/admin/products/${created.body.id}`).set(shopA.auth).expect(200);
      expect(product.body.variants[0].stock).toBe(3); // 5 - 2

      await request(server()).patch(`/api/admin/orders/${orderRow.id}/status`).set(shopA.auth).send({ status: 'ANNULEE' }).expect(200);
      product = await request(server()).get(`/api/admin/products/${created.body.id}`).set(shopA.auth).expect(200);
      expect(product.body.variants[0].stock).toBe(5); // restocké

      await request(server()).patch(`/api/admin/orders/${orderRow.id}/status`).set(shopA.auth).send({ status: 'EN_ATTENTE' }).expect(200);
      product = await request(server()).get(`/api/admin/products/${created.body.id}`).set(shopA.auth).expect(200);
      expect(product.body.variants[0].stock).toBe(3); // re-décrémenté
    });

    it('dupliquer un produit à variantes copie les variantes avec un stock remis à zéro', async () => {
      const created = await createProduct(shopA.auth, {
        name: 'Robe à dupliquer',
        sku: `RDP-${stamp}`,
        price: 10000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [
          { option1Value: 'S', stock: 4 },
          { option1Value: 'M', stock: 6 },
        ],
      }).expect(201);

      const copy = await request(server()).post(`/api/admin/products/${created.body.id}/duplicate`).set(shopA.auth).expect(201);
      expect(copy.body.hasVariants).toBe(true);
      expect(copy.body.variants).toHaveLength(2);
      expect(copy.body.variants.every((v: { stock: number }) => v.stock === 0)).toBe(true);
      expect(copy.body.status).toBe('DRAFT');
    });

    it('repasser un produit à variantes vers « sans variantes » efface ses variantes', async () => {
      const created = await createProduct(shopA.auth, {
        name: 'Robe reconvertie',
        sku: `RRC-${stamp}`,
        price: 10000,
        hasVariants: true,
        variantOption1Name: 'Taille',
        variants: [{ option1Value: 'M', stock: 3 }],
      }).expect(201);

      const updated = await request(server())
        .patch(`/api/admin/products/${created.body.id}`)
        .set(shopA.auth)
        .send({ hasVariants: false })
        .expect(200);
      expect(updated.body.hasVariants).toBe(false);
      expect(updated.body.variants).toEqual([]);
      expect(updated.body.stock).toBe(0); // le champ stock du produit, jamais utilisé pendant hasVariants=true
    });
  });
});
