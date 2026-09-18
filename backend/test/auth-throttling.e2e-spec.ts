import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PLATFORM_ADMIN } from './test-config';

/**
 * Ici la limitation de débit est ACTIVE (contrairement à isolation.e2e-spec.ts). Elle doit
 * freiner les essais de mot de passe, mais JAMAIS la vérification de session `GET /auth/me`, que
 * les clients appellent à chaque chargement de page : la plafonner déconnecterait des
 * utilisateurs légitimes (plusieurs personnes partagent souvent la même IP sur un réseau mobile).
 */
describe('Limitation de débit des routes d’authentification (e2e)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('expose des routes de santé publiques (contrôle de l’hébergeur, ping de maintien en éveil)', async () => {
    await request(server()).get('/api/health').expect(200, { status: 'ok' });
    await request(server()).get('/api/health/db').expect(200, { status: 'ok', database: 'ok' });
  });

  it('ne limite pas GET /auth/me (appelée à chaque page)', async () => {
    const login = await request(server()).post('/api/auth/login').send(PLATFORM_ADMIN).expect(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

    for (let i = 0; i < 30; i++) {
      await request(server()).get('/api/auth/me').set('Cookie', cookie).expect(200);
    }
  });

  it('limite les essais de connexion répétés (force brute)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(server()).post('/api/auth/login').send({ email: PLATFORM_ADMIN.email, password: 'mauvais-mot-de-passe' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
    expect(statuses[0]).toBe(401);
  });
});
