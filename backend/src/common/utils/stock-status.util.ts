export type StockStatus = 'DISPONIBLE' | 'STOCK_FAIBLE' | 'RUPTURE';

/**
 * Dérive l'état du stock affiché publiquement (§12 du cahier des charges) :
 * un stock à zéro est toujours "RUPTURE", même si le seuil de stock faible est à zéro.
 */
export function computeStockStatus(stock: number, lowStockThreshold: number): StockStatus {
  if (stock <= 0) return 'RUPTURE';
  if (stock <= lowStockThreshold) return 'STOCK_FAIBLE';
  return 'DISPONIBLE';
}
