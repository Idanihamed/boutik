# Boutik

Plateforme multi-entreprise : chaque responsable crée son entreprise (nom, logo, pays, devise) et
gère sa propre vitrine ; l'administrateur de la plateforme valide, suspend ou bannit les
entreprises. Issue du socle du projet Amza Futur Telecom (qui reste indépendant).

**État : étape 1 (backend).** Le site web et l'application mobile viennent ensuite.

## Principes

- **Vitrine par entreprise** : `/api/b/:slug/...` (ex. `/api/b/demo/products`).
- **Inscription validée** : une entreprise inscrite est `PENDING` et invisible du public ; elle peut
  préparer son catalogue. Statuts : `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `BANNED`.
- **Signalements** : un compte connecté signale une entreprise (une fois chacune, 5 par jour). Plusieurs
  signalements alertent la plateforme mais ne suspendent **jamais** automatiquement.
- **Isolation des données à un seul endroit** : `src/tenancy/`. Une extension Prisma ajoute
  `businessId` à chaque requête sur les tables d'entreprise, l'impose à chaque création, et
  **refuse** de fonctionner si l'entreprise n'est pas identifiée (échec fermé). Les services métier
  n'ont pas à filtrer eux-mêmes. Un nouveau modèle d'entreprise doit être ajouté à `TENANT_MODELS`.
- **Rôles** : `PLATFORM_ADMIN` (modération), `OWNER` / `GESTIONNAIRE` / `EDITEUR` (personnel d'une
  entreprise), `CUSTOMER` (client). Le personnel est isolé explicitement dans `UsersService`.

## Démarrer (backend)

```bash
cd backend
cp .env.example .env        # renseigner DATABASE_URL, secrets JWT, SEED_PLATFORM_ADMIN_*
npm install
npx prisma migrate deploy
npm run prisma:seed         # rôles, permissions, compte plateforme
npm run db:seed:demo        # (dev uniquement) entreprise « demo »
npm run start:dev
```

## Tests

```bash
npm test          # unitaires
npm run test:e2e  # intégration : vraie base PostgreSQL « boutik_test » (effacée à chaque lancement)
```

Le test `test/isolation.e2e-spec.ts` prouve qu'une entreprise ne peut ni lire, ni modifier, ni
supprimer les données d'une autre, et couvre inscription, modération et signalements.

## Limites connues

- Montants stockés en entiers dans la devise de l'entreprise (adapté au FCFA ; les devises à
  décimales demanderaient des unités mineures).
- Clients invités : les commandes et messages se font sans compte ; seuls les signalements
  exigent un compte.
