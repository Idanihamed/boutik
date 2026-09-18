// Données de démonstration — DÉVELOPPEMENT LOCAL UNIQUEMENT (npm run db:seed:demo). Ne jamais
// exécuter en production : crée une entreprise déjà validée avec un mot de passe connu.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo ne doit jamais être exécuté en production.');
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'OWNER' } });

  const business = await prisma.business.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Boutique Démo',
      slug: 'demo',
      country: 'CI',
      currency: 'XOF',
      description: 'Entreprise de démonstration.',
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: 'owner@demo.boutik.local' },
    update: {},
    create: {
      name: 'Responsable Démo',
      email: 'owner@demo.boutik.local',
      passwordHash: await bcrypt.hash('DemoOwner-2026!', 10),
      roleId: ownerRole.id,
      businessId: business.id,
    },
  });

  await prisma.setting.upsert({ where: { businessId: business.id }, update: {}, create: { businessId: business.id } });

  const category = await prisma.category.upsert({
    where: { businessId_slug: { businessId: business.id, slug: 'smartphones' } },
    update: {},
    create: { businessId: business.id, name: 'Smartphones', slug: 'smartphones' },
  });

  for (const [slug, name, sku, price] of [
    ['telephone-demo-a', 'Téléphone Démo A', 'DEMO-A', 85000],
    ['telephone-demo-b', 'Téléphone Démo B', 'DEMO-B', 120000],
  ] as const) {
    await prisma.product.upsert({
      where: { businessId_slug: { businessId: business.id, slug } },
      update: {},
      create: {
        businessId: business.id,
        categoryId: category.id,
        name,
        slug,
        sku,
        price,
        stock: 10,
        status: 'PUBLISHED',
      },
    });
  }

  console.log('Seed démo terminé : vitrine /api/b/demo — responsable owner@demo.boutik.local / DemoOwner-2026!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
