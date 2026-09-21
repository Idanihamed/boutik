import type { Href } from 'expo-router';

/**
 * Convertit le lien d'une alerte (adresse de l'espace web, ex. « /espace/commandes ») en écran de
 * l'application. Renvoie null quand l'application n'a pas d'écran équivalent.
 */
export function screenFor(link: string | null | undefined): Href | null {
  if (!link) return null;
  if (link === '/espace/commandes') return '/(tabs)/commandes';
  if (link === '/espace/messages') return '/(tabs)/messages';
  const product = /^\/espace\/produits\/([\w-]+)$/.exec(link);
  if (product) return `/produit/${product[1]}`;
  return null;
}
