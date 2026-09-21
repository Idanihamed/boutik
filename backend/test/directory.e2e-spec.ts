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

/** Annuaire public : seules les entreprises validées AVEC au moins un produit publié y figurent. */
describe('Annuaire des entreprises (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  const names = { shop: `Annuaire Boutique ${stamp}`, empty: `Annuaire Vide ${stamp}`, pending: `Annuaire Attente ${stamp}`, sn: `Annuaire Dakar ${stamp}` };

  async function register(name: string, slug: string, country = 'CI') {
    const email = `${slug}@test.local`;
    const reg = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: 'Responsable Test', email, password: PASSWORD, businessName: name, slug, country, description: 'Une jolie boutique de test.' })
      .expect(201);
    const login = await request(server()).post('/api/auth/login').set(mobile).send({ email, password: PASSWORD }).expect(200);
    return { id: reg.body.business.id as string, auth: bearer(login.body.accessToken) };
  }

  async function publishProduct(auth: Record<string, string>) {
    const cat = await request(server()).post('/api/admin/categories').set(auth).send({ name: 'Divers' }).expect(201);
    await request(server())
      .post('/api/admin/products')
      .set(auth)
      .send({ name: 'Article', sku: 'A-1', categoryId: cat.body.id, price: 1000, stock: 5, status: 'PUBLISHED' })
      .expect(201);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();

    const platform = await request(server()).post('/api/auth/login').set(mobile).send(PLATFORM_ADMIN).expect(200);
    const admin = bearer(platform.body.accessToken);

    const shop = await register(names.shop, `dir-shop-${stamp}`);
    const empty = await register(names.empty, `dir-empty-${stamp}`);
    const pending = await register(names.pending, `dir-pending-${stamp}`);
    const dakar = await register(names.sn, `dir-sn-${stamp}`, 'SN');

    await publishProduct(shop.auth);
    await publishProduct(pending.auth);
    await publishProduct(dakar.auth);
    for (const business of [shop, empty, dakar]) {
      await request(server()).post(`/api/platform/businesses/${business.id}/approve`).set(admin).send({}).expect(201);
    }
    // « pending » reste en attente de validation malgré son produit publié.
  });

  afterAll(async () => {
    await app.close();
  });

  const search = (q: string, extra = '') => request(server()).get(`/api/directory?search=${encodeURIComponent(q)}${extra}`);

  it('liste une entreprise validée qui a un produit publié, sans aucun champ sensible', async () => {
    const res = await search(names.shop).expect(200);
    expect(res.body.data).toHaveLength(1);
    const entry = res.body.data[0];
    expect(entry).toEqual({
      name: names.shop,
      slug: `dir-shop-${stamp}`,
      logo: null,
      description: 'Une jolie boutique de test.',
      country: 'CI',
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 });
  });

  it('n’expose pas une entreprise validée mais sans produit publié', async () => {
    const res = await search(names.empty).expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('n’expose pas une entreprise encore en attente de validation', async () => {
    const res = await search(names.pending).expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('filtre par pays', async () => {
    const ci = await search('Annuaire', '&country=CI').expect(200);
    const sn = await search('Annuaire', '&country=SN').expect(200);
    const ciNames = ci.body.data.map((b: { name: string }) => b.name);
    const snNames = sn.body.data.map((b: { name: string }) => b.name);
    expect(ciNames).toContain(names.shop);
    expect(ciNames).not.toContain(names.sn);
    expect(snNames).toEqual([names.sn]);
  });

  it('la recherche ignore la casse', async () => {
    const res = await search(names.shop.toUpperCase()).expect(200);
    expect(res.body.data.map((b: { name: string }) => b.name)).toEqual([names.shop]);
  });

  it('refuse des paramètres invalides', async () => {
    await request(server()).get('/api/directory?limit=500').expect(400);
    await request(server()).get('/api/directory?country=FRANCE').expect(400);
  });

  it('est accessible sans être connecté', async () => {
    await request(server()).get('/api/directory').expect(200);
  });
});
