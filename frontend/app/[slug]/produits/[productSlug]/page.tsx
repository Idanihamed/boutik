import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getStorefront } from '../../../../lib/server-api';
import { formatPrice, STOCK_LABELS, STOCK_STYLES } from '../../../../lib/labels';
import { AddToCart } from '../../../../components/storefront/AddToCart';
import { ProductCard } from '../../../../components/storefront/ProductCard';
import { ProductGallery } from '../../../../components/storefront/ProductGallery';
import { whatsappUrl } from '../../../../components/storefront/StoreFooter';

type Props = { params: { slug: string; productSlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProduct(params.slug, params.productSlug);
  if (!data) return { title: 'Produit introuvable' };
  const { product } = data;
  const image = product.images.find((i) => i.isMain) ?? product.images[0];
  const description = product.shortDescription ?? product.description?.slice(0, 160) ?? undefined;
  return {
    title: product.name,
    description,
    openGraph: { title: product.name, description, images: image ? [image.url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, productSlug } = params;
  const [store, data] = await Promise.all([getStorefront(slug), getProduct(slug, productSlug)]);
  if (!store || !data) notFound();

  const { product, similarProducts } = data;
  const whatsapp = whatsappUrl(
    store.settings?.whatsappNumber,
    `Bonjour ${store.name}, je suis intéressé(e) par : ${product.name} (${formatPrice(product.effectivePrice, store.currency)}).`,
  );

  return (
    <div className="space-y-10">
      <nav aria-label="Fil d’Ariane" className="text-sm text-slate-500">
        <Link href={`/${slug}/produits`} className="hover:underline">
          Produits
        </Link>
        {product.category && (
          <>
            {' / '}
            <Link href={`/${slug}/produits?categorie=${encodeURIComponent(product.category.slug)}`} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />

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

          <AddToCart product={product} />

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

      {product.description && (
        <section aria-labelledby="description" className="space-y-2">
          <h2 id="description" className="text-lg font-bold text-slate-900">
            Description
          </h2>
          <p className="whitespace-pre-line text-slate-700">{product.description}</p>
        </section>
      )}

      {product.attributes.length > 0 && (
        <section aria-labelledby="caracteristiques" className="space-y-2">
          <h2 id="caracteristiques" className="text-lg font-bold text-slate-900">
            Caractéristiques
          </h2>
          <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {product.attributes.map((a) => (
              <div key={a.key} className="grid grid-cols-2 gap-2 px-4 py-3 text-sm">
                <dt className="font-medium text-slate-700">{a.key}</dt>
                <dd className="text-slate-900">{a.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {similarProducts.length > 0 && (
        <section aria-labelledby="similaires" className="space-y-3">
          <h2 id="similaires" className="text-lg font-bold text-slate-900">
            Produits similaires
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {similarProducts.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} slug={slug} currency={store.currency} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
