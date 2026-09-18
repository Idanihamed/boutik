'use client';

import Link from 'next/link';
import { formatPrice } from '../../../lib/labels';
import { useStore } from '../../../lib/store-context';
import { Button, Card, Spinner } from '../../../components/ui';

export default function CartPage() {
  const { store, items, total, ready, setQuantity, remove } = useStore();
  const base = `/${store.slug}`;

  if (!ready) return <Spinner />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Votre panier est vide</h1>
        <p className="text-slate-600">Parcourez les produits de {store.name} pour en ajouter.</p>
        <Link href={`${base}/produits`} className="inline-block rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
          Voir les produits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Votre panier</h1>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.productId}>
            <Card className="flex gap-3">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-20 w-20 shrink-0 rounded-lg bg-slate-100" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <Link href={`${base}/produits/${item.slug}`} className="block truncate font-medium text-slate-900 hover:underline">
                  {item.name}
                </Link>
                <p className="text-sm text-slate-600">{formatPrice(item.price, store.currency)}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white">
                    <button
                      type="button"
                      aria-label={`Diminuer la quantité de ${item.name}`}
                      className="min-h-[44px] min-w-[44px] text-xl hover:bg-slate-50 disabled:opacity-40"
                      disabled={item.quantity <= 1}
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center font-medium">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Augmenter la quantité de ${item.name}`}
                      className="min-h-[44px] min-w-[44px] text-xl hover:bg-slate-50 disabled:opacity-40"
                      disabled={item.quantity >= item.maxStock}
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => remove(item.productId)} className="min-h-[44px] px-2 text-sm text-red-700 hover:underline">
                    Retirer
                  </button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-700">Total</span>
          <span className="text-2xl font-bold text-slate-900">{formatPrice(total, store.currency)}</span>
        </div>
        <p className="text-xs text-slate-500">Le prix définitif est confirmé lors de la commande.</p>
        <Link href={`${base}/commande`}>
          <Button className="w-full">Passer la commande</Button>
        </Link>
      </Card>
    </div>
  );
}
