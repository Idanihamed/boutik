'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatPrice } from '../../lib/labels';
import { useStore } from '../../lib/store-context';
import type { Product, ProductVariant } from '../../lib/types';
import { Button } from '../ui';

export function AddToCart({ product }: { product: Product }) {
  const { store, add } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const image = product.images.find((i) => i.isMain) ?? product.images[0];

  if (product.hasVariants) {
    return <VariantAddToCart product={product} />;
  }

  const soldOut = product.stock <= 0;
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

/**
 * Produit à variantes (taille, couleur…) : le client doit choisir une valeur par dimension
 * avant de pouvoir ajouter au panier. Les combinaisons sans variante active/en stock sont
 * désactivées plutôt que masquées, pour que le client comprenne pourquoi elles sont indisponibles.
 */
function VariantAddToCart({ product }: { product: Product }) {
  const { store, add } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const image = product.images.find((i) => i.isMain) ?? product.images[0];

  const activeVariants = useMemo(() => product.variants.filter((v) => v.isActive), [product.variants]);
  const option1Values = useMemo(() => uniqueValues(activeVariants, 'option1Value'), [activeVariants]);
  const option2Values = useMemo(() => uniqueValues(activeVariants, 'option2Value'), [activeVariants]);

  const [option1, setOption1] = useState<string | null>(option1Values.length === 1 ? option1Values[0] : null);
  const [option2, setOption2] = useState<string | null>(option2Values.length === 1 ? option2Values[0] : null);

  const selected = useMemo(
    () =>
      activeVariants.find(
        (v) => (v.option1Value ?? null) === option1 && (v.option2Value ?? null) === option2,
      ) ?? null,
    [activeVariants, option1, option2],
  );

  const needsOption1 = option1Values.length > 0;
  const needsOption2 = option2Values.length > 0;
  const complete = (!needsOption1 || option1 !== null) && (!needsOption2 || option2 !== null);
  const soldOut = complete && (!selected || selected.stock <= 0);

  function isOption1Available(value: string) {
    return activeVariants.some((v) => v.option1Value === value && (option2 === null || v.option2Value === option2) && v.stock > 0);
  }
  function isOption2Available(value: string) {
    return activeVariants.some((v) => v.option2Value === value && (option1 === null || v.option1Value === option1) && v.stock > 0);
  }

  function handleAdd() {
    if (!selected) return;
    add(
      {
        productId: product.id,
        variantId: selected.id,
        variantLabel: selected.label || null,
        slug: product.slug,
        name: product.name,
        price: selected.effectivePrice,
        image: selected.image ?? image?.url ?? null,
        maxStock: selected.stock,
      },
      quantity,
    );
    setAdded(true);
  }

  return (
    <div className="space-y-4">
      {needsOption1 && (
        <OptionPicker
          label={product.variantOption1Name ?? 'Option'}
          values={option1Values}
          selected={option1}
          isAvailable={isOption1Available}
          onSelect={(v) => {
            setOption1(v);
            setAdded(false);
          }}
        />
      )}
      {needsOption2 && (
        <OptionPicker
          label={product.variantOption2Name ?? 'Option'}
          values={option2Values}
          selected={option2}
          isAvailable={isOption2Available}
          onSelect={(v) => {
            setOption2(v);
            setAdded(false);
          }}
        />
      )}

      {complete && selected && (
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-xl font-bold text-slate-900">{formatPrice(selected.effectivePrice, store.currency)}</span>
          {selected.onSale && (
            <span className="text-slate-500 line-through">{formatPrice(selected.price, store.currency)}</span>
          )}
        </p>
      )}

      {complete && soldOut && (
        <p className="rounded-lg bg-slate-100 p-3 text-center text-sm font-medium text-slate-600">
          Cette combinaison est en rupture de stock.
        </p>
      )}

      {complete && selected && !soldOut && (
        <>
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
                disabled={quantity >= selected.stock}
                onClick={() => {
                  setQuantity((q) => q + 1);
                  setAdded(false);
                }}
              >
                +
              </button>
            </div>
            <span className="text-xs text-slate-500">{selected.stock} disponible{selected.stock > 1 ? 's' : ''}</span>
          </div>
          <Button className="w-full" onClick={handleAdd}>
            Ajouter au panier
          </Button>
        </>
      )}

      {!complete && <p className="text-sm text-slate-500">Choisissez {needsOption1 && !option1 ? (product.variantOption1Name ?? 'une option') : (product.variantOption2Name ?? 'une option')} pour continuer.</p>}

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

function uniqueValues(variants: ProductVariant[], key: 'option1Value' | 'option2Value'): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of variants) {
    const value = v[key];
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function OptionPicker({
  label,
  values,
  selected,
  isAvailable,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string | null;
  isAvailable: (value: string) => boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const available = isAvailable(value);
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              disabled={!available}
              onClick={() => onSelect(value)}
              className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium transition ${
                isSelected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : available
                    ? 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 line-through'
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
