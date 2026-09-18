# Boutik

Plateforme multi-entreprise : chaque responsable crée son entreprise (nom, logo, pays, devise) et
gère sa propre vitrine ; l'administrateur de la plateforme valide, suspend ou bannit les
entreprises. Issue du socle du projet Amza Futur Telecom (qui reste indépendant).

**État : backend, site web (inscription, connexion, console de modération, catalogue du
responsable) et vitrine publique (accueil, produits, panier, commande, suivi, contact,
signalement).** À venir : gestion des commandes et messages côté responsable, promotions,
paramètres et personnel, puis l'application mobile.

Vitrine : `/<adresse-de-l-entreprise>` (ex. `/demo`). Pour un déploiement derrière des relais
(Vercel → Render), régler `TRUST_PROXY` côté API selon le nombre de relais, sinon l'anti-spam
verrait la même adresse pour tous les visiteurs.

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

## Démarrer (site web)

```bash
cd frontend
cp .env.local.example .env.local   # BACKEND_ORIGIN = adresse de l'API
npm install
npm run dev                        # http://localhost:3100
```

Le navigateur n'appelle jamais l'API directement : il passe par `/api` sur le site, relayé par Next
(`next.config.mjs`), ce qui garde les cookies de session « premier parti ».

## Déployer une version de test

Trois services, tous avec un plan gratuit :

1. **Base PostgreSQL** — Neon (neon.tech), région Europe (Frankfurt). Copier l'adresse de connexion
   **directe** (sans `-pooler`) : c'est `DATABASE_URL`. (Render n'autorise qu'une base gratuite par
   compte, d'où une base externe.)
2. **API** — Render : *New → Blueprint*, choisir ce dépôt (`render.yaml`). Renseigner les variables
   demandées : `DATABASE_URL`, `SEED_PLATFORM_ADMIN_EMAIL`, `SEED_PLATFORM_ADMIN_PASSWORD` (10
   caractères min., ce compte peut valider et bannir toute entreprise), `CLOUDINARY_URL`
   (`cloudinary://CLE:SECRET@NOM` — valeur exacte), `CORS_ORIGIN` (adresse du site Vercel).
   Vérifier ensuite `https://<api>.onrender.com/api/health/db`.
3. **Site** — Vercel : projet dont le dossier racine est `frontend`, variable `BACKEND_ORIGIN` =
   adresse de l'API Render (sans `/api`).

Points à vérifier après le premier déploiement :

- `TRUST_PROXY` (2 par défaut = Vercel puis Render) : depuis deux réseaux différents, envoyer
  quelques messages de contact et contrôler que la limite anti-spam s'applique par visiteur et non
  pour tout le monde.
- Plan gratuit Render : l'API s'endort après ~15 min ; la première visite met ~1 min à répondre.
  Un ping régulier de `/api/health/db` (ex. UptimeRobot, toutes les 5 min) l'évite.
- Les emails sortent de `onboarding@resend.dev` tant qu'aucun domaine n'est vérifié chez Resend.

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
