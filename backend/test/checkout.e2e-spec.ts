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

/** Livraison et codes promo : du réglage du commerçant jusqu'au total facturé au client. */
describe('Livraison et codes promo (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  let a: { auth: Record<string, string>; slug: string; id: string };
  let b: { auth: Record<string, string>; slug: string; id: string };
  let productA: string;
  let boutiqueA: string;

  async function registerAndLogin(name: string) {
    const email = `${name}-${stamp}@test.local`;
    const slug = `co-${name}-${stamp}`;
    const reg = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: `Responsable ${name}`, email, password: PASSWORD, businessName: `Checkout ${name} ${stamp}`, slug, country: 'CI' })
      .expect(201);
    const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
    return { auth: bearer(login.body.accessToken), slug, id: reg.body.business.id as string };
  }

  const quote = (business: { slug: string }, body: Record<string, unknown>) =>
    request(server()).post(`/api/b/${business.slug}/orders/quote`).send(body);
  const order = (business: { slug: string }, body: Record<string, unknown>, contact = '0700000000') =>
    request(server())
      .post(`/api/b/${business.slug}/orders`)
      .send({ customerName: 'Awa Cliente', customerContact: contact, ...body });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();

    const platform = await request(server()).post('/api/auth/login').set(mobile).send(PLATFORM_ADMIN).expect(200);
    a = await registerAndLogin('a');
    b = await registerAndLogin('b');
    for (const business of [a, b]) {
      await request(server()).post(`/api/platform/businesses/${business.id}/approve`).set(bearer(platform.body.accessToken)).send({}).expect(201);
    }

    const cat = await request(server()).post('/api/admin/categories').set(a.auth).send({ name: 'Divers' }).expect(201);
    const prod = await request(server())
      .post('/api/admin/products')
      .set(a.auth)
      .send({ name: 'Chapeau', sku: 'CH-1', categoryId: cat.body.id, price: 10000, stock: 100, lowStockThreshold: 1, status: 'PUBLISHED' })
      .expect(201);
    productA = prod.body.id;
    const boutique = await request(server()).post('/api/admin/boutiques').set(a.auth).send({ name: 'Retrait', address: 'Rue du Marché' }).expect(201);
    boutiqueA = boutique.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sans réglage : ni livraison ni réduction', async () => {
    const res = await quote(a, { items: [{ productId: productA, quantity: 2 }] }).expect(201);
    expect(res.body).toMatchObject({ subtotal: 20000, discount: 0, shippingFee: 0, total: 20000, promoCode: null });
  });

  describe('frais de livraison', () => {
    it('le commerçant règle ses frais et le seuil de livraison offerte', async () => {
      await request(server()).patch('/api/admin/settings').set(a.auth).send({ shippingFee: 1500, freeShippingThreshold: 30000 }).expect(200);
      const store = await request(server()).get(`/api/b/${a.slug}`).expect(200);
      expect(store.body.settings).toMatchObject({ shippingFee: 1500, freeShippingThreshold: 30000 });
    });

    it('refuse des montants négatifs ou décimaux', async () => {
      await request(server()).patch('/api/admin/settings').set(a.auth).send({ shippingFee: -5 }).expect(400);
      await request(server()).patch('/api/admin/settings').set(a.auth).send({ shippingFee: 12.5 }).expect(400);
    });

    it('facture la livraison à domicile, l’offre au seuil, et jamais pour un retrait', async () => {
      const small = await quote(a, { items: [{ productId: productA, quantity: 1 }] }).expect(201);
      expect(small.body).toMatchObject({ subtotal: 10000, shippingFee: 1500, total: 11500 });

      const big = await quote(a, { items: [{ productId: productA, quantity: 3 }] }).expect(201);
      expect(big.body).toMatchObject({ subtotal: 30000, shippingFee: 0, total: 30000 });

      const pickup = await quote(a, { items: [{ productId: productA, quantity: 1 }], boutiqueId: boutiqueA }).expect(201);
      expect(pickup.body).toMatchObject({ shippingFee: 0, total: 10000 });
    });

    it('la commande réelle facture exactement le montant de l’aperçu, et le suivi détaille le total', async () => {
      const preview = await quote(a, { items: [{ productId: productA, quantity: 1 }] }).expect(201);
      const created = await order(a, { items: [{ productId: productA, quantity: 1 }] }, 'suivi@example.com').expect(201);
      expect(created.body.totalAmount).toBe(preview.body.total);

      const tracking = await request(server()).get(`/api/b/${a.slug}/orders/suivi/${created.body.reference}?contact=suivi@example.com`).expect(200);
      expect(tracking.body).toMatchObject({ totalAmount: 11500, shippingFee: 1500, discountAmount: 0, promoCode: null });

      const admin = await request(server()).get('/api/admin/orders?limit=50').set(a.auth).expect(200);
      const row = admin.body.data.find((o: { reference: string }) => o.reference === created.body.reference);
      expect(row).toMatchObject({ totalAmount: 11500, shippingFee: 1500 });
    });
  });

  describe('codes promo', () => {
    let tenPercent: string;

    it('le commerçant crée un code (enregistré en majuscules) ; un doublon est refusé', async () => {
      const res = await request(server())
        .post('/api/admin/promo-codes')
        .set(a.auth)
        .send({ code: 'bienvenue10', type: 'PERCENTAGE', value: 10, maxUses: 2 })
        .expect(201);
      expect(res.body).toMatchObject({ code: 'BIENVENUE10', usedCount: 0, isActive: true });
      tenPercent = res.body.id;
      await request(server()).post('/api/admin/promo-codes').set(a.auth).send({ code: 'BIENVENUE10', type: 'FIXED_AMOUNT', value: 500 }).expect(409);
    });

    it('refuse un code mal formé ou un pourcentage au-dessus de 100', async () => {
      await request(server()).post('/api/admin/promo-codes').set(a.auth).send({ code: 'a b', type: 'FIXED_AMOUNT', value: 500 }).expect(400);
      await request(server()).post('/api/admin/promo-codes').set(a.auth).send({ code: 'TROPFORT', type: 'PERCENTAGE', value: 150 }).expect(400);
      await request(server()).post('/api/admin/promo-codes').set(a.auth).send({ code: 'DATES', type: 'FIXED_AMOUNT', value: 500, startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' }).expect(400);
    });

    it('l’aperçu applique le code sans tenir compte de la casse', async () => {
      const res = await quote(a, { items: [{ productId: productA, quantity: 2 }], promoCode: '  bienvenue10 ' }).expect(201);
      expect(res.body).toMatchObject({
        subtotal: 20000,
        discount: 2000,
        shippingFee: 1500, // 18000 < seuil de 30000
        total: 19500,
        promoCode: { code: 'BIENVENUE10', valid: true, message: null },
      });
    });

    it('l’aperçu explique pourquoi un code est refusé, sans échouer', async () => {
      const res = await quote(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'INCONNU' }).expect(201);
      expect(res.body.discount).toBe(0);
      expect(res.body.promoCode).toMatchObject({ code: 'INCONNU', valid: false });
      expect(res.body.promoCode.message).toContain('n’existe pas');
    });

    it('un code réservé à un montant minimum le dit clairement', async () => {
      await request(server()).post('/api/admin/promo-codes').set(a.auth).send({ code: 'GROS', type: 'FIXED_AMOUNT', value: 3000, minOrderAmount: 25000 }).expect(201);
      const low = await quote(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'GROS' }).expect(201);
      expect(low.body.promoCode).toMatchObject({ valid: false });
      expect(low.body.promoCode.message).toContain('25');
      const ok = await quote(a, { items: [{ productId: productA, quantity: 3 }], promoCode: 'GROS' }).expect(201);
      expect(ok.body).toMatchObject({ discount: 3000, shippingFee: 1500, total: 28500 }); // 27000 après rabais < seuil de 30000
    });

    it('une commande avec code enregistre la réduction et consomme une utilisation ; le total suit l’aperçu', async () => {
      const preview = await quote(a, { items: [{ productId: productA, quantity: 2 }], promoCode: 'BIENVENUE10' }).expect(201);
      const created = await order(a, { items: [{ productId: productA, quantity: 2 }], promoCode: 'bienvenue10' }, 'promo1@example.com').expect(201);
      expect(created.body.totalAmount).toBe(preview.body.total);

      const tracking = await request(server()).get(`/api/b/${a.slug}/orders/suivi/${created.body.reference}?contact=promo1@example.com`).expect(200);
      expect(tracking.body).toMatchObject({ discountAmount: 2000, promoCode: 'BIENVENUE10', totalAmount: 19500 });

      const list = await request(server()).get('/api/admin/promo-codes').set(a.auth).expect(200);
      expect(list.body.find((c: { id: string }) => c.id === tenPercent).usedCount).toBe(1);
    });

    it('une commande avec un code invalide est refusée et ne retire rien du stock', async () => {
      const before = await request(server()).get(`/api/admin/products/${productA}`).set(a.auth).expect(200);
      await order(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'INCONNU' }).expect(400);
      const after = await request(server()).get(`/api/admin/products/${productA}`).set(a.auth).expect(200);
      expect(after.body.stock).toBe(before.body.stock);
    });

    it('un code limité à 2 utilisations est refusé à la troisième', async () => {
      await order(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'BIENVENUE10' }, 'promo2@example.com').expect(201);
      const third = await order(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'BIENVENUE10' }, 'promo3@example.com').expect(400);
      expect(third.body.message).toContain('nombre maximal');
      const preview = await quote(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'BIENVENUE10' }).expect(201);
      expect(preview.body.promoCode.valid).toBe(false);
    });

    it('le commerçant peut désactiver un code : il n’est plus accepté', async () => {
      const created = await request(server()).post('/api/admin/promo-codes').set(a.auth).send({ code: 'ETE', type: 'FIXED_AMOUNT', value: 1000 }).expect(201);
      await quote(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'ETE' }).expect((r) => expect(r.body.promoCode.valid).toBe(true));
      await request(server()).patch(`/api/admin/promo-codes/${created.body.id}`).set(a.auth).send({ isActive: false }).expect(200);
      await quote(a, { items: [{ productId: productA, quantity: 1 }], promoCode: 'ETE' }).expect((r) => expect(r.body.promoCode.valid).toBe(false));
      await request(server()).delete(`/api/admin/promo-codes/${created.body.id}`).set(a.auth).expect(200);
    });
  });

  describe('isolation et droits', () => {
    it('les codes d’une entreprise sont invisibles et inutilisables par une autre', async () => {
      const list = await request(server()).get('/api/admin/promo-codes').set(b.auth).expect(200);
      expect(list.body).toEqual([]);

      const cat = await request(server()).post('/api/admin/categories').set(b.auth).send({ name: 'Divers' }).expect(201);
      const prod = await request(server())
        .post('/api/admin/products')
        .set(b.auth)
        .send({ name: 'Sac', sku: 'S-1', categoryId: cat.body.id, price: 10000, stock: 10, status: 'PUBLISHED' })
        .expect(201);
      const res = await quote(b, { items: [{ productId: prod.body.id, quantity: 1 }], promoCode: 'GROS' }).expect(201);
      expect(res.body.promoCode.valid).toBe(false);
      expect(res.body.shippingFee).toBe(0); // les frais de A ne s'appliquent pas à B
    });

    it('un éditeur (sans droit sur les promotions) ne peut pas gérer les codes', async () => {
      const email = `editor-${stamp}@test.local`;
      await request(server()).post('/api/admin/users').set(a.auth).send({ name: 'Editeur', email, password: PASSWORD, roleName: 'EDITEUR' }).expect(201);
      const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
      const editor = bearer(login.body.accessToken);
      await request(server()).get('/api/admin/promo-codes').set(editor).expect(403);
      await request(server()).post('/api/admin/promo-codes').set(editor).send({ code: 'PIRATE', type: 'PERCENTAGE', value: 90 }).expect(403);
    });

    it('exige une connexion pour gérer les codes', async () => {
      await request(server()).get('/api/admin/promo-codes').expect(401);
    });

    it('l’aperçu refuse un panier vide ou un produit inexistant', async () => {
      await quote(a, { items: [] }).expect(400);
      await quote(a, { items: [{ productId: 'inexistant', quantity: 1 }] }).expect(400);
    });
  });
});
