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
