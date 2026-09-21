/** Adresse publique du site, sans « / » final. Se règle avec NEXT_PUBLIC_SITE_URL (utile avec un nom de domaine). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boutik-teal.vercel.app').replace(/\/+$/, '');
