import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { PLATFORM_ADMIN } from './test-config';

/**
 * Preuve, sur une vraie base PostgreSQL et le vrai pipeline HTTP, que les entreprises sont
 * étanches entre elles et que la modération de la plateforme fonctionne. C'est le test le plus
 * important du projet : une régression ici = les données d'une entreprise visibles d'une autre.
 */
describe('Isolation entre entreprises & modération (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  interface Session {
    cookie: string;
    csrf: string;
  }

  const server = () => app.getHttpServer();

  async function login(email: string, password: string): Promise<Session> {
    const res = await request(server()).post('/api/auth/login').send({ email, password }).expect(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const csrf = cookies.find((c) => c.startsWith('boutik_csrf_token='))!.split(';')[0].split('=')[1];
    return { cookie: cookies.map((c) => c.split(';')[0]).join('; '), csrf };
  }

  const as = (s: Session) => (req: request.Test) => req.set('Cookie', s.cookie).set('x-csrf-token', s.csrf);
  const get = (s: Session, url: string) => as(s)(request(server()).get(url));
  const post = (s: Session, url: string, body: object = {}) => as(s)(request(server()).post(url)).send(body);
  const patch = (s: Session, url: string, body: object = {}) => as(s)(request(server()).patch(url)).send(body);
  const del = (s: Session, url: string) => as(s)(request(server()).delete(url));

  async function registerBusiness(name: string, slug: string, email: string) {
    const res = await request(server())
      .post('/api/businesses/register')
      .send({ ownerName: `Responsable ${name}`, email, password: 'MotDePasse-Solide-1', businessName: name, slug, country: 'CI' })
      .expect(201);
    return res.body as { business: { id: string; slug: string; status: string } };
  }

  let platform: Session;
  let ownerA: Session;
  let ownerB: Session;
  let businessAId: string;
  let businessBId: string;
  let categoryAId: string;
  let productAId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Le débit (5 inscriptions/h, 10 connexions/min par IP) est testé à part ; ici toutes les
      // requêtes viennent de la même adresse locale et le bloqueraient.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, app.get(ConfigService));
    await app.init();
    prisma = app.get(PrismaService);

    platform = await login(PLATFORM_ADMIN.email, PLATFORM_ADMIN.password);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('inscription et validation', () => {
    it('une entreprise inscrite est en attente et sa vitrine est invisible', async () => {
      const a = await registerBusiness('Alpha Telecom', 'alpha', 'owner-a@test.local');
      const b = await registerBusiness('Beta Mobile', 'beta', 'owner-b@test.local');
      businessAId = a.business.id;
      businessBId = b.business.id;
      expect(a.business.status).toBe('PENDING');

      await request(server()).get('/api/b/alpha').expect(404);
      await request(server()).get('/api/b/alpha/products').expect(404);
    });

    it("refuse un identifiant déjà pris ou réservé, et un email déjà utilisé", async () => {
      await request(server())
        .post('/api/businesses/register')
        .send({ ownerName: 'X Y', email: 'autre@test.local', password: 'MotDePasse-Solide-1', businessName: 'Autre', slug: 'alpha', country: 'CI' })
        .expect(409);
      await request(server())
        .post('/api/businesses/register')
        .send({ ownerName: 'X Y', email: 'autre@test.local', password: 'MotDePasse-Solide-1', businessName: 'Autre', slug: 'admin', country: 'CI' })
        .expect(409);
      await request(server())
        .post('/api/businesses/register')
        .send({ ownerName: 'X Y', email: 'owner-a@test.local', password: 'MotDePasse-Solide-1', businessName: 'Autre', country: 'CI' })
        .expect(409);
    });

    it("une entreprise en attente peut préparer son catalogue depuis son back-office", async () => {
      ownerA = await login('owner-a@test.local', 'MotDePasse-Solide-1');
      ownerB = await login('owner-b@test.local', 'MotDePasse-Solide-1');

      const category = await post(ownerA, '/api/admin/categories', { name: 'Smartphones' }).expect(201);
      categoryAId = category.body.id;
      const product = await post(ownerA, '/api/admin/products', {
        name: 'Téléphone Alpha',
        sku: 'SKU-1',
        categoryId: categoryAId,
        price: 100000,
        stock: 5,
        status: 'PUBLISHED',
      }).expect(201);
      productAId = product.body.id;
    });

    it('seul un administrateur de la plateforme peut valider ; un responsable ne le peut pas', async () => {
      await post(ownerA, `/api/platform/businesses/${businessAId}/approve`).expect(403);
      await get(ownerA, '/api/platform/businesses').expect(403);

      await post(platform, `/api/platform/businesses/${businessAId}/approve`).expect(201);
      await post(platform, `/api/platform/businesses/${businessBId}/approve`).expect(201);

      const storefront = await request(server()).get('/api/b/alpha').expect(200);
      expect(storefront.body.name).toBe('Alpha Telecom');
    });
  });

  describe("étanchéité des données d'entreprise", () => {
    it('la vitrine de chaque entreprise ne montre que ses propres produits', async () => {
      const a = await request(server()).get('/api/b/alpha/products').expect(200);
      expect(a.body.data.map((p: { id: string }) => p.id)).toContain(productAId);

      const b = await request(server()).get('/api/b/beta/products').expect(200);
      expect(b.body.data).toHaveLength(0);
    });

    it("un responsable ne peut ni lire, ni modifier, ni supprimer les données d'une autre entreprise", async () => {
      await get(ownerB, `/api/admin/products/${productAId}`).expect(404);
      await patch(ownerB, `/api/admin/products/${productAId}`, { name: 'Piraté' }).expect(404);
      await del(ownerB, `/api/admin/products/${productAId}`).expect(404);
      await get(ownerB, `/api/admin/categories/${categoryAId}`).expect(404);

      const list = await get(ownerB, '/api/admin/products').expect(200);
      expect(list.body.data).toHaveLength(0);

      // Rien n'a été modifié côté A.
      const stillThere = await get(ownerA, `/api/admin/products/${productAId}`).expect(200);
      expect(stillThere.body.name).toBe('Téléphone Alpha');
    });

    it("refuse de rattacher un produit à la catégorie d'une autre entreprise", async () => {
      await post(ownerB, '/api/admin/products', {
        name: 'Intrus',
        sku: 'SKU-X',
        categoryId: categoryAId,
        price: 1000,
      }).expect(400);
    });

    it('le même SKU et le même nom sont autorisés dans deux entreprises différentes', async () => {
      const category = await post(ownerB, '/api/admin/categories', { name: 'Smartphones' }).expect(201);
      const product = await post(ownerB, '/api/admin/products', {
        name: 'Téléphone Alpha',
        sku: 'SKU-1',
        categoryId: category.body.id,
        price: 90000,
        stock: 3,
        status: 'PUBLISHED',
      }).expect(201);
      expect(product.body.slug).toBe('telephone-alpha');
    });

    it("une commande publique ne peut pas viser le produit d'une autre entreprise", async () => {
      await request(server())
        .post('/api/b/beta/orders')
        .send({ customerName: 'Client Test', customerContact: '0102030405', items: [{ productId: productAId, quantity: 1 }] })
        .expect(400);
    });

    it("les messages de contact d'une entreprise sont invisibles pour une autre", async () => {
      await request(server())
        .post('/api/b/alpha/contact')
        .send({ name: 'Visiteur', contact: '0102030405', subject: 'Question', message: 'Bonjour, une question.' })
        .expect(201);

      const a = await get(ownerA, '/api/admin/messages').expect(200);
      expect(a.body.data).toHaveLength(1);
      const b = await get(ownerB, '/api/admin/messages').expect(200);
      expect(b.body.data).toHaveLength(0);
    });

    it("chaque responsable ne voit et ne gère que le personnel de sa propre entreprise", async () => {
      const usersB = await get(ownerB, '/api/admin/users').expect(200);
      expect(usersB.body.map((u: { email: string }) => u.email)).toEqual(['owner-b@test.local']);

      const ownerAUser = await prisma.user.findUniqueOrThrow({ where: { email: 'owner-a@test.local' } });
      await patch(ownerB, `/api/admin/users/${ownerAUser.id}`, { name: 'Piraté' }).expect(404);
      await del(ownerB, `/api/admin/users/${ownerAUser.id}`).expect(404);
    });

    it("un slug ne permet jamais d'atteindre un back-office ou l'authentification d'une entreprise", async () => {
      await request(server()).get('/api/b/alpha/admin/products').expect(404);
      await get(ownerB, '/api/b/alpha/admin/products').expect(404);
      await request(server()).get('/api/b/alpha/auth/me').expect(404);
      await request(server()).get('/api/b/alpha/products/../admin/products').expect(404);
    });

    it("échoue fermé : une route d'entreprise sans entreprise identifiée est refusée, jamais servie sans filtre", async () => {
      await request(server()).get('/api/products').expect(403);
      // Un compte plateforme n'a pas d'entreprise : aucun accès aux données d'entreprise.
      await get(platform, '/api/admin/products').expect(403);
    });
  });

  describe('modération', () => {
    it('la suspension masque la vitrine, coupe les sessions et explique le motif', async () => {
      await post(platform, `/api/platform/businesses/${businessAId}/suspend`, {}).expect(400); // motif obligatoire
      await post(platform, `/api/platform/businesses/${businessAId}/suspend`, { reason: 'Contrôle qualité' }).expect(201);

      await request(server()).get('/api/b/alpha/products').expect(404);
      // La session déjà ouverte est immédiatement inutilisable sur le back-office.
      await get(ownerA, '/api/admin/products').expect(403);

      const res = await request(server())
        .post('/api/auth/login')
        .send({ email: 'owner-a@test.local', password: 'MotDePasse-Solide-1' })
        .expect(403);
      expect(res.body.message).toContain('Contrôle qualité');

      // L'autre entreprise n'est pas affectée.
      await request(server()).get('/api/b/beta/products').expect(200);
    });

    it('la réactivation rétablit la vitrine et les connexions', async () => {
      await post(platform, `/api/platform/businesses/${businessAId}/reactivate`).expect(201);
      await request(server()).get('/api/b/alpha/products').expect(200);
      ownerA = await login('owner-a@test.local', 'MotDePasse-Solide-1');
      await get(ownerA, '/api/admin/products').expect(200);
    });

    it("refuse une transition incohérente (valider une entreprise déjà active)", async () => {
      await post(platform, `/api/platform/businesses/${businessAId}/approve`).expect(409);
    });

    it("le journal de modération garde la trace de chaque décision", async () => {
      const detail = await get(platform, `/api/platform/businesses/${businessAId}`).expect(200);
      const actions = detail.body.moderationLog.map((e: { action: string }) => e.action).reverse();
      expect(actions).toEqual(['APPROVED', 'SUSPENDED', 'REACTIVATED']);
    });
  });

  describe('signalements', () => {
    let customers: Session[];

    beforeAll(async () => {
      customers = [];
      for (let i = 1; i <= 3; i++) {
        await request(server())
          .post('/api/auth/register')
          .send({ name: `Client ${i}`, email: `client${i}@test.local`, password: 'MotDePasse-Solide-1' })
          .expect(201);
        customers.push(await login(`client${i}@test.local`, 'MotDePasse-Solide-1'));
      }
    });

    it("un signalement exige un compte connecté", async () => {
      await request(server()).post('/api/businesses/beta/report').send({ reason: 'SCAM' }).expect(401);
    });

    it('une personne ne peut signaler une entreprise qu’une seule fois', async () => {
      await post(customers[0], '/api/businesses/beta/report', { reason: 'SCAM', comment: 'Faux produits' }).expect(201);
      await post(customers[0], '/api/businesses/beta/report', { reason: 'SCAM' }).expect(409);
    });

    it('un responsable ne peut pas signaler sa propre entreprise', async () => {
      await post(ownerB, '/api/businesses/beta/report', { reason: 'OTHER' }).expect(403);
    });

    it("plusieurs signalements alertent l'administrateur sans jamais suspendre automatiquement", async () => {
      await post(customers[1], '/api/businesses/beta/report', { reason: 'FAKE_PRODUCTS' }).expect(201);
      await post(customers[2], '/api/businesses/beta/report', { reason: 'SCAM' }).expect(201);

      const flagged = await get(platform, '/api/platform/reports/flagged').expect(200);
      expect(flagged.body).toEqual([expect.objectContaining({ slug: 'beta', openReports: 3 })]);

      // Décision humaine : l'entreprise reste active tant que l'administrateur n'a pas tranché.
      await request(server()).get('/api/b/beta/products').expect(200);
    });

    it("le bannissement traite les signalements et bloque définitivement l'entreprise", async () => {
      await post(platform, `/api/platform/businesses/${businessBId}/ban`, { reason: 'Arnaque avérée' }).expect(201);

      await request(server()).get('/api/b/beta/products').expect(404);
      await request(server())
        .post('/api/auth/login')
        .send({ email: 'owner-b@test.local', password: 'MotDePasse-Solide-1' })
        .expect(403);

      const open = await get(platform, '/api/platform/reports?status=OPEN').expect(200);
      expect(open.body.data).toHaveLength(0);
    });
  });
});
