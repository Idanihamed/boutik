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
 * Alertes sur téléphone : quand un client passe commande, seuls les téléphones des membres de CETTE
 * entreprise autorisés à voir les commandes reçoivent l'alerte, et l'envoi ne bloque jamais la commande.
 */
describe('Notifications sur téléphone (e2e)', () => {
  let app: INestApplication;
  let fetchSpy: jest.SpyInstance;
  const server = () => app.getHttpServer();
  const realFetch = global.fetch;

  const tokens = {
    ownerA: `ExponentPushToken[ownera${stamp}]`,
    editorA: `ExponentPushToken[editora${stamp}]`,
    ownerB: `ExponentPushToken[ownerb${stamp}]`,
  };
  let ownerA: { auth: Record<string, string>; slug: string };
  let productId: string;

  async function registerAndLogin(name: string) {
    const email = `${name}-${stamp}@test.local`;
    const slug = `push-${name}-${stamp}`;
    const reg = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: `Responsable ${name}`, email, password: PASSWORD, businessName: `Push ${name} ${stamp}`, slug, country: 'CI' })
      .expect(201);
    const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
    return { auth: bearer(login.body.accessToken), slug, businessId: reg.body.business.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();

    // Deux entreprises validées, chacune avec un téléphone de responsable enregistré.
    const platform = await request(server()).post('/api/auth/login').set(mobile).send(PLATFORM_ADMIN).expect(200);
    const a = await registerAndLogin('a');
    const b = await registerAndLogin('b');
    for (const business of [a, b]) {
      await request(server()).post(`/api/platform/businesses/${business.businessId}/approve`).set(bearer(platform.body.accessToken)).send({}).expect(201);
    }
    ownerA = a;
    await request(server()).post('/api/admin/push-tokens').set(a.auth).send({ token: tokens.ownerA }).expect(201);
    await request(server()).post('/api/admin/push-tokens').set(b.auth).send({ token: tokens.ownerB }).expect(201);

    // Un éditeur de l'entreprise A, qui n'a PAS le droit de voir les commandes.
    const editorEmail = `editor-${stamp}@test.local`;
    await request(server()).post('/api/admin/users').set(a.auth).send({ name: 'Editeur', email: editorEmail, password: PASSWORD, roleName: 'EDITEUR' }).expect(201);
    const editor = await request(server()).post('/api/auth/login').set(mobile).send({ email: editorEmail, password: PASSWORD }).expect(200);
    await request(server()).post('/api/admin/push-tokens').set(bearer(editor.body.accessToken)).send({ token: tokens.editorA }).expect(201);

    const cat = await request(server()).post('/api/admin/categories').set(a.auth).send({ name: 'Divers' }).expect(201);
    const prod = await request(server())
      .post('/api/admin/products')
      .set(a.auth)
      .send({ name: 'Chapeau', sku: 'CH-1', categoryId: cat.body.id, price: 5000, stock: 50, lowStockThreshold: 1, status: 'PUBLISHED' })
      .expect(201);
    productId = prod.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Les requêtes de test passent par supertest (pas par fetch) : seul l'appel vers Expo est intercepté.
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('exp.host')) return { ok: true, json: async () => ({ data: [] }) } as Response;
      return realFetch(input, init);
    });
  });
  afterEach(() => fetchSpy.mockRestore());

  const expoCalls = () => fetchSpy.mock.calls.filter(([url]) => String(url).includes('exp.host'));

  it('refuse un jeton qui n’est pas un jeton Expo', async () => {
    await request(server()).post('/api/admin/push-tokens').set(ownerA.auth).send({ token: 'abc' }).expect(400);
  });

  it('exige d’être connecté pour enregistrer un téléphone', async () => {
    await request(server()).post('/api/admin/push-tokens').send({ token: tokens.ownerA }).expect(401);
  });

  it('alerte le responsable de l’entreprise — et lui seul — quand un client commande', async () => {
    await request(server())
      .post(`/api/b/${ownerA.slug}/orders`)
      .send({ customerName: 'Awa Cliente', customerContact: '0700000000', items: [{ productId, quantity: 1 }] })
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 300)); // l'alerte part sans bloquer la commande
    const calls = expoCalls();
    expect(calls).toHaveLength(1);
    const sent = JSON.parse(calls[0][1]!.body as string) as { to: string; title: string; data: { link: string } }[];
    expect(sent.map((m) => m.to)).toEqual([tokens.ownerA]); // ni l'éditeur, ni l'autre entreprise
    expect(sent[0].title).toBe('Nouvelle commande');
    expect(sent[0].data.link).toBe('/espace/commandes');
  });

  it('la commande réussit même si Expo est injoignable', async () => {
    fetchSpy.mockImplementation(async (input, init) => {
      if (String(input).includes('exp.host')) throw new Error('réseau coupé');
      return realFetch(input, init);
    });
    await request(server())
      .post(`/api/b/${ownerA.slug}/orders`)
      .send({ customerName: 'Awa Cliente', customerContact: '0700000001', items: [{ productId, quantity: 1 }] })
      .expect(201);
    // L'alerte part après la réponse : on la laisse se terminer avant que le test suivant ne compte les envois.
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('un téléphone retiré (déconnexion) ne reçoit plus d’alertes', async () => {
    await request(server()).delete('/api/admin/push-tokens').set(ownerA.auth).send({ token: tokens.ownerA }).expect(200);
    await request(server())
      .post(`/api/b/${ownerA.slug}/orders`)
      .send({ customerName: 'Awa Cliente', customerContact: '0700000002', items: [{ productId, quantity: 1 }] })
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(expoCalls()).toHaveLength(0);
  });
});
