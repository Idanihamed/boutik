'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, listOrders } from '../../../lib/api';
import { formatDate, formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '../../../lib/labels';
import { useSession } from '../../../lib/session';
import type { AdminOrder, OrderStatus, Paginated } from '../../../lib/types';
import { Pagination } from '../../../components/Pagination';
import { Alert, Card, Select, Spinner } from '../../../components/ui';

export default function OrdersPage() {
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<AdminOrder> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setResult(await listOrders({ status: status || undefined, page }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les commandes.');
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Commandes</h1>
        <Select
          aria-label="Filtrer par statut"
          className="sm:max-w-[220px]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
        >
          <option value="">Toutes les commandes</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}
      {!result && !error && <Spinner />}

      {result && result.data.length === 0 && (
        <Card className="text-center text-slate-500">
          {status ? 'Aucune commande avec ce statut.' : 'Aucune commande pour l’instant. Elles apparaîtront ici dès qu’un client en passera une.'}
        </Card>
      )}

      {result && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((o) => (
            <li key={o.id}>
              <Link href={`/espace/commandes/${o.id}`} className="block">
                <Card className="flex flex-col gap-2 hover:border-brand-600 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{o.reference}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[o.status]}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="truncate text-sm text-slate-600">
                      {o.customerName} · {o.customerContact}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(o.createdAt)} · {o.items.length} article{o.items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-slate-900">{formatPrice(o.totalAmount, currency)}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && <Pagination meta={result.meta} onChange={setPage} />}
    </div>
  );
}
