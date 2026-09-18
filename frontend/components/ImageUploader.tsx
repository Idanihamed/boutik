'use client';

import { useRef, useState } from 'react';
import { ApiError, uploadImage } from '../lib/api';
import { Alert, Button } from './ui';

/**
 * Une photo unique (logo, image de catégorie...) : choisir un fichier le téléverse tout de suite
 * et renvoie son adresse. Sur téléphone, le sélecteur propose l'appareil photo et la galerie.
 */
export function ImageUploader({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le téléversement a échoué.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
            Aucune
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
            {value ? 'Changer' : 'Ajouter une photo'}
          </Button>
          {value && !busy && (
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              Retirer
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
      </div>
      <p className="text-xs text-slate-500">JPG, PNG ou WebP, 5 Mo maximum.</p>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
