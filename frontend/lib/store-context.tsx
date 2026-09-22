'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Storefront } from './types';

export interface CartItem {
  productId: string;
  /** Variante choisie (taille, couleur…) ; absente pour un produit sans variantes. */
  variantId?: string | null;
  /** Libellé de la variante (ex. « M · Rouge »), pour l'affichage seulement. */
  variantLabel?: string | null;
  slug: string;
  name: string;
  /** Prix unitaire vu à l'ajout, pour l'affichage seulement : le prix réel est recalculé par l'API à la commande. */
  price: number;
  image: string | null;
  quantity: number;
  /** Stock connu à l'ajout : borne la quantité choisie (l'API revérifie à la commande). */
  maxStock: number;
}

/** Deux lignes de panier sont le « même article » seulement si produit ET variante correspondent. */
function sameLine(a: { productId: string; variantId?: string | null }, b: { productId: string; variantId?: string | null }) {
  return a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);
}

interface StoreValue {
  store: Storefront;
  items: CartItem[];
  count: number;
  total: number;
  /** false tant que le panier enregistré n'est pas relu (évite un affichage « vide » trompeur). */
  ready: boolean;
  add: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  setQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  remove: (productId: string, variantId?: string | null) => void;
  clear: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Entreprise courante + panier. Le panier est propre à CHAQUE entreprise (une commande ne
 * concerne jamais qu'une seule entreprise) et vit dans le navigateur du client.
 */
export function StoreProvider({ store, children }: { store: Storefront; children: React.ReactNode }) {
  const storageKey = `boutik_cart_${store.slug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // stockage indisponible ou contenu illisible : on repart d'un panier vide
    }
    setReady(true);
  }, [storageKey]);

  const persist = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // le panier reste utilisable pour cette visite même sans stockage
      }
    },
    [storageKey],
  );

  const value = useMemo<StoreValue>(
    () => ({
      store,
      items,
      ready,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      add: (item, quantity) => {
        const existing = items.find((i) => sameLine(i, item));
        const capped = (q: number) => Math.max(1, Math.min(q, Math.max(item.maxStock, 1)));
        persist(
          existing
            ? items.map((i) => (sameLine(i, item) ? { ...i, ...item, quantity: capped(i.quantity + quantity) } : i))
            : [...items, { ...item, quantity: capped(quantity) }],
        );
      },
      setQuantity: (productId, variantId, quantity) =>
        persist(
          items.map((i) =>
            sameLine(i, { productId, variantId })
              ? { ...i, quantity: Math.max(1, Math.min(quantity, Math.max(i.maxStock, 1))) }
              : i,
          ),
        ),
      remove: (productId, variantId) => persist(items.filter((i) => !sameLine(i, { productId, variantId }))),
      clear: () => persist([]),
    }),
    [store, items, ready, persist],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore doit être utilisé sous <StoreProvider>.');
  return value;
}
