'use client';

import { useState } from 'react';
import { ApiError, request } from '../../../lib/api';
import { formatDate, formatPrice, MESSAGE_STATUS_LABELS } from '../../../lib/labels';
import { useStore } from '../../../lib/store-context';
import type { MessageTracking, OrderStatus, OrderTracking } from '../../../lib/types';
import { Alert, Button, Card, Field, Input } from '../../../components/ui';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'EN_ATTENTE', label: 'Reçue' },
  { status: 'CONFIRMEE', label: 'Confirmée' },
  { status: 'EN_PREPARATION', label: 'En préparation' },
  { status: 'EXPEDIEE', label: 'Expédiée' },
  { status: 'LIVREE', label: 'Livrée' },
];

type Kind = 'commande' | 'message';

export default function TrackingPage() {
  const { store } = useStore();
  const [kind, setKind] = useState<Kind>('commande');
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [message, setMessage] = useState<MessageTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchKind(next: Kind) {
    setKind(next);
    setOrder(null);
    setMessage(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOrder(null);
    setMessage(null);
    try {
      const query = new URLSearchParams({ contact: contact.trim() });
      const ref = encodeURIComponent(reference.trim());
      if (kind === 'commande') {
        setOrder(await request<OrderTracking>(`/b/${store.slug}/orders/suivi/${ref}?${query}`));
      } else {
        setMessage(await request<MessageTracking>(`/b/${store.slug}/contact/suivi/${ref}?${query}`));
      }
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
        <h1 className="text-2xl font-bold text-slate-900">Suivi</h1>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {(['commande', 'message'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => switchKind(k)}
              className={`min-h-[44px] rounded-md text-sm font-medium ${kind === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'}`}
            >
              {k === 'commande' ? 'Ma commande' : 'Mon message'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label={kind === 'commande' ? 'Référence de la commande' : 'Référence du message'} htmlFor="t-ref">
            <Input id="t-ref" required autoCapitalize="characters" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field label={kind === 'commande' ? 'Téléphone ou email utilisé à la commande' : 'Téléphone ou email utilisé pour le message'} htmlFor="t-contact">
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
          <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            {(order.discountAmount > 0 || order.shippingFee > 0) && (
              <div className="flex justify-between text-slate-600">
                <dt>Sous-total</dt>
                <dd>{formatPrice(order.totalAmount + order.discountAmount - order.shippingFee, store.currency)}</dd>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Code {order.promoCode}</dt>
                <dd>−{formatPrice(order.discountAmount, store.currency)}</dd>
              </div>
            )}
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-slate-600">
                <dt>Livraison</dt>
                <dd>{formatPrice(order.shippingFee, store.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900">
              <dt>Total</dt>
              <dd>{formatPrice(order.totalAmount, store.currency)}</dd>
            </div>
          </dl>
        </Card>
      )}

      {message && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{message.subject}</h2>
            <span className="text-sm text-slate-500">{formatDate(message.createdAt)}</span>
          </div>
          <p className="text-sm text-slate-600">
            Statut : <strong>{MESSAGE_STATUS_LABELS[message.status]}</strong>
          </p>
          {message.reply || message.replyVoiceUrl ? (
            <div className="space-y-2 rounded-lg bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                Réponse de {store.name}
                {message.repliedAt ? ` · ${formatDate(message.repliedAt)}` : ''}
              </p>
              {message.reply && <p className="whitespace-pre-line text-slate-800">{message.reply}</p>}
              {message.replyVoiceUrl && <audio src={message.replyVoiceUrl} controls className="w-full" />}
            </div>
          ) : (
            <Alert kind="info">{store.name} n’a pas encore répondu. Revenez consulter cette page plus tard.</Alert>
          )}
        </Card>
      )}
    </div>
  );
}
