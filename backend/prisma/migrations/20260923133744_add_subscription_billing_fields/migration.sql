-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "renewalReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionPaidUntil" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- Introduction du modèle d'abonnement (2026-09-23) : les entreprises déjà actives avant ce
-- changement démarrent un essai gratuit de 30 jours à compter de ce déploiement, comme les
-- nouvelles entreprises l'auront à leur première validation (voir platform-businesses.service.ts).
UPDATE "businesses" SET "trialEndsAt" = NOW() + INTERVAL '30 days' WHERE "status" = 'ACTIVE' AND "trialEndsAt" IS NULL;
