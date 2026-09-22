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

/**
 * Statistiques de la plateforme : vue d'ensemble réservée à l'administrateur.
 *
 * Les autres suites e2e tournent EN PARALLÈLE sur la même base (voir test/jest-e2e.json, aucun
 * `maxWorkers: 1`) et créent elles aussi des entreprises et des commandes en continu : comparer
 * un total global avant/après serait donc intrinsèquement instable. Les vérifications portent
 * ici uniquement sur des valeurs FILTRÉES par les entreprises créées dans ce test (classement
 * groupé par businessId — immunisé par construction contre l'activité des autres suites).
 */
describe('Statistiques de la plateforme (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  let admin: Record<string, string>;

  async function registerShop(name: string) {
    const email = `stat-${name}-${stamp}@test.local`;
    const slug = `stat-${name}-${stamp}`;
    const reg = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: `Responsable ${name}`, email, password: PASSWORD, businessName: `Stat ${name} ${stamp}`, slug, country: 'CI' })
      .expect(201);
    const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
    return { auth: bearer(login.body.accessToken), slug, id: reg.body.business.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();

    const platformLogin = await request(server()).post('/api/auth/login').set(mobile).send(PLATFORM_ADMIN).expect(200);
    admin = bearer(platformLogin.body.accessToken);
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse l’accès à un compte qui n’est pas administrateur de la plateforme', async () => {
    const shop = await registerShop('perm');
    await request(server()).get('/api/platform/stats').set(shop.auth).expect(403);
    await request(server()).get('/api/platform/stats').expect(401);
  });

  it('a la forme attendue, avec des compteurs cohérents entre eux', async () => {
    const res = await request(server()).get('/api/platform/stats').set(admin).expect(200);
    const { businesses, orders, products, reports, topBusinessesLast30Days } = res.body;

    const sumByStatus = Object.values(businesses.byStatus as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(sumByStatus).toBe(businesses.total);
    expect(orders.last7Days).toBeLessThanOrEqual(orders.last30Days);
    expect(orders.last30Days).toBeLessThanOrEqual(orders.total);
    expect(products.published).toBeLessThanOrEqual(products.total);
    expect(reports.open).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(topBusinessesLast30Days)).toBe(true);
    expect(topBusinessesLast30Days.length).toBeLessThanOrEqual(5);
  });

  it('le classement reflète le nombre de commandes de CHAQUE entreprise, et exclut les annulées', async () => {
    const shopA = await registerShop('a');
    const shopB = await registerShop('b');
    for (const shop of [shopA, shopB]) {
      await request(server()).post(`/api/platform/businesses/${shop.id}/approve`).set(admin).send({}).expect(201);
    }

    const catA = await request(server()).post('/api/admin/categories').set(shopA.auth).send({ name: 'Divers' }).expect(201);
    const prodA = await request(server()).post('/api/admin/products').set(shopA.auth).send({ name: 'Chapeau', sku: 'CH-1', categoryId: catA.body.id, price: 5000, stock: 10, status: 'PUBLISHED' }).expect(201);
    const catB = await request(server()).post('/api/admin/categories').set(shopB.auth).send({ name: 'Divers' }).expect(201);
    const prodB = await request(server()).post('/api/admin/products').set(shopB.auth).send({ name: 'Sac', sku: 'S-1', categoryId: catB.body.id, price: 8000, stock: 10, status: 'PUBLISHED' }).expect(201);

    // 2 commandes chez A, 1 chez B.
    for (let i = 0; i < 2; i++) {
      await request(server()).post(`/api/b/${shopA.slug}/orders`).send({ customerName: 'Client', customerContact: `c${i}@test.local`, items: [{ productId: prodA.body.id, quantity: 1 }] }).expect(201);
    }
    await request(server()).post(`/api/b/${shopB.slug}/orders`).send({ customerName: 'Client', customerContact: 'cb@test.local', items: [{ productId: prodB.body.id, quantity: 1 }] }).expect(201);

    // Une 3e commande chez A, annulée : ne doit pas compter dans le classement.
    const cancelMe = await request(server()).post(`/api/b/${shopA.slug}/orders`).send({ customerName: 'Client', customerContact: 'annule@test.local', items: [{ productId: prodA.body.id, quantity: 1 }] }).expect(201);
    const orderList = await request(server()).get('/api/admin/orders?limit=50').set(shopA.auth).expect(200);
    const target = orderList.body.data.find((o: { reference: string }) => o.reference === cancelMe.body.reference);
    await request(server()).patch(`/api/admin/orders/${target.id}/status`).set(shopA.auth).send({ status: 'ANNULEE' }).expect(200);

    const res = await request(server()).get('/api/platform/stats').set(admin).expect(200);
    const top = res.body.topBusinessesLast30Days;
    const rowA = top.find((r: { slug: string }) => r.slug === shopA.slug);
    const rowB = top.find((r: { slug: string }) => r.slug === shopB.slug);
    expect(rowA).toMatchObject({ name: `Stat a ${stamp}`, orderCount: 2 }); // pas 3 : l'annulée ne compte pas
    expect(rowB).toMatchObject({ name: `Stat b ${stamp}`, orderCount: 1 });
  });

  it('une entreprise encore en attente n’apparaît jamais dans le classement (aucune commande possible)', async () => {
    const shop = await registerShop('pending');
    const res = await request(server()).get('/api/platform/stats').set(admin).expect(200);
    expect(res.body.topBusinessesLast30Days.find((r: { slug: string }) => r.slug === shop.slug)).toBeUndefined();
  });
});
