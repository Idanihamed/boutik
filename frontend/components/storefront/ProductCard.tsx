import Link from 'next/link';
import { formatPrice } from '../../lib/labels';
import type { Product } from '../../lib/types';

/** Carte produit : grande photo arrondie, badge de promo, prix barré, alerte de stock limité. */
export function ProductCard({ product, slug, currency }: { product: Product; slug: string; currency: string }) {
  const image = product.images.find((i) => i.isMain) ?? product.images[0];
  const soldOut = product.stockStatus === 'RUPTURE';
  const fewLeft = product.stockStatus === 'STOCK_FAIBLE' && product.stock > 0;

  return (
    <Link href={`/${slug}/produits/${product.slug}`} className={`group block ${soldOut ? 'opacity-70' : ''}`}>
      <div
        className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100"
        style={
          image
            ? undefined
            : { backgroundImage: 'repeating-linear-gradient(45deg, #F3ECDF 0 10px, #EDE3D0 10px 20px)' }
        }
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt ?? product.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Pas de photo</div>
        )}
        {product.onSale && !soldOut && (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-accent-600 px-2 py-1 text-xs font-bold text-white">
            {product.discountPercentage ? `−${product.discountPercentage} %` : 'Promo'}
          </span>
        )}
        {soldOut && (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white">Épuisé</span>
        )}
      </div>
      <div className="mt-2.5 space-y-1">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 group-hover:underline">{product.name}</h3>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-slate-900">{formatPrice(product.effectivePrice, currency)}</span>
          {product.onSale && <span className="text-[13px] text-slate-500 line-through">{formatPrice(product.price, currency)}</span>}
        </p>
        {fewLeft && <p className="text-[13px] font-semibold text-accent-700">Plus que {product.stock} en stock</p>}
      </div>
    </Link>
  );
}
