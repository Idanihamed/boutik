'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '../../lib/store-context';
import type { Product } from '../../lib/types';
import { Button } from '../ui';

export function AddToCart({ product }: { product: Product }) {
  const { store, add } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;
  const image = product.images.find((i) => i.isMain) ?? product.images[0];

  if (soldOut) {
    return <p className="rounded-lg bg-slate-100 p-3 text-center text-sm font-medium text-slate-600">Ce produit est en rupture de stock.</p>;
  }

  function handleAdd() {
    add(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.effectivePrice,
        image: image?.url ?? null,
        maxStock: product.stock,
      },
      quantity,
    );
    setAdded(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">Quantité</span>
        <div className="flex items-center rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            aria-label="Diminuer la quantité"
            className="min-h-[44px] min-w-[44px] text-xl text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={quantity <= 1}
            onClick={() => {
              setQuantity((q) => q - 1);
              setAdded(false);
            }}
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Augmenter la quantité"
            className="min-h-[44px] min-w-[44px] text-xl text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            disabled={quantity >= product.stock}
            onClick={() => {
              setQuantity((q) => q + 1);
              setAdded(false);
            }}
          >
            +
          </button>
        </div>
        <span className="text-xs text-slate-500">{product.stock} disponible{product.stock > 1 ? 's' : ''}</span>
      </div>
      <Button className="w-full" onClick={handleAdd}>
        Ajouter au panier
      </Button>
      {added && (
        <p role="status" className="text-center text-sm text-emerald-700">
          Ajouté au panier.{' '}
          <Link href={`/${store.slug}/panier`} className="font-medium underline">
            Voir le panier
          </Link>
        </p>
      )}
    </div>
  );
}
