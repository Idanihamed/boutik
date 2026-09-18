import type { ActivePromotion, Paginated, Product, PublicCategory, Storefront } from './types';

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
