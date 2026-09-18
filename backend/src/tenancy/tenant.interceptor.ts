import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { BusinessStatus } from '@prisma/client';
import { from, Observable, switchMap } from 'rxjs';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { TenantStore, tenantStorage } from './tenant-context';

export type TenantRequest = Request & { user?: AuthenticatedUser; tenantBusinessId?: string };

// Une entreprise en attente de validation peut déjà préparer son catalogue depuis son
// back-office (elle reste invisible du public tant qu'elle n'est pas ACTIVE) ; une entreprise
// refusée, suspendue ou bannie perd tout accès à son back-office.
const ADMIN_ALLOWED_STATUSES = new Set<BusinessStatus>(['PENDING', 'ACTIVE']);

/**
 * Unique point où l'entreprise "courante" est fixée pour la requête :
 *  - route publique de vitrine (/api/b/:slug/...) : l'entreprise vient du slug, résolu et
 *    vérifié (ACTIVE) par le middleware de tenant-slug.middleware.ts ;
 *  - route d'administration (/api/admin/...) : l'entreprise est CELLE DU COMPTE connecté (jeton),
 *    jamais un paramètre choisi par l'appelant — un responsable ne peut donc pas viser une
 *    autre entreprise.
 * Les comptes de la plateforme et les clients n'ont pas d'entreprise : ils n'obtiennent aucun
 * contexte, et toute tentative de lire une donnée d'entreprise échoue (voir tenant-prisma.ts).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<TenantRequest>();
    return from(this.resolveStore(request)).pipe(
      switchMap(
        (store) =>
          new Observable<unknown>((subscriber) => {
            tenantStorage.run(store, () => {
              next.handle().subscribe(subscriber);
            });
          }),
      ),
    );
  }

  private async resolveStore(request: TenantRequest): Promise<TenantStore> {
    if (request.tenantBusinessId) {
      return { businessId: request.tenantBusinessId };
    }

    const user = request.user;
    if (!user?.businessId) return {};

    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    if (path.startsWith('/api/admin')) {
      const business = await this.prisma.business.findUnique({
        where: { id: user.businessId },
        select: { status: true, statusReason: true },
      });
      if (!business || !ADMIN_ALLOWED_STATUSES.has(business.status)) {
        const reason = business?.statusReason ? ` Motif : ${business.statusReason}` : '';
        throw new ForbiddenException(`L'accès à cette entreprise est désactivé.${reason}`);
      }
    }
    return { businessId: user.businessId };
  }
}
