'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatPrice, STOCK_LABELS, STOCK_STYLES } from '../../lib/labels';
import type { Product, ProductVariant, Storefront } from '../../lib/types';
import { AddToCart } from './AddToCart';
import { ProductGallery } from './ProductGallery';

/**
 * Regroupe la galerie de photos et le sélecteur d'achat : ils doivent partager un même état
 * (la variante choisie) pour que la galerie puisse afficher SA photo, voir ProductGallery et
 * AddToCart. D'où ce composant client unique plutôt que deux composants indépendants, comme
 * c'était le cas avant l'ajout d'une photo par variante.
 */
export function ProductDetailMain({
  product,
  store,
  whatsapp,
}: {
  product: Product;
  store: Storefront;
  whatsapp: string | null;
}) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ProductGallery
        images={product.images}
        name={product.name}
        variantImage={selectedVariant?.image ?? null}
        variantLabel={selectedVariant?.label ?? null}
      />

      <div className="space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{product.name}</h1>
          {product.brand && <p className="text-sm text-slate-500">{product.brand.name}</p>}
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-bold text-slate-900">{formatPrice(product.effectivePrice, store.currency)}</span>
            {product.onSale && (
              <>
                <span className="text-slate-500 line-through">{formatPrice(product.price, store.currency)}</span>
                {product.discountPercentage ? (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">-{product.discountPercentage} %</span>
                ) : null}
              </>
            )}
          </p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STOCK_STYLES[product.stockStatus]}`}>
            {STOCK_LABELS[product.stockStatus]}
          </span>
        </div>

        {product.shortDescription && <p className="text-slate-700">{product.shortDescription}</p>}

        <AddToCart product={product} onVariantChange={setSelectedVariant} />

        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center justify-center rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Commander sur WhatsApp
          </a>
        )}

        {product.warranty && <p className="text-sm text-slate-600">Garantie : {product.warranty}</p>}
      </div>
    </div>
  );
}
