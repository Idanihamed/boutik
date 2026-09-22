import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';
import { getContentPageSlugs, getDirectory } from '../lib/server-api';

// Le plan du site est recalculé au plus une fois par heure : une nouvelle boutique y apparaît sans redéploiement.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now },
    { url: `${SITE_URL}/entreprises`, lastModified: now },
    { url: `${SITE_URL}/inscription`, lastModified: now },
    { url: `${SITE_URL}/conditions`, lastModified: now },
    { url: `${SITE_URL}/confidentialite`, lastModified: now },
    { url: `${SITE_URL}/mentions-legales`, lastModified: now },
  ];

  // Chaque vitrine validée (avec au moins un produit), page par page.
  for (let page = 1; page <= 20; page++) {
    const result = await getDirectory({ page, limit: 100 });
    for (const shop of result.data) {
      pages.push({ url: `${SITE_URL}/${shop.slug}`, lastModified: now });
      pages.push({ url: `${SITE_URL}/${shop.slug}/produits`, lastModified: now });
      // Ses propres pages (À propos, Livraison, ses conditions de vente…) : jamais bloquant,
      // une entreprise sans page ne doit pas faire échouer le plan du site entier.
      const ownPages = await getContentPageSlugs(shop.slug).catch(() => null);
      for (const p of ownPages ?? []) {
        pages.push({ url: `${SITE_URL}/${shop.slug}/${p.slug}`, lastModified: new Date(p.updatedAt) });
      }
    }
    if (page >= result.meta.totalPages) break;
  }
  return pages;
}
