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
        className={`relative overflow-hidden rounded-3xl ${hero ? 'bg-slate-200 px-4 py-10 sm:px-6 sm:py-14' : 'bg-brand-700 px-6 py-12 text-white sm:py-16'}`}
        style={hero ? { backgroundImage: `url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {/*
          Photo affichée telle quelle, sans filtre ni teinte dessus (demandé par l'utilisateur) :
          la lisibilité du texte vient d'un bandeau blanc opaque posé SUR la photo, pas d'un
          voile de couleur qui la recouvrirait entièrement.
        */}
        <div className={hero ? 'inline-block max-w-xl rounded-2xl bg-white p-5 shadow-lg sm:p-7' : ''}>
          <h1 className={`text-3xl font-bold sm:text-4xl ${hero ? 'text-slate-900' : ''}`}>{store.name}</h1>
          {store.description && (
            <p className={`mt-3 max-w-2xl text-base sm:text-lg ${hero ? 'text-slate-600' : 'text-white/90'}`}>
              {store.description}
            </p>
          )}
          <Link
            href={`/${slug}/produits`}
            className={`mt-6 inline-block rounded-lg px-5 py-3 text-sm font-semibold ${
              hero ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-white text-brand-700 hover:bg-brand-50'
            }`}
          >
            Voir les produits
          </Link>
        </div>
      </section>

      {banner && (
        <Link
          href={`/${slug}/produits`}
          className="block rounded-3xl bg-accent-50 p-5 text-slate-900 hover:bg-[#F9DEC9]"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-accent-700">Offre en cours</p>
          <p className="mt-1 font-display text-2xl font-extrabold leading-tight">{banner.bannerTitle ?? banner.name}</p>
          {banner.bannerSubtitle && <p className="mt-1 text-[15px] text-slate-500">{banner.bannerSubtitle}</p>}
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
                  className="inline-flex min-h-[44px] items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:border-brand-600 hover:text-brand-700"
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
  return <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>;
}
