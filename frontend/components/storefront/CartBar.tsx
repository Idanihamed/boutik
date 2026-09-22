'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatPrice } from '../../lib/labels';
import { useStore } from '../../lib/store-context';

/**
 * Barre fixe en bas de l'écran : rappelle le panier et mène à la commande. Masquée sur le
 * panier et la commande (leur propre écran couvre déjà ce besoin), et sur la fiche d'un
 * produit précis (`/produits/<slug>`, pas le catalogue `/produits`) : cette page a son propre
 * bouton "Ajouter au panier" en bas de son contenu, et un produit à variantes (sélecteur
 * taille/couleur) y ajoute assez de hauteur pour que, sans cette exclusion, la barre flottante
 * recouvre les boutons de sélection dès le premier affichage sur mobile — repéré en testant le
 * sélecteur de variantes dans un vrai navigateur.
 */
export function CartBar() {
  const { store, count, total, ready } = useStore();
  const pathname = usePathname();
  const base = `/${store.slug}`;

  if (
    !ready ||
    count === 0 ||
    pathname.startsWith(`${base}/panier`) ||
    pathname.startsWith(`${base}/commande`) ||
    pathname.startsWith(`${base}/produits/`)
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4">
      <Link
        href={`${base}/panier`}
        className="pointer-events-auto mx-auto flex h-[60px] max-w-md items-center justify-between rounded-2xl bg-brand-600 px-5 text-white shadow-[0_10px_28px_rgba(14,107,87,0.35)] hover:bg-brand-700"
      >
        <span className="text-base font-bold">
          Voir le panier · {count} article{count > 1 ? 's' : ''}
        </span>
        <span className="text-base font-bold">{formatPrice(total, store.currency)}</span>
      </Link>
    </div>
  );
}
