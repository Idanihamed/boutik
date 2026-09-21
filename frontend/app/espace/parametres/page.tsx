'use client';

import { useEffect, useState } from 'react';
import { ApiError, getSettings, updateSettings } from '../../../lib/api';
import { useCan } from '../../../lib/session';
import type { Settings } from '../../../lib/types';
import { ImageUploader } from '../../../components/ImageUploader';
import { ShippingCard } from '../../../components/ShippingCard';
import { Alert, Button, Card, Field, Input, Spinner } from '../../../components/ui';

const LINKS: { key: keyof Settings; label: string; placeholder: string }[] = [
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://facebook.com/votre-page' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://instagram.com/votre-compte' },
  { key: 'tiktokUrl', label: 'TikTok', placeholder: 'https://tiktok.com/@votre-compte' },
  { key: 'youtubeUrl', label: 'YouTube', placeholder: 'https://youtube.com/@votre-chaine' },
  { key: 'linkedinUrl', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/votre-entreprise' },
  { key: 'xUrl', label: 'X (Twitter)', placeholder: 'https://x.com/votre-compte' },
];

export default function SettingsPage() {
  const can = useCan();
  const canEdit = can('settings:update');
  const [values, setValues] = useState<Record<keyof Settings, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) =>
        setValues({
          whatsappNumber: s.whatsappNumber ?? '',
          facebookUrl: s.facebookUrl ?? '',
          instagramUrl: s.instagramUrl ?? '',
          tiktokUrl: s.tiktokUrl ?? '',
          youtubeUrl: s.youtubeUrl ?? '',
          linkedinUrl: s.linkedinUrl ?? '',
          xUrl: s.xUrl ?? '',
          heroImage1: s.heroImage1 ?? '',
          heroImage2: s.heroImage2 ?? '',
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les paramètres.'));
  }, []);

  function set(key: keyof Settings, value: string) {
    setValues((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setBusy(true);
    setError(null);
    try {
      // Une chaîne vide retire la valeur (l'API la convertit en « aucune »). La seconde image
      // d'accueil n'est pas modifiable ici : on ne l'envoie pas pour ne jamais l'effacer.
      const { heroImage2: _keep, ...editable } = values;
      void _keep;
      await updateSettings(editable);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (!values && !error) return <Spinner />;
  if (!values) return <Alert>{error}</Alert>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Paramètres de la boutique</h1>
      <form onSubmit={submit} className="space-y-5">
        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">WhatsApp</h2>
          <Field
            label="Numéro WhatsApp"
            htmlFor="s-whatsapp"
            hint="Au format international, par exemple +225 07 00 00 00 00. Affiche un bouton « Commander sur WhatsApp » sur vos produits."
          >
            <Input id="s-whatsapp" type="tel" disabled={!canEdit} value={values.whatsappNumber} onChange={(e) => set('whatsappNumber', e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">Réseaux sociaux</h2>
          {LINKS.map((l) => (
            <Field key={l.key} label={l.label} htmlFor={`s-${l.key}`}>
              <Input
                id={`s-${l.key}`}
                type="url"
                placeholder={l.placeholder}
                disabled={!canEdit}
                value={values[l.key]}
                onChange={(e) => set(l.key, e.target.value)}
              />
            </Field>
          ))}
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-slate-900">Image d’accueil</h2>
          {canEdit ? (
            <ImageUploader label="Image de fond de la page d’accueil" value={values.heroImage1 || null} onChange={(url) => set('heroImage1', url ?? '')} />
          ) : (
            values.heroImage1 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.heroImage1} alt="" className="h-24 rounded-lg object-cover" />
            )
          )}
        </Card>

        {error && <Alert>{error}</Alert>}
        {saved && <Alert kind="success">Paramètres enregistrés.</Alert>}
        {canEdit && (
          <Button type="submit" className="w-full" loading={busy}>
            Enregistrer
          </Button>
        )}
      </form>

      <ShippingCard canEdit={canEdit} />
    </div>
  );
}
