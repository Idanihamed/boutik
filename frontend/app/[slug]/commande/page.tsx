'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, request } from '../../../lib/api';
import { formatPrice } from '../../../lib/labels';
import { useStore } from '../../../lib/store-context';
import type { Boutique, OrderQuote } from '../../../lib/types';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../../../components/ui';

interface Confirmation {
  reference: string;
  totalAmount: number;
}

type Mode = 'delivery' | 'pickup';

export default function CheckoutPage() {
  const { store, items, total, ready, clear } = useStore();
  const base = `/${store.slug}`;

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [website, setWebsite] = useState(''); // piège à robots : reste vide pour un humain
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Confirmation | null>(null);

  // Retrait en boutique (proposé seulement si l'entreprise a des boutiques actives).
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [mode, setMode] = useState<Mode>('delivery');
  const [boutiqueId, setBoutiqueId] = useState('');

  // Code promo : `applied` est le code que le serveur a accepté ; il reste appliqué si le panier change.
  const [promoInput, setPromoInput] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  // Montants calculés par le serveur (la seule source de vérité : ce sont eux qui seront facturés).
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const pickup = mode === 'pickup' && boutiqueId !== '';

  useEffect(() => {
    request<Boutique[]>(`/b/${store.slug}/boutiques`)
      .then((list) => setBoutiques(list))
      .catch(() => setBoutiques([]));
  }, [store.slug]);

  const fetchQuote = useCallback(
    (promoCode: string | null) =>
      request<OrderQuote>(`/b/${store.slug}/orders/quote`, {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: i.quantity })),
          boutiqueId: pickup ? boutiqueId : undefined,
          promoCode: promoCode ?? undefined,
        }),
      }),
    [store.slug, items, pickup, boutiqueId],
  );

  // Recalcule le total quand le panier, le mode de retrait ou le code appliqué change.
  useEffect(() => {
    if (!ready || items.length === 0) return;
    let active = true;
    fetchQuote(applied)
      .then((q) => {
        if (!active) return;
        setQuote(q);
        setQuoteError(null);
        // Un code qui n'est plus valable (panier modifié sous le minimum...) est retiré, avec la raison.
        if (applied && q.promoCode && !q.promoCode.valid) {
          setApplied(null);
          setPromoError(q.promoCode.message);
        }
      })
      .catch((err) => {
        if (active) setQuoteError(err instanceof ApiError ? err.message : 'Impossible de calculer le total.');
      });
    return () => {
      active = false;
    };
  }, [ready, items, fetchQuote, applied]);

  /** Vérifie le code saisi auprès du serveur. Renvoie true s'il est accepté. */
  async function applyCode(): Promise<boolean> {
    const code = promoInput.trim();
    if (!code) return true;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const q = await fetchQuote(code);
      if (q.promoCode?.valid) {
        setApplied(q.promoCode.code);
        setPromoInput(q.promoCode.code);
        setQuote(q);
        return true;
      }
      setPromoError(q.promoCode?.message ?? 'Ce code promo n’est pas valable.');
      return false;
    } catch (err) {
      setPromoError(err instanceof ApiError ? err.message : 'Impossible de vérifier le code.');
      return false;
    } finally {
      setPromoBusy(false);
    }
  }

  function removeCode() {
    setApplied(null);
    setPromoInput('');
    setPromoError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'pickup' && !boutiqueId) return setError('Choisissez la boutique où retirer votre commande.');

    // Code saisi mais pas encore appliqué : on le vérifie d'abord, pour ne jamais facturer autre chose que ce qui est affiché.
    let code = applied;
    if (promoInput.trim() && promoInput.trim().toUpperCase() !== applied) {
      if (!(await applyCode())) return setError('Corrigez ou retirez le code promo avant d’envoyer la commande.');
      code = promoInput.trim().toUpperCase();
    }

    setBusy(true);
    try {
      const res = await request<{ success: boolean; reference?: string; totalAmount?: number }>(`/b/${store.slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: name.trim(),
          customerContact: contact.trim(),
          customerAddress: mode === 'delivery' ? address.trim() || undefined : undefined,
          boutiqueId: pickup ? boutiqueId : undefined,
          promoCode: code ?? undefined,
          notes: notes.trim() || undefined,
          website: website || undefined,
          paymentReference: paymentReference.trim() || undefined,
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: i.quantity })),
        }),
      });
      if (res.reference) {
        setDone({ reference: res.reference, totalAmount: res.totalAmount ?? quote?.total ?? total });
        clear();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La commande n’a pas pu être envoyée. Vérifiez votre connexion.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Spinner />;

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Commande envoyée</h1>
          <p className="text-slate-600">
            Merci ! {store.name} vous contactera pour confirmer votre commande de{' '}
            <strong>{formatPrice(done.totalAmount, store.currency)}</strong>.
          </p>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Votre référence</p>
            <p className="text-2xl font-bold tracking-widest text-slate-900">{done.reference}</p>
            <p className="mt-1 text-xs text-slate-500">Notez-la : elle permet de suivre votre commande.</p>
          </div>
          <Link href={`${base}/suivi`} className="inline-block rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
            Suivre ma commande
          </Link>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-slate-600">Votre panier est vide.</p>
        <Link href={`${base}/produits`} className="font-medium text-brand-700 hover:underline">
          Voir les produits
        </Link>
      </div>
    );
  }

  const subtotal = quote?.subtotal ?? total;
  const remainingForFree =
    quote && quote.shippingFee > 0 && quote.freeShippingThreshold !== null
      ? quote.freeShippingThreshold - (quote.subtotal - quote.discount)
      : 0;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
      <Card className="space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Finaliser la commande</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Votre nom" htmlFor="c-name">
            <Input id="c-name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Téléphone ou email" htmlFor="c-contact" hint="Pour vous joindre au sujet de votre commande.">
            <Input id="c-contact" autoComplete="email tel" required minLength={3} maxLength={150} value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>

          {boutiques.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-slate-700">Réception de la commande</legend>
              <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-slate-200 px-3">
                <input type="radio" name="mode" checked={mode === 'delivery'} onChange={() => setMode('delivery')} />
                <span>Livraison à domicile</span>
              </label>
              <label className="flex min-h-[44px] items-center gap-3 rounded-lg border border-slate-200 px-3">
                <input type="radio" name="mode" checked={mode === 'pickup'} onChange={() => setMode('pickup')} />
                <span>Retrait en boutique (sans frais de livraison)</span>
              </label>
              {mode === 'pickup' && (
                <Select aria-label="Boutique de retrait" required value={boutiqueId} onChange={(e) => setBoutiqueId(e.target.value)}>
                  <option value="">Choisir une boutique…</option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.address}
                    </option>
                  ))}
                </Select>
              )}
            </fieldset>
          )}

          {mode === 'delivery' && (
            <Field label="Adresse de livraison (facultatif)" htmlFor="c-address">
              <Input id="c-address" autoComplete="street-address" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          )}
          <Field label="Précisions (facultatif)" htmlFor="c-notes">
            <Textarea id="c-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          {store.settings?.mobileMoneyNumber && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="font-semibold text-emerald-900">Paiement {store.settings.mobileMoneyProvider || 'Mobile Money'}</h2>
              <p className="text-sm text-emerald-800">
                Envoyez le montant de votre commande au <strong>{store.settings.mobileMoneyNumber}</strong>
                {store.settings.mobileMoneyProvider ? ` (${store.settings.mobileMoneyProvider})` : ''}, puis indiquez ci-dessous la
                référence reçue par SMS pour que {store.name} retrouve facilement votre paiement. {store.name} ne reçoit
                aucune confirmation automatique : vérifiez avec eux avant d’envoyer si vous avez un doute.
              </p>
              <Field label="Référence de la transaction (facultatif)" htmlFor="c-payment-ref">
                <Input
                  id="c-payment-ref"
                  maxLength={60}
                  placeholder="Ex. MP240922.1234.A56789"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="c-promo" className="block text-sm font-medium text-slate-700">
              Code promo (facultatif)
            </label>
            <div className="flex gap-2">
              <Input
                id="c-promo"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={40}
                value={promoInput}
                disabled={Boolean(applied)}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  setPromoError(null);
                }}
              />
              {applied ? (
                <Button type="button" variant="secondary" onClick={removeCode}>
                  Retirer
                </Button>
              ) : (
                <Button type="button" variant="secondary" loading={promoBusy} disabled={!promoInput.trim()} onClick={applyCode}>
                  Appliquer
                </Button>
              )}
            </div>
            <div aria-live="polite">
              {promoError && <p className="text-sm text-red-700">{promoError}</p>}
              {applied && !promoError && <p className="text-sm text-emerald-700">Code {applied} appliqué.</p>}
            </div>
          </div>

          {/* Champ piège : invisible et hors navigation clavier pour un humain. */}
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label htmlFor="c-website">Ne pas remplir</label>
            <input id="c-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>
            Envoyer la commande
          </Button>
          <p className="text-center text-xs text-slate-500">Aucun paiement en ligne : {store.name} confirme votre commande avec vous.</p>
        </form>
      </Card>

      <Card className="h-fit space-y-3">
        <h2 className="font-semibold text-slate-900">Récapitulatif</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {items.map((i) => (
            <li key={`${i.productId}::${i.variantId ?? ''}`} className="flex justify-between gap-2 py-2">
              <span className="min-w-0 truncate">
                {i.quantity} × {i.name}
                {i.variantLabel ? ` (${i.variantLabel})` : ''}
              </span>
              <span className="shrink-0 font-medium">{formatPrice(i.price * i.quantity, store.currency)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Sous-total</dt>
            <dd>{formatPrice(subtotal, store.currency)}</dd>
          </div>
          {quote && quote.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>Code {quote.promoCode?.code}</dt>
              <dd>−{formatPrice(quote.discount, store.currency)}</dd>
            </div>
          )}
          {quote && (
            <div className="flex justify-between">
              <dt className="text-slate-600">{pickup ? 'Retrait en boutique' : 'Livraison'}</dt>
              <dd>{quote.shippingFee > 0 ? formatPrice(quote.shippingFee, store.currency) : 'Gratuite'}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <dt>Total</dt>
            <dd>{formatPrice(quote?.total ?? total, store.currency)}</dd>
          </div>
        </dl>
        {remainingForFree > 0 && (
          <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
            Plus que {formatPrice(remainingForFree, store.currency)} d’achats pour la livraison offerte.
          </p>
        )}
        {quoteError && <p className="text-xs text-red-700">{quoteError}</p>}
        <Link href={`${base}/panier`} className="block text-center text-sm font-medium text-brand-700 hover:underline">
          Modifier le panier
        </Link>
      </Card>
    </div>
  );
}
