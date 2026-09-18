'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, request } from '../../../lib/api';
import { formatPrice } from '../../../lib/labels';
import { useStore } from '../../../lib/store-context';
import { Alert, Button, Card, Field, Input, Spinner, Textarea } from '../../../components/ui';

interface Confirmation {
  reference: string;
  totalAmount: number;
}

export default function CheckoutPage() {
  const { store, items, total, ready, clear } = useStore();
  const base = `/${store.slug}`;

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // piège à robots : reste vide pour un humain
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Confirmation | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await request<{ success: boolean; reference?: string; totalAmount?: number }>(`/b/${store.slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerName: name.trim(),
          customerContact: contact.trim(),
          customerAddress: address.trim() || undefined,
          notes: notes.trim() || undefined,
          website: website || undefined,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      if (res.reference) {
        setDone({ reference: res.reference, totalAmount: res.totalAmount ?? total });
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
          <Field label="Adresse de livraison (facultatif)" htmlFor="c-address">
            <Input id="c-address" autoComplete="street-address" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Précisions (facultatif)" htmlFor="c-notes">
            <Textarea id="c-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
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
            <li key={i.productId} className="flex justify-between gap-2 py-2">
              <span className="min-w-0 truncate">
                {i.quantity} × {i.name}
              </span>
              <span className="shrink-0 font-medium">{formatPrice(i.price * i.quantity, store.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-slate-200 pt-3 font-bold text-slate-900">
          <span>Total</span>
          <span>{formatPrice(total, store.currency)}</span>
        </div>
        <Link href={`${base}/panier`} className="block text-center text-sm font-medium text-brand-700 hover:underline">
          Modifier le panier
        </Link>
      </Card>
    </div>
  );
}
