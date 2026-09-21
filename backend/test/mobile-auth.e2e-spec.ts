import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * Connexion de l'application mobile : jetons dans le corps de la réponse (en-tête X-Client: mobile)
 * et `Authorization: Bearer` sur les routes protégées. Le site web, lui, ne doit rien voir changer.
 */
describe('Authentification mobile (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();
  const stamp = Date.now().toString(36);
  const owner = { email: `mobile-${stamp}@test.local`, password: 'MotDePasse-Solide-1' };
  const mobile = { 'X-Client': 'mobile' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();
    await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: 'Mobile Test', ...owner, businessName: `Mobile ${stamp}`, slug: `mobile-${stamp}`, country: 'CI' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('site web : la connexion pose des cookies et ne renvoie JAMAIS les jetons dans le corps', async () => {
    const res = await request(server()).post('/api/auth/login').send(owner).expect(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.user.email).toBe(owner.email);
  });

  it('mobile : la connexion renvoie les jetons dans le corps et ne pose aucun cookie', async () => {
    const res = await request(server()).post('/api/auth/login').set(mobile).send(owner).expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
  });

  it('mobile : les routes protégées acceptent Authorization: Bearer, et refusent un jeton faux ou absent', async () => {
    const { accessToken } = (await request(server()).post('/api/auth/login').set(mobile).send(owner)).body;

    const me = await request(server()).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.email).toBe(owner.email);

    await request(server()).get('/api/auth/me').set('Authorization', 'Bearer jeton-invente').expect(401);
    await request(server()).get('/api/auth/me').expect(401);
  });

  it('mobile : l’entreprise vient du jeton (routes de gestion, écriture sans jeton CSRF)', async () => {
    const { accessToken } = (await request(server()).post('/api/auth/login').set(mobile).send(owner)).body;
    const auth = { Authorization: `Bearer ${accessToken}` };

    await request(server()).post('/api/admin/categories').set(auth).send({ name: 'Depuis le mobile' }).expect(201);
    const list = await request(server()).get('/api/admin/categories').set(auth).expect(200);
    expect(list.body.map((c: { name: string }) => c.name)).toContain('Depuis le mobile');
  });

  it('mobile : le renouvellement se fait avec le refreshToken du corps, et un jeton déjà utilisé est refusé', async () => {
    const first = (await request(server()).post('/api/auth/login').set(mobile).send(owner)).body;

    const renewed = await request(server()).post('/api/auth/refresh').set(mobile).send({ refreshToken: first.refreshToken }).expect(200);
    expect(typeof renewed.body.accessToken).toBe('string');
    expect(renewed.body.refreshToken).not.toBe(first.refreshToken);

    await request(server()).get('/api/auth/me').set('Authorization', `Bearer ${renewed.body.accessToken}`).expect(200);
    // Rejeu de l'ancien jeton : refusé (détection de vol, voir AuthService.refresh).
    await request(server()).post('/api/auth/refresh').set(mobile).send({ refreshToken: first.refreshToken }).expect((r) => {
      expect([401, 403]).toContain(r.status);
    });
  });

  it('mobile : sans refreshToken dans le corps, le renouvellement est refusé', async () => {
    await request(server()).post('/api/auth/refresh').set(mobile).send({}).expect(403);
  });

  it('web : le corps de la requête n’est pas pris pour un refreshToken (seul le cookie compte)', async () => {
    const { refreshToken } = (await request(server()).post('/api/auth/login').set(mobile).send(owner)).body;
    await request(server()).post('/api/auth/refresh').send({ refreshToken }).expect(403);
  });

  it('mobile : la déconnexion révoque la session', async () => {
    const { refreshToken } = (await request(server()).post('/api/auth/login').set(mobile).send(owner)).body;
    await request(server()).post('/api/auth/logout').set(mobile).send({ refreshToken }).expect(200);
    await request(server()).post('/api/auth/refresh').set(mobile).send({ refreshToken }).expect((r) => {
      expect([401, 403]).toContain(r.status);
    });
  });
});
