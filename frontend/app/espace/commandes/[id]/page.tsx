'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, getOrder, setOrderStatus } from '../../../../lib/api';
import {
  contactLinks,
  formatDate,
  formatPrice,
  NEXT_ORDER_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from '../../../../lib/labels';
import { useCan, useSession } from '../../../../lib/session';
import type { AdminOrder, OrderStatus } from '../../../../lib/types';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { Alert, Button, Card, Spinner } from '../../../../components/ui';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';

  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger cette commande.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: OrderStatus, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setOrderStatus(id, status);
      setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Changement de statut impossible.');
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  }

  if (error && !order) return <Alert>{error}</Alert>;
  if (!order) return <Spinner />;

  const next = order.status in NEXT_ORDER_STATUS ? NEXT_ORDER_STATUS[order.status as keyof typeof NEXT_ORDER_STATUS] : null;
  const canUpdate = can('orders:update');
  const links = contactLinks(order.customerContact);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/espace/commandes" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux commandes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Commande {order.reference}</h1>
          <p className="text-sm text-slate-500">Reçue le {formatDate(order.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${ORDER_STATUS_STYLES[order.status]}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {canUpdate && (
        <Card className="space-y-3">
          <h2 className="font-semibold text-slate-900">Traitement</h2>
          <div className="flex flex-wrap gap-2">
            {next && (
              <Button disabled={busy} onClick={() => changeStatus(next, 'Statut mis à jour.')}>
                {NEXT_ORDER_LABELS[order.status as keyof typeof NEXT_ORDER_LABELS]}
              </Button>
            )}
            {order.status !== 'ANNULEE' && order.status !== 'LIVREE' && (
              <Button variant="danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
                Annuler la commande
              </Button>
            )}
            {order.status === 'ANNULEE' && (
              <Button variant="secondary" disabled={busy} onClick={() => changeStatus('EN_ATTENTE', 'Commande réactivée.')}>
                Réactiver la commande
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Annuler une commande remet ses articles en stock ; la réactiver les retire de nouveau du stock.
          </p>
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="font-semibold text-slate-900">Client</h2>
        <p className="text-slate-800">{order.customerName}</p>
        <p className="text-sm text-slate-600">{order.customerContact}</p>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
        {order.customerAddress && (
          <p className="pt-2 text-sm text-slate-700">
            <strong>Adresse :</strong> {order.customerAddress}
          </p>
        )}
        {order.boutique && (
          <p className="text-sm text-slate-700">
            <strong>Retrait :</strong> {order.boutique.name} — {order.boutique.address}
          </p>
        )}
        {order.notes && (
          <p className="text-sm text-slate-700">
            <strong>Précisions :</strong> {order.notes}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-slate-900">Articles</h2>
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
        <p className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900">
          <span>Total</span>
          <span>{formatPrice(order.totalAmount, currency)}</span>
        </p>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        title="Annuler cette commande ?"
        message="Les articles seront remis en stock. Vous pourrez la réactiver plus tard si le stock le permet."
        confirmLabel="Annuler la commande"
        busy={busy}
        onConfirm={() => changeStatus('ANNULEE', 'Commande annulée.')}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
