/** Libellé usuel d'une devise : « FCFA » pour le franc CFA (XOF/XAF), le code ISO sinon. */
export function currencyLabel(currency: string): string {
  return currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency;
}

/** Montant entier suivi de la devise (ex. « 160 000 FCFA »). */
export function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currencyLabel(currency)}`;
}
