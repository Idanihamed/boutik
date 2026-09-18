import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getActivePromotions,
  getCategories,
  getFeaturedProducts,
  getProducts,
  getStorefront,
} from '../../lib/server-api';
import { ProductCard } from '../../components/storefront/ProductCard';

export default async function StorefrontHome({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const store = await getStorefront(slug);
  if (!store) notFound();

  const [categories, promotions, featured, latest] = await Promise.all([
    getCategories(slug),
    getActivePromotions(slug),
    getFeaturedProducts(slug),
    getProducts(slug, { sort: 'newest', limit: 8 }),
  ]);

  // Inséré dans un style CSS : n'accepte que des caractères d'URL courants (pas de guillemet ni de parenthèse).
  const heroRaw = store.settings?.heroImage1;
  const hero = heroRaw && /^[\w\-./:%?=&~]+$/.test(heroRaw) ? heroRaw : null;
  const banner = promotions?.[0];
  const featuredIds = new Set((featured ?? []).map((p) => p.id));
  const newest = (latest?.data ?? []).filter((p) => !featuredIds.has(p.id));

  return (
    <div className="space-y-10">
      <section
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-12 text-white sm:py-16"
        style={hero ? { backgroundImage: `linear-gradient(rgba(15,118,110,.75), rgba(15,118,110,.75)), url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <h1 className="text-3xl font-bold sm:text-4xl">{store.name}</h1>
        {store.description && <p className="mt-3 max-w-2xl text-base text-white/90 sm:text-lg">{store.description}</p>}
        <Link
          href={`/${slug}/produits`}
          className="mt-6 inline-block rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          Voir les produits
        </Link>
      </section>

      {banner && (
        <Link
          href={`/${slug}/produits`}
          className="block rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 hover:bg-red-100"
        >
          <p className="font-semibold">{banner.bannerTitle ?? banner.name}</p>
          {banner.bannerSubtitle && <p className="text-sm">{banner.bannerSubtitle}</p>}
        </Link>
      )}

      {categories && categories.length > 0 && (
        <section aria-labelledby="categories" className="space-y-3">
          <h2 id="categories" className="text-xl font-bold text-slate-900">
            Catégories
          </h2>
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${slug}/produits?categorie=${encodeURIComponent(c.slug)}`}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-brand-600 hover:text-brand-700"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured && featured.length > 0 && (
        <section aria-labelledby="mis-en-avant" className="space-y-3">
          <h2 id="mis-en-avant" className="text-xl font-bold text-slate-900">
            À la une
          </h2>
          <ProductGrid>
            {featured.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} slug={slug} currency={store.currency} />
              </li>
            ))}
          </ProductGrid>
        </section>
      )}

      {newest.length > 0 && (
        <section aria-labelledby="nouveautes" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="nouveautes" className="text-xl font-bold text-slate-900">
              Nouveautés
            </h2>
            <Link href={`/${slug}/produits`} className="text-sm font-medium text-brand-700 hover:underline">
              Tout voir
            </Link>
          </div>
          <ProductGrid>
            {newest.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} slug={slug} currency={store.currency} />
              </li>
            ))}
          </ProductGrid>
        </section>
      )}

      {(featured?.length ?? 0) === 0 && newest.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Cette boutique n’a pas encore de produit en vente.
        </p>
      )}
    </div>
  );
}

function ProductGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>;
}
