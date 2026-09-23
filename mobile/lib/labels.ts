import type { MessageStatus, OrderStatus, PromotionDisplayStatus, PromotionType, StockStatus } from './types';

// Identité Boutik : vert et crème, alignée sur le site (frontend/tailwind.config.ts).
export const COLORS = {
  brand: '#0E6B57',
  brandLight: '#DCEFE7',
  accent: '#C2410C',
  accentLight: '#FCE9DC',
  text: '#1B1F1D',
  muted: '#5A625D',
  border: '#E8E0D3',
  background: '#FAF6EF',
  card: '#ffffff',
  danger: '#b91c1c',
} as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  EN_PREPARATION: 'En préparation',
  EXPEDIEE: 'Expédiée',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
};

// Couleurs de fond et de texte de la pastille de statut.
export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string }> = {
  EN_ATTENTE: { bg: '#fef3c7', fg: '#92400e' },
  CONFIRMEE: { bg: '#e0f2fe', fg: '#075985' },
  EN_PREPARATION: { bg: '#e0e7ff', fg: '#3730a3' },
  EXPEDIEE: { bg: '#ede9fe', fg: '#5b21b6' },
  LIVREE: { bg: '#d1fae5', fg: '#065f46' },
  ANNULEE: { bg: '#e2e8f0', fg: '#334155' },
};

/** Étape suivante « naturelle » d'une commande (absente pour une commande livrée ou annulée). */
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  EN_ATTENTE: 'CONFIRMEE',
  CONFIRMEE: 'EN_PREPARATION',
  EN_PREPARATION: 'EXPEDIEE',
  EXPEDIEE: 'LIVREE',
};

export const NEXT_ORDER_LABELS: Partial<Record<OrderStatus, string>> = {
  EN_ATTENTE: 'Confirmer la commande',
  CONFIRMEE: 'Passer en préparation',
  EN_PREPARATION: 'Marquer comme expédiée',
  EXPEDIEE: 'Marquer comme livrée',
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  NOUVEAU: 'Nouveau',
  LU: 'Lu',
  TRAITE: 'Traité',
};

export const MESSAGE_STATUS_COLORS: Record<MessageStatus, { bg: string; fg: string }> = {
  NOUVEAU: { bg: '#fef3c7', fg: '#92400e' },
  LU: { bg: '#e2e8f0', fg: '#334155' },
  TRAITE: { bg: '#d1fae5', fg: '#065f46' },
};

/** Libellé usuel d'une devise : « FCFA » pour le franc CFA (XOF/XAF), le code ISO sinon. */
export function currencyLabel(currency: string): string {
  return currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
}

/** Montant entier suivi de la devise. */
export function formatPrice(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currencyLabel(currency)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Liens pour joindre un client : email, sinon téléphone (appel + WhatsApp si numéro international). */
export function contactLinks(contact: string): { url: string; label: string }[] {
  const value = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return [{ url: `mailto:${value}`, label: 'Écrire un email' }];
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) return [];
  const links = [{ url: `tel:${value.replace(/[^\d+]/g, '')}`, label: 'Appeler' }];
  if (value.startsWith('+') || value.startsWith('00')) {
    links.push({ url: `https://wa.me/${value.startsWith('00') ? digits.slice(2) : digits}`, label: 'WhatsApp' });
  }
  return links;
}

export const PROMOTION_STATUS_LABELS: Record<PromotionDisplayStatus, string> = {
  DRAFT: 'Brouillon',
  SCHEDULED: 'Programmée',
  ACTIVE: 'En cours',
  EXPIRED: 'Terminée',
  DISABLED: 'Désactivée',
};

export const PROMOTION_STATUS_COLORS: Record<PromotionDisplayStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: '#e2e8f0', fg: '#334155' },
  SCHEDULED: { bg: '#e0f2fe', fg: '#075985' },
  ACTIVE: { bg: '#d1fae5', fg: '#065f46' },
  EXPIRED: { bg: '#e2e8f0', fg: '#5A625D' },
  DISABLED: { bg: '#fef3c7', fg: '#92400e' },
};

/** Résumé lisible de la réduction, ex. « -20 % » ou « -500 FCFA ». */
export function describePromotionValue(type: PromotionType, value: number, currency: string): string {
  if (type === 'PERCENTAGE') return `-${value} %`;
  if (type === 'FIXED_AMOUNT') return `-${formatPrice(value, currency)}`;
  return `Prix : ${formatPrice(value, currency)}`;
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Responsable',
  GESTIONNAIRE: 'Gestionnaire',
  EDITEUR: 'Éditeur',
};

export const STOCK_LABELS: Record<StockStatus, string> = {
  DISPONIBLE: 'En stock',
  STOCK_FAIBLE: 'Stock faible',
  RUPTURE: 'Rupture',
};

export const STOCK_COLORS: Record<StockStatus, { bg: string; fg: string }> = {
  DISPONIBLE: { bg: '#d1fae5', fg: '#065f46' },
  STOCK_FAIBLE: { bg: '#fef3c7', fg: '#92400e' },
  RUPTURE: { bg: '#fee2e2', fg: '#991b1b' },
};
