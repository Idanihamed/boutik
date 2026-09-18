import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { ActivityLogService } from './activity-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Segments de route qui désignent une action plutôt qu'un identifiant de ressource — utilisé
// pour distinguer `/admin/products/:id/publish` (id = "...", action = "publish") de
// `/admin/media/upload` (pas d'id, action = "upload").
const KNOWN_SUB_ACTIONS = new Set([
  'publish',
  'unpublish',
  'activate',
  'disable',
  'draft',
  'duplicate',
  'stock',
  'status',
  'upload',
  'approve',
  'reject',
  'suspend',
  'ban',
  'reactivate',
]);

const RESOURCE_LABELS: Record<string, string> = {
  products: 'un produit',
  categories: 'une catégorie',
  brands: 'une marque',
  promotions: 'une promotion',
  boutiques: 'une boutique',
  articles: 'une actualité',
  pages: 'une page de contenu',
  messages: 'un message de contact',
  users: 'un compte du personnel',
  business: 'les informations de l’entreprise',
  businesses: 'une entreprise',
  reports: 'un signalement',
  media: 'une image',
};

/** Élide "de" + "un"/"une" en "d'un"/"d'une" (ex. "d'un produit", "d'une promotion"). */
function withDe(label: string): string {
  if (label.startsWith('un ')) return `d'un ${label.slice(3)}`;
  if (label.startsWith('une ')) return `d'une ${label.slice(4)}`;
  return `de ${label}`;
}

const ACTION_PHRASES: Record<string, (label: string) => string> = {
  CREATE: (label) => `a créé ${label}`,
  UPDATE: (label) => `a modifié ${label}`,
  DELETE: (label) => `a supprimé ${label}`,
  PUBLISH: (label) => `a publié ${label}`,
  UNPUBLISH: (label) => `a dépublié ${label}`,
  ACTIVATE: (label) => `a activé ${label}`,
  DISABLE: (label) => `a désactivé ${label}`,
  DRAFT: (label) => `a repassé ${label} en brouillon`,
  DUPLICATE: (label) => `a dupliqué ${label}`,
  STOCK: (label) => `a ajusté le stock ${withDe(label)}`,
  STATUS: (label) => `a changé le statut ${withDe(label)}`,
  UPLOAD: (label) => `a téléversé ${label}`,
  APPROVE: (label) => `a validé ${label}`,
  REJECT: (label) => `a refusé ${label}`,
  SUSPEND: (label) => `a suspendu ${label}`,
  BAN: (label) => `a banni ${label}`,
  REACTIVATE: (label) => `a réactivé ${label}`,
};

// Ressources volontairement exclues du journal : actions de simple lecture/accusé de
// réception (marquer une notification comme lue) sans intérêt d'audit (§28 vise les actions
// de gestion du contenu, pas la navigation dans le back-office).
const EXCLUDED_RESOURCES = new Set(['notifications']);

/**
 * Journalise automatiquement (§28) toute action de modification (POST/PATCH/PUT/DELETE)
 * effectuée sur une route `/admin/...` par un utilisateur authentifié, en dérivant la
 * ressource/l'action du chemin de la route plutôt que d'instrumenter chaque service un par
 * un — évite d'avoir à modifier les ~15 modules existants pour ajouter le journal.
 * Les connexions (login) sont journalisées séparément par AuthService, puisque la route de
 * connexion est publique (pas d'utilisateur authentifié au moment de la requête).
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const method = request.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const parsed = this.parsePath(request.originalUrl ?? request.url);
    if (!parsed || EXCLUDED_RESOURCES.has(parsed.resource)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const user = request.user;
        if (!user) return; // route publique ou non authentifiée : rien à attribuer.

        const action = this.resolveAction(method, parsed.subAction);
        const label = RESOURCE_LABELS[parsed.resource] ?? parsed.resource;
        const phrase = ACTION_PHRASES[action] ? ACTION_PHRASES[action](label) : `a effectué "${action}" sur ${label}`;
        const description = `${user.name} ${phrase}${parsed.resourceId ? ` (réf. ${parsed.resourceId})` : ''}.`;

        void this.activityLogService.record({
          businessId: user.businessId,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action,
          resource: parsed.resource,
          resourceId: parsed.resourceId,
          method,
          path: parsed.path,
          description,
        });
      }),
    );
  }

  private parsePath(rawPath: string): { resource: string; resourceId?: string; subAction?: string; path: string } | null {
    const path = rawPath.split('?')[0];
    const segments = path.split('/').filter(Boolean); // ex. ['api','admin','products','abc123','publish']
    // Routes d'une entreprise (/admin/...) et de la plateforme (/platform/...) : toutes deux
    // journalisées, avec la même dérivation ressource/action.
    const adminIndex = Math.max(segments.indexOf('admin'), segments.indexOf('platform'));
    if (adminIndex === -1) return null;

    const rest = segments.slice(adminIndex + 1); // ex. ['products','abc123','publish']
    if (rest.length === 0) return null;

    const [resource, ...tail] = rest;

    // Cas `/admin/media/upload` : le premier segment après la ressource est déjà l'action,
    // il n'y a pas d'identifiant de ressource.
    if (tail.length > 0 && KNOWN_SUB_ACTIONS.has(tail[0]) && tail.length === 1) {
      return { resource, subAction: tail[0], path };
    }

    const [resourceId, subAction] = tail;
    return { resource, resourceId, subAction, path };
  }

  private resolveAction(method: string, subAction?: string): string {
    if (subAction && KNOWN_SUB_ACTIONS.has(subAction)) {
      return subAction.toUpperCase();
    }
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return 'UPDATE';
    }
  }
}
