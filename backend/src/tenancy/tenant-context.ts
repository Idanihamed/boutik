import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  businessId?: string;
}

/**
 * Entreprise "courante" de la requête en cours, propagée par AsyncLocalStorage : renseignée une
 * seule fois par TenantInterceptor, lue uniquement par l'extension Prisma (tenant-prisma.ts).
 * Aucun service métier n'a besoin de connaître ni de filtrer par businessId lui-même.
 */
export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function currentBusinessId(): string | undefined {
  return tenantStorage.getStore()?.businessId;
}
