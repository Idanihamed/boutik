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
 * Historique des commandes d'un client (« Mes commandes ») : une commande passée connecté
 * rejoint l'historique du compte, toutes entreprises confondues ; un achat invité n'y figure
 * jamais ; un client ne voit jamais la commande d'un autre.
 */
describe('Mes commandes — historique client (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  let shopA: { auth: Record<string, string>; slug: string };
  let shopB: { auth: Record<string, string>; slug: string };
  let productA: string;
  let productB: string;
  let customer: { email: string; auth: Record<string, string> };

  async function registerShop(name: string) {
    const email = `owner-${name}-${stamp}@test.local`;
    const slug = `mo-${name}-${stamp}`;
    const reg = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: `Responsable ${name}`, email, password: PASSWORD, businessName: `Mo ${name} ${stamp}`, slug, country: 'CI' })
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
    const a = await registerShop('a');
    const b = await registerShop('b');
    for (const shop of [a, b]) {
      await request(server()).post(`/api/platform/businesses/${shop.id}/approve`).set(bearer(platform.body.accessToken)).send({}).expect(201);
    }
    shopA = a;
    shopB = b;

    const catA = await request(server()).post('/api/admin/categories').set(a.auth).send({ name: 'Divers' }).expect(201);
    const prodA = await request(server()).post('/api/admin/products').set(a.auth).send({ name: 'Chapeau', sku: 'CH-1', categoryId: catA.body.id, price: 5000, stock: 10, status: 'PUBLISHED' }).expect(201);
    productA = prodA.body.id;

    const catB = await request(server()).post('/api/admin/categories').set(b.auth).send({ name: 'Divers' }).expect(201);
    const prodB = await request(server()).post('/api/admin/products').set(b.auth).send({ name: 'Sac', sku: 'S-1', categoryId: catB.body.id, price: 8000, stock: 10, status: 'PUBLISHED' }).expect(201);
    productB = prodB.body.id;

    // Un compte client (rôle CUSTOMER, pas rattaché à une entreprise).
    const email = `client-${stamp}@test.local`;
    await request(server()).post('/api/auth/register').send({ name: 'Awa Cliente', email, password: PASSWORD }).expect(201);
    const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
    customer = { email, auth: bearer(login.body.accessToken) };
  });

  afterAll(async () => {
    await app.close();
  });

  it('sans être connecté, l’historique est refusé', async () => {
    await request(server()).get('/api/mes-commandes').expect(401);
  });

  it('un client connecté qui n’a jamais commandé a un historique vide', async () => {
    const res = await request(server()).get('/api/mes-commandes').set(customer.auth).expect(200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } });
  });

  it('une commande passée CONNECTÉ rejoint l’historique du compte', async () => {
    await request(server())
      .post(`/api/b/${shopA.slug}/orders`)
      .set(customer.auth)
      .send({ customerName: 'Awa Cliente', customerContact: 'awa@test.local', items: [{ productId: productA, quantity: 1 }] })
      .expect(201);

    const res = await request(server()).get('/api/mes-commandes').set(customer.auth).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ business: { name: `Mo a ${stamp}`, slug: shopA.slug }, totalAmount: 5000, itemCount: 1 });
  });

  it('une commande passée dans une AUTRE entreprise s’ajoute au même historique', async () => {
    await request(server())
      .post(`/api/b/${shopB.slug}/orders`)
      .set(customer.auth)
      .send({ customerName: 'Awa Cliente', customerContact: 'awa@test.local', items: [{ productId: productB, quantity: 1 }] })
      .expect(201);

    const res = await request(server()).get('/api/mes-commandes').set(customer.auth).expect(200);
    expect(res.body.meta.total).toBe(2);
    const slugs = res.body.data.map((o: { business: { slug: string } }) => o.business.slug).sort();
    expect(slugs).toEqual([shopA.slug, shopB.slug].sort());
  });

  it('une commande passée SANS être connecté (achat invité) n’apparaît dans aucun historique', async () => {
    await request(server())
      .post(`/api/b/${shopA.slug}/orders`)
      .send({ customerName: 'Client Invité', customerContact: 'invite@test.local', items: [{ productId: productA, quantity: 1 }] })
      .expect(201);

    const res = await request(server()).get('/api/mes-commandes').set(customer.auth).expect(200);
    expect(res.body.meta.total).toBe(2); // toujours 2, l'achat invité n'est rattaché à personne
  });

  it('un membre du personnel (OWNER) n’a pas d’historique client, même connecté', async () => {
    const res = await request(server()).get('/api/mes-commandes').set(shopA.auth).expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('le détail d’une commande donne le nom de l’entreprise et la répartition du total', async () => {
    const list = await request(server()).get('/api/mes-commandes').set(customer.auth).expect(200);
    const target = list.body.data.find((o: { business: { slug: string } }) => o.business.slug === shopA.slug);

    const detail = await request(server()).get(`/api/mes-commandes/${target.id}`).set(customer.auth).expect(200);
    expect(detail.body).toMatchObject({ business: { name: `Mo a ${stamp}`, slug: shopA.slug }, totalAmount: 5000 });
    expect(detail.body.items).toEqual([{ productName: 'Chapeau', unitPrice: 5000, quantity: 1, subtotal: 5000 }]);
  });

  it('un client ne peut jamais consulter la commande d’un AUTRE client (IDOR)', async () => {
    const list = await request(server()).get('/api/mes-commandes').set(customer.auth).expect(200);
    const someOrderId = list.body.data[0].id;

    const email2 = `client2-${stamp}@test.local`;
    await request(server()).post('/api/auth/register').send({ name: 'Autre Cliente', email: email2, password: PASSWORD }).expect(201);
    const login2 = await request(server()).post('/api/auth/login').set(mobile).send({ email: email2, password: PASSWORD }).expect(200);

    await request(server()).get(`/api/mes-commandes/${someOrderId}`).set(bearer(login2.body.accessToken)).expect(404);
  });

  it('refuse un identifiant de commande inexistant', async () => {
    await request(server()).get('/api/mes-commandes/inexistant').set(customer.auth).expect(404);
  });
});
