'use client';

import { useEffect, useState } from 'react';
import { ApiError, getMyBusiness, updateMyBusiness } from '../../../lib/api';
import { COUNTRIES, DEFAULT_CURRENCY_BY_COUNTRY } from '../../../lib/labels';
import { useCan, useSession } from '../../../lib/session';
import type { MyBusiness } from '../../../lib/types';
import { ImageUploader } from '../../../components/ImageUploader';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../../../components/ui';

export default function MyBusinessPage() {
  const can = useCan();
  const { refresh } = useSession();
  const canEdit = can('business:update');

  const [business, setBusiness] = useState<MyBusiness | null>(null);
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('CI');
  const [currency, setCurrency] = useState('XOF');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyBusiness()
      .then((b) => {
        setBusiness(b);
        setName(b.name);
        setLogo(b.logo);
        setDescription(b.description ?? '');
        setCountry(b.country);
        setCurrency(b.currency);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger votre entreprise.'));
  }, []);

  function onCountryChange(code: string) {
    setCountry(code);
    const suggested = DEFAULT_CURRENCY_BY_COUNTRY[code];
    if (suggested) setCurrency(suggested);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateMyBusiness({
        name: name.trim(),
        logo: logo ?? undefined,
        description: description.trim() || undefined,
        country,
        currency: currency.trim().toUpperCase(),
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (!business && !error) return <Spinner />;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Mon entreprise</h1>
      {business && (
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nom de l’entreprise" htmlFor="biz-name">
              <Input id="biz-name" required minLength={2} maxLength={100} disabled={!canEdit} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Adresse de la vitrine" htmlFor="biz-slug" hint="Cette adresse ne peut pas être modifiée.">
              <Input id="biz-slug" disabled value={`/${business.slug}`} readOnly />
            </Field>
            {canEdit ? (
              <ImageUploader label="Logo" value={logo} onChange={setLogo} />
            ) : (
              logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo" className="h-16 w-16 rounded-lg object-cover" />
              )
            )}
            <Field label="Description" htmlFor="biz-desc">
              <Textarea id="biz-desc" rows={3} maxLength={500} disabled={!canEdit} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pays" htmlFor="biz-country">
                <Select id="biz-country" disabled={!canEdit} value={country} onChange={(e) => onCountryChange(e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Devise" htmlFor="biz-currency" hint="Code à 3 lettres (XOF, EUR…).">
                <Input
                  id="biz-currency"
                  required
                  pattern="[A-Za-z]{3}"
                  maxLength={3}
                  disabled={!canEdit}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </Field>
            </div>
            <Alert kind="info">
              Les prix de vos produits sont exprimés dans cette devise. Changez-la avant d’ajouter des produits :
              les prix existants ne sont pas convertis.
            </Alert>
            {error && <Alert>{error}</Alert>}
            {saved && <Alert kind="success">Modifications enregistrées.</Alert>}
            {canEdit && (
              <Button type="submit" className="w-full" loading={busy}>
                Enregistrer
              </Button>
            )}
          </form>
        </Card>
      )}
      {!business && error && <Alert>{error}</Alert>}
    </div>
  );
}
