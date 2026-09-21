import { ForbiddenException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { currentBusinessId } from './tenant-context';

/** Jeton d'injection du client Prisma "isolé par entreprise" (voir TenancyModule). */
export const TENANT_PRISMA = Symbol('TENANT_PRISMA');

// Modèles dont chaque ligne appartient à une entreprise. Les tables enfants (images de produit,
// lignes de commande, liens promotion-produit...) ne sont atteintes qu'à travers leur parent,
// donc déjà isolées par lui. User, Role, Business et les signalements sont gérés explicitement
// par leurs services dédiés (ils ne relèvent pas d'UNE entreprise).
export const TENANT_MODELS = new Set([
  'Category',
  'Brand',
  'Product',
  'Promotion',
  'PromoCode',
  'Boutique',
  'Article',
  'Page',
  'ContactMessage',
  'Order',
  'Notification',
  'Setting',
]);

type AnyArgs = Record<string, any>;

/**
 * Restreint une requête Prisma à l'entreprise donnée. Fonction pure (sans base de données),
 * donc testable seule : voir tenant-prisma.spec.ts.
 *
 * - lectures/écritures multiples : `businessId` est ajouté au filtre (en ET avec l'existant) ;
 * - lectures/écritures unitaires : `businessId` est ajouté à la clé (Prisma ≥ 5 accepte des
 *   filtres supplémentaires dans un `where` unique) — un identifiant d'une AUTRE entreprise
 *   devient donc introuvable au lieu d'être lisible ;
 * - créations : `businessId` est imposé, écrasant toute valeur fournie par l'appelant ;
 * - toute opération non prévue est REFUSÉE (échec fermé) plutôt que laissée passer sans filtre.
 */
export function scopeArgs(operation: string, args: AnyArgs | undefined, businessId: string): AnyArgs {
  const a: AnyArgs = { ...(args ?? {}) };

  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'updateMany':
    case 'deleteMany':
      a.where = a.where ? { AND: [a.where, { businessId }] } : { businessId };
      return a;

    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'update':
    case 'delete':
      a.where = { ...(a.where ?? {}), businessId };
      return a;

    case 'create':
      a.data = { ...(a.data ?? {}), businessId };
      return a;

    case 'createMany':
      a.data = Array.isArray(a.data)
        ? a.data.map((row: AnyArgs) => ({ ...row, businessId }))
        : { ...(a.data ?? {}), businessId };
      return a;

    case 'upsert':
      a.where = { ...(a.where ?? {}), businessId };
      a.create = { ...(a.create ?? {}), businessId };
      return a;

    default:
      throw new ForbiddenException(`Opération Prisma non autorisée sur une donnée d'entreprise : ${operation}.`);
  }
}

/** Extension Prisma : applique scopeArgs à chaque requête sur un modèle d'entreprise. */
export function tenantExtension() {
  return Prisma.defineExtension({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) {
            return query(args);
          }
          const businessId = currentBusinessId();
          if (!businessId) {
            // Échec fermé : sans entreprise identifiée, on ne lit ni n'écrit rien plutôt que de
            // risquer d'exposer les données de toutes les entreprises.
            throw new ForbiddenException("Aucune entreprise n'est associée à cette requête.");
          }
          return query(scopeArgs(operation, args as AnyArgs, businessId) as typeof args);
        },
      },
    },
  });
}

export function createTenantClient(base: PrismaClient) {
  return base.$extends(tenantExtension());
}

export type TenantPrisma = ReturnType<typeof createTenantClient>;
