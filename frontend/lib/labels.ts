import type { BusinessStatus, ModerationAction, ReportReason, ReportStatus } from './types';

export const STATUS_LABELS: Record<BusinessStatus, string> = {
  PENDING: 'En attente',
  ACTIVE: 'Active',
  REJECTED: 'Refusée',
  SUSPENDED: 'Suspendue',
  BANNED: 'Bannie',
};

export const STATUS_STYLES: Record<BusinessStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-slate-200 text-slate-700',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  BANNED: 'bg-red-100 text-red-800',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM: 'Arnaque',
  INAPPROPRIATE_CONTENT: 'Contenu inapproprié',
  FAKE_PRODUCTS: 'Faux produits',
  IMPERSONATION: 'Usurpation d’identité',
  OTHER: 'Autre',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: 'À examiner',
  DISMISSED: 'Classé sans suite',
  ACTIONED: 'Traité',
};

export const ACTION_LABELS: Record<ModerationAction, string> = {
  approve: 'Valider',
  reject: 'Refuser',
  suspend: 'Suspendre',
  ban: 'Bannir',
  reactivate: 'Réactiver',
};

/** Vocabulaire du journal (valeurs stockées par l'API). */
export const EVENT_LABELS: Record<string, string> = {
  APPROVED: 'Validée',
  REJECTED: 'Refusée',
  SUSPENDED: 'Suspendue',
  BANNED: 'Bannie',
  REACTIVATED: 'Réactivée',
};

/** Décisions possibles selon le statut actuel (miroir de la machine à états de l'API). */
export const ALLOWED_ACTIONS: Record<BusinessStatus, ModerationAction[]> = {
  PENDING: ['approve', 'reject', 'ban'],
  ACTIVE: ['suspend', 'ban'],
  REJECTED: ['approve', 'ban'],
  SUSPENDED: ['reactivate', 'ban'],
  BANNED: ['reactivate'],
};

/** Un motif est obligatoire pour ces décisions (il est communiqué au responsable). */
export const REASON_REQUIRED: Record<ModerationAction, boolean> = {
  approve: false,
  reject: true,
  suspend: true,
  ban: true,
  reactivate: false,
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Responsable',
  GESTIONNAIRE: 'Gestionnaire',
  EDITEUR: 'Éditeur',
};

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'CI', name: 'Côte d’Ivoire' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'ML', name: 'Mali' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BJ', name: 'Bénin' },
  { code: 'TG', name: 'Togo' },
  { code: 'NE', name: 'Niger' },
  { code: 'GW', name: 'Guinée-Bissau' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'GA', name: 'Gabon' },
  { code: 'CG', name: 'Congo' },
  { code: 'TD', name: 'Tchad' },
  { code: 'CF', name: 'Centrafrique' },
  { code: 'GQ', name: 'Guinée équatoriale' },
  { code: 'GN', name: 'Guinée' },
  { code: 'CD', name: 'RD Congo' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' },
  { code: 'TN', name: 'Tunisie' },
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Devise par défaut selon le pays (miroir de l'API, voir backend/src/common/countries.ts). */
export const DEFAULT_CURRENCY_BY_COUNTRY: Record<string, string> = {
  CI: 'XOF',
  SN: 'XOF',
  ML: 'XOF',
  BF: 'XOF',
  BJ: 'XOF',
  TG: 'XOF',
  NE: 'XOF',
  GW: 'XOF',
  CM: 'XAF',
  GA: 'XAF',
  CG: 'XAF',
  TD: 'XAF',
  CF: 'XAF',
  GQ: 'XAF',
  GN: 'GNF',
  CD: 'CDF',
  MG: 'MGA',
  MA: 'MAD',
  DZ: 'DZD',
  TN: 'TND',
  FR: 'EUR',
  BE: 'EUR',
};

/** Libellé usuel d'une devise : « FCFA » pour le franc CFA (XOF/XAF), le code ISO sinon. */
export function currencyLabel(currency: string): string {
  return currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
}

/** Montant entier suivi de la devise. */
export function formatPrice(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currencyLabel(currency)}`;
}

export const STOCK_LABELS = {
  DISPONIBLE: 'En stock',
  STOCK_FAIBLE: 'Stock faible',
  RUPTURE: 'Rupture',
} as const;

export const STOCK_STYLES = {
  DISPONIBLE: 'bg-emerald-100 text-emerald-800',
  STOCK_FAIBLE: 'bg-amber-100 text-amber-800',
  RUPTURE: 'bg-red-100 text-red-800',
} as const;

export const ORDER_STATUS_LABELS = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  EN_PREPARATION: 'En préparation',
  EXPEDIEE: 'Expédiée',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
} as const;

export const ORDER_STATUS_STYLES = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800',
  CONFIRMEE: 'bg-sky-100 text-sky-800',
  EN_PREPARATION: 'bg-indigo-100 text-indigo-800',
  EXPEDIEE: 'bg-violet-100 text-violet-800',
  LIVREE: 'bg-emerald-100 text-emerald-800',
  ANNULEE: 'bg-slate-200 text-slate-700',
} as const;

/** Étape suivante « naturelle » d'une commande (absente pour une commande livrée ou annulée). */
export const NEXT_ORDER_STATUS = {
  EN_ATTENTE: 'CONFIRMEE',
  CONFIRMEE: 'EN_PREPARATION',
  EN_PREPARATION: 'EXPEDIEE',
  EXPEDIEE: 'LIVREE',
} as const;

export const NEXT_ORDER_LABELS = {
  EN_ATTENTE: 'Confirmer la commande',
  CONFIRMEE: 'Passer en préparation',
  EN_PREPARATION: 'Marquer comme expédiée',
  EXPEDIEE: 'Marquer comme livrée',
} as const;

export const MESSAGE_STATUS_LABELS = {
  NOUVEAU: 'Nouveau',
  LU: 'Lu',
  TRAITE: 'Traité',
} as const;

export const MESSAGE_STATUS_STYLES = {
  NOUVEAU: 'bg-amber-100 text-amber-800',
  LU: 'bg-slate-200 text-slate-700',
  TRAITE: 'bg-emerald-100 text-emerald-800',
} as const;

/** Liens pour joindre un client : email (mailto), sinon téléphone (appel + WhatsApp). */
export function contactLinks(contact: string): { href: string; label: string }[] {
  const value = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return [{ href: `mailto:${value}`, label: 'Écrire un email' }];
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) return [];
  const links = [{ href: `tel:${value.replace(/[^\d+]/g, '')}`, label: 'Appeler' }];
  // WhatsApp exige l'indicatif du pays : proposé seulement quand le numéro est écrit en format
  // international (« +225… » ou « 00225… »), jamais deviné pour un numéro local.
  if (value.startsWith('+') || value.startsWith('00')) {
    links.push({ href: `https://wa.me/${value.startsWith('00') ? digits.slice(2) : digits}`, label: 'WhatsApp' });
  }
  return links;
}

/** Type de fichier joint déduit de son adresse (l'API ne le stocke pas séparément). */
export function attachmentKind(url: string): 'image' | 'video' | 'other' {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/.test(path)) return 'image';
  if (/\.(mp4|webm|mov)$/.test(path)) return 'video';
  return 'other';
}

/** Identifiant d'URL proposé à partir du nom (miroir des règles de l'API : a-z, 0-9, tirets). */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55);
}

export const PROMOTION_STATUS_LABELS = {
  DRAFT: 'Brouillon',
  SCHEDULED: 'Programmée',
  ACTIVE: 'En cours',
  EXPIRED: 'Terminée',
  DISABLED: 'Désactivée',
} as const;

export const PROMOTION_STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-slate-100 text-slate-500',
  DISABLED: 'bg-amber-100 text-amber-800',
} as const;

export const PROMOTION_TYPE_LABELS = {
  PERCENTAGE: 'Pourcentage de réduction',
  FIXED_AMOUNT: 'Montant retiré du prix',
  FIXED_PRICE: 'Prix fixe',
} as const;

/** Résumé lisible de la réduction, ex. « -20 % » ou « -500 FCFA ». */
export function describePromotionValue(type: keyof typeof PROMOTION_TYPE_LABELS, value: number, currency: string): string {
  if (type === 'PERCENTAGE') return `-${value} %`;
  if (type === 'FIXED_AMOUNT') return `-${formatPrice(value, currency)}`;
  return `Prix : ${formatPrice(value, currency)}`;
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Accès complet : équipe, paramètres, produits, promotions, commandes et messages.',
  GESTIONNAIRE: 'Produits, promotions, commandes et messages. Pas d’accès à l’équipe ni aux paramètres.',
  EDITEUR: 'Crée et modifie les produits. Pas de commandes, de promotions ni de paramètres.',
};

export const PROMO_CODE_TYPE_LABELS = {
  PERCENTAGE: 'Pourcentage de réduction',
  FIXED_AMOUNT: 'Montant retiré du total',
} as const;
