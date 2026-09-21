'use client';

import { useEffect, useState } from 'react';
import { ApiError, getShipping, updateShipping } from '../lib/api';
import { currencyLabel } from '../lib/labels';
import { useSession } from '../lib/session';
import { Alert, Button, Card, Field, Input } from './ui';

/** Frais de livraison à domicile et seuil de livraison offerte. Enregistrés séparément des autres réglages. */
export function ShippingCard({ canEdit }: { canEdit: boolean }) {
  const { user } = useSession();
  const currency = currencyLabel(user?.business?.currency ?? 'XOF');
  const [fee, setFee] = useState('');
  const [threshold, setThreshold] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getShipping()
      .then((s) => {
        setFee(String(s.shippingFee ?? 0));
        setThreshold(s.freeShippingThreshold != null ? String(s.freeShippingThreshold) : '');
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger la livraison.'));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const shippingFee = Number(fee.replace(/\s/g, '') || 0);
    const freeShippingThreshold = threshold.trim() === '' ? null : Number(threshold.replace(/\s/g, ''));
    if (!Number.isInteger(shippingFee) || shippingFee < 0) return setError('Les frais de livraison doivent être un montant entier, 0 ou plus.');
    if (freeShippingThreshold !== null && (!Number.isInteger(freeShippingThreshold) || freeShippingThreshold < 0)) {
      return setError('Le seuil de livraison offerte doit être un montant entier, 0 ou plus.');
    }
    setBusy(true);
    try {
      await updateShipping({ shippingFee, freeShippingThreshold });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded && !error) return null;

  return (
    <form onSubmit={save}>
      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Livraison</h2>
        <Field label={`Frais de livraison à domicile (${currency})`} htmlFor="ship-fee" hint="Mettez 0 si la livraison est gratuite. Le retrait en boutique est toujours gratuit.">
          <Input id="ship-fee" inputMode="numeric" disabled={!canEdit} value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Field
          label={`Livraison offerte à partir de (${currency})`}
          htmlFor="ship-threshold"
          hint="Facultatif. Au-dessus de ce montant d’achats (après code promo), la livraison est gratuite. Laissez vide pour ne jamais l’offrir."
        >
          <Input id="ship-threshold" inputMode="numeric" disabled={!canEdit} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        {saved && <Alert kind="success">Livraison enregistrée.</Alert>}
        {canEdit && (
          <Button type="submit" className="w-full" loading={busy}>
            Enregistrer la livraison
          </Button>
        )}
      </Card>
    </form>
  );
}
