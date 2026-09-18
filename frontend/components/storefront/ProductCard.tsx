import Link from 'next/link';
import { formatPrice } from '../../lib/labels';
import type { Product } from '../../lib/types';

export function ProductCard({ product, slug, currency }: { product: Product; slug: string; currency: string }) {
  const image = product.images.find((i) => i.isMain) ?? product.images[0];
  const soldOut = product.stockStatus === 'RUPTURE';

  return (
    <Link
      href={`/${slug}/produits/${product.slug}`}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-square bg-slate-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt ?? product.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Pas de photo</div>
        )}
        {product.onSale && !soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            {product.discountPercentage ? `-${product.discountPercentage} %` : 'Promo'}
          </span>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
            Rupture
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:underline">{product.name}</h3>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-slate-900">{formatPrice(product.effectivePrice, currency)}</span>
          {product.onSale && (
            <span className="text-xs text-slate-500 line-through">{formatPrice(product.price, currency)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
