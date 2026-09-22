'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, listMyOrders } from '../../lib/api';
import { formatDate, formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '../../lib/labels';
import { Pagination } from '../../components/Pagination';
import { useSession } from '../../lib/session';
import type { MyOrderRow } from '../../lib/types';
import { Alert, Card, Spinner } from '../../components/ui';

export default function MyOrdersPage() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: MyOrderRow[]; meta: { page: number; totalPages: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) router.replace('/connexion?retour=/mes-commandes');
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    listMyOrders(page)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger vos commandes.'));
  }, [user, page]);

  if (sessionLoading || !user) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Mes commandes</h1>

      {error && <Alert>{error}</Alert>}
      {!result && !error && <Spinner />}

      {result && result.data.length === 0 && (
        <Card className="text-center text-slate-500">
          Vous n’avez pas encore de commande. Elles apparaîtront ici dès que vous en passerez une, connecté à votre
          compte.
        </Card>
      )}

      {result && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((order) => (
            <li key={order.id}>
              <Link href={`/mes-commandes/${order.id}`}>
                <Card className="flex items-center justify-between gap-3 hover:border-brand-600">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{order.business.name}</p>
                    <p className="text-sm text-slate-500">
                      {order.reference} · {formatDate(order.createdAt)} · {order.itemCount} article
                      {order.itemCount > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-bold text-slate-900">{formatPrice(order.totalAmount, order.business.currency)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ORDER_STATUS_STYLES[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && result.meta.totalPages > 1 && <Pagination meta={result.meta} onChange={setPage} />}
    </div>
  );
}
