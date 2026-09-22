'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, getMyOrder } from '../../../lib/api';
import { formatDate, formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '../../../lib/labels';
import { OrderTimeline } from '../../../components/OrderTimeline';
import { useSession } from '../../../lib/session';
import type { MyOrderDetail } from '../../../lib/types';
import { Alert, Card, Spinner } from '../../../components/ui';

export default function MyOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<MyOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace(`/connexion?retour=/mes-commandes/${id}`);
  }, [sessionLoading, user, router, id]);

  useEffect(() => {
    if (!user) return;
    getMyOrder(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger cette commande.'));
  }, [user, id]);

  if (sessionLoading || !user) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!order) return <Spinner />;

  const currency = order.business.currency;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/mes-commandes" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Mes commandes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{order.business.name}</p>
          <h1 className="text-2xl font-bold text-slate-900">Commande {order.reference}</h1>
          <p className="text-sm text-slate-500">Passée le {formatDate(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${ORDER_STATUS_STYLES[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <Card>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">Avancement</h2>
        <OrderTimeline status={order.status} />
      </Card>

      {(order.customerAddress || order.boutique) && (
        <Card className="space-y-1">
          <h2 className="font-bold text-slate-900">Réception</h2>
          {order.boutique ? (
            <p className="text-slate-700">
              Retrait en boutique : {order.boutique.name} — {order.boutique.address}
            </p>
          ) : (
            <p className="text-slate-700">Livraison à : {order.customerAddress}</p>
          )}
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Articles</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span>
                {item.quantity} × {item.productName}
                <span className="block text-xs text-slate-500">{formatPrice(item.unitPrice, currency)} l’unité</span>
              </span>
              <span className="shrink-0 font-medium">{formatPrice(item.subtotal, currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          {(order.discountAmount > 0 || order.shippingFee > 0) && (
            <div className="flex justify-between text-slate-600">
              <dt>Sous-total</dt>
              <dd>{formatPrice(order.totalAmount + order.discountAmount - order.shippingFee, currency)}</dd>
            </div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>Code {order.promoCode}</dt>
              <dd>−{formatPrice(order.discountAmount, currency)}</dd>
            </div>
          )}
          {order.shippingFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Livraison</dt>
              <dd>{formatPrice(order.shippingFee, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-slate-900">
            <dt>Total</dt>
            <dd>{formatPrice(order.totalAmount, currency)}</dd>
          </div>
        </dl>
      </Card>

      <Link href={`/${order.business.slug}`} className="block text-center text-sm font-semibold text-brand-700 hover:underline">
        Retourner à la boutique {order.business.name}
      </Link>
    </div>
  );
}
