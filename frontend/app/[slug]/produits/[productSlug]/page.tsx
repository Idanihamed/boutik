import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getStorefront } from '../../../../lib/server-api';
import { formatPrice } from '../../../../lib/labels';
import { ProductCard } from '../../../../components/storefront/ProductCard';
import { ProductDetailMain } from '../../../../components/storefront/ProductDetailMain';
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

      <ProductDetailMain product={product} store={store} whatsapp={whatsapp} />

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
