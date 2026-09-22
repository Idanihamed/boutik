import type { ActivePromotion, Boutique, ContentPage, DirectoryEntry, Paginated, Product, PublicCategory, Storefront } from './types';

// Appels faits CÔTÉ SERVEUR (rendu des pages publiques, pour le référencement et le partage) :
// directs vers l'API, sans passer par le relais /api du navigateur.
const BACKEND = process.env.BACKEND_ORIGIN ?? 'http://localhost:3101';

// Court délai de cache : une vitrine suspendue ou un produit dépublié disparaît en quelques
// secondes, tout en évitant un appel à l'API par visiteur.
const REVALIDATE_SECONDS = 30;

/** Réponse publique d'une entreprise, ou null si elle n'existe pas / n'est pas visible (404). */
export async function storefrontGet<T>(slug: string, path = ''): Promise<T | null> {
  const res = await fetch(`${BACKEND}/api/b/${encodeURIComponent(slug)}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API indisponible (${res.status}).`);
  return (await res.json()) as T;
}

export const getStorefront = (slug: string) => storefrontGet<Storefront>(slug);
export const getCategories = (slug: string) => storefrontGet<PublicCategory[]>(slug, '/categories');
export const getActivePromotions = (slug: string) => storefrontGet<ActivePromotion[]>(slug, '/promotions/active');
export const getFeaturedProducts = (slug: string) => storefrontGet<Product[]>(slug, '/products/featured');

export function getProducts(
  slug: string,
  params: { search?: string; category?: string; sort?: string; available?: boolean; page?: number; limit?: number },
) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.sort) query.set('sort', params.sort);
  if (params.available) query.set('available', 'true');
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 12));
  return storefrontGet<Paginated<Product>>(slug, `/products?${query}`);
}

export const getProduct = (slug: string, productSlug: string) =>
  storefrontGet<{ product: Product; similarProducts: Product[] }>(slug, `/products/${encodeURIComponent(productSlug)}`);

export const getBoutiques = (slug: string) => storefrontGet<Boutique[]>(slug, '/boutiques');

/**
 * Page de contenu propre à l'entreprise (À propos, Livraison, ses propres conditions de
 * vente…), affichée sur une adresse racine de sa vitrine (/<slug>/<pageSlug>) — voir
 * PagesService.findOneBySlugPublic côté serveur pour la liste des segments réservés qu'une
 * page ne peut jamais prendre comme adresse (/produits, /boutiques...).
 */
export const getContentPage = (slug: string, pageSlug: string) =>
  storefrontGet<ContentPage>(slug, `/pages/${encodeURIComponent(pageSlug)}`);

/** Slugs des pages publiées d'une entreprise (pour son pied de page et son plan du site). */
export const getContentPageSlugs = (slug: string) =>
  storefrontGet<{ slug: string; title: string; updatedAt: string }[]>(slug, '/pages');

/** Annuaire des entreprises (public). Renvoie une liste vide si l'API ne répond pas : la page reste affichable. */
export async function getDirectory(params: { search?: string; country?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.country) query.set('country', params.country);
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 12));
  try {
    const res = await fetch(`${BACKEND}/api/directory?${query}`, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Paginated<DirectoryEntry>;
  } catch {
    return { data: [], meta: { page: 1, limit: params.limit ?? 12, total: 0, totalPages: 1 } } as Paginated<DirectoryEntry>;
  }
}
