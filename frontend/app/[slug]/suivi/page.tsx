'use client';

import { useState } from 'react';
import { ApiError, request } from '../../../lib/api';
import { formatDate, formatPrice } from '../../../lib/labels';
import { useStore } from '../../../lib/store-context';
import type { OrderStatus, OrderTracking } from '../../../lib/types';
import { Alert, Button, Card, Field, Input } from '../../../components/ui';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'EN_ATTENTE', label: 'Reçue' },
  { status: 'CONFIRMEE', label: 'Confirmée' },
  { status: 'EN_PREPARATION', label: 'En préparation' },
  { status: 'EXPEDIEE', label: 'Expédiée' },
  { status: 'LIVREE', label: 'Livrée' },
];

export default function TrackOrderPage() {
  const { store } = useStore();
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const query = new URLSearchParams({ contact: contact.trim() });
      setOrder(await request<OrderTracking>(`/b/${store.slug}/orders/suivi/${encodeURIComponent(reference.trim())}?${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Recherche impossible. Vérifiez votre connexion.');
    } finally {
      setBusy(false);
    }
  }

  const currentStep = order ? STEPS.findIndex((s) => s.status === order.status) : -1;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Suivre ma commande</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Référence de la commande" htmlFor="t-ref">
            <Input id="t-ref" required autoCapitalize="characters" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label="Téléphone ou email utilisé à la commande" htmlFor="t-contact">
            <Input id="t-contact" required value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>
            Rechercher
          </Button>
        </form>
      </Card>

      {order && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Commande {order.reference}</h2>
            <span className="text-sm text-slate-500">{formatDate(order.createdAt)}</span>
          </div>

          {order.status === 'ANNULEE' ? (
            <Alert>Cette commande a été annulée.</Alert>
          ) : (
            <ol className="grid grid-cols-5 gap-1 text-center text-xs">
              {STEPS.map((step, i) => (
                <li key={step.status} className={i <= currentStep ? 'font-semibold text-brand-700' : 'text-slate-400'}>
                  <span
                    className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full text-white ${
                      i <= currentStep ? 'bg-brand-600' : 'bg-slate-300'
                    }`}
                  >
                    {i < currentStep ? '✓' : i + 1}
                  </span>
                  {step.label}
                </li>
              ))}
            </ol>
          )}

          <ul className="divide-y divide-slate-100 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-2 py-2">
                <span>
                  {item.quantity} × {item.productName}
                </span>
                <span className="font-medium">{formatPrice(item.subtotal, store.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-slate-200 pt-3 font-bold text-slate-900">
            <span>Total</span>
            <span>{formatPrice(order.totalAmount, store.currency)}</span>
          </p>
        </Card>
      )}
    </div>
  );
}
