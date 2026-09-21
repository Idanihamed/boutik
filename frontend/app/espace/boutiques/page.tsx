'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, createBoutique, deleteBoutique, listBoutiques, updateBoutique } from '../../../lib/api';
import { useCan } from '../../../lib/session';
import type { Boutique } from '../../../lib/types';
import { Checkbox } from '../../../components/Checkbox';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ImageUploader } from '../../../components/ImageUploader';
import { Alert, Button, Card, Field, Input, Spinner, Textarea } from '../../../components/ui';

export default function BoutiquesPage() {
  const can = useCan();
  const [items, setItems] = useState<Boutique[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Boutique | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Boutique | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listBoutiques());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les boutiques.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteBoutique(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <BoutiqueForm
        boutique={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Boutiques</h1>
        {can('boutiques:create') && <Button onClick={() => setEditing('new')}>Ajouter une boutique</Button>}
      </div>
      <p className="text-sm text-slate-600">
        Vos points de vente physiques : adresse, horaires et téléphone, affichés sur la page « Nos boutiques » de votre
        vitrine.
      </p>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <Card className="text-center text-slate-500">Aucune boutique pour l’instant (facultatif).</Card>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((b) => {
            const photo = b.images.find((i) => i.isMain) ?? b.images[0];
            return (
              <li key={b.id}>
                <Card className="flex items-start gap-3">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{b.name}</p>
                    <p className="text-sm text-slate-600">{b.address}</p>
                    {b.phone && <p className="text-sm text-slate-500">{b.phone}</p>}
                    {!b.isActive && <p className="text-sm font-medium text-amber-700">Masquée sur la vitrine</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {can('boutiques:update') && (
                        <Button variant="ghost" onClick={() => setEditing(b)}>
                          Modifier
                        </Button>
                      )}
                      {can('boutiques:delete') && (
                        <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(b)}>
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer cette boutique ?"
        message={`« ${deleting?.name ?? ''} » disparaîtra de votre vitrine.`}
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function BoutiqueForm({ boutique, onClose, onSaved }: { boutique: Boutique | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(boutique?.name ?? '');
  const [address, setAddress] = useState(boutique?.address ?? '');
  const [phone, setPhone] = useState(boutique?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(boutique?.whatsapp ?? '');
  const [hours, setHours] = useState(boutique?.hours ?? '');
  const [description, setDescription] = useState(boutique?.description ?? '');
  const [mapsUrl, setMapsUrl] = useState(boutique?.googleMapsUrl ?? '');
  const [photo, setPhoto] = useState<string | null>(boutique?.images.find((i) => i.isMain)?.url ?? boutique?.images[0]?.url ?? null);
  const [isActive, setIsActive] = useState(boutique?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      hours: hours.trim(),
      description: description.trim(),
      googleMapsUrl: mapsUrl.trim(),
      isActive,
      images: photo ? [{ url: photo, isMain: true, sortOrder: 0 }] : [],
    };
    try {
      if (boutique) await updateBoutique(boutique.id, input);
      else await createBoutique(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{boutique ? 'Modifier la boutique' : 'Nouvelle boutique'}</h1>
      <Card className="space-y-4">
        <Field label="Nom de la boutique" htmlFor="b-name">
          <Input id="b-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Adresse" htmlFor="b-address" hint="Ex. : Marché de Cocody, rue des Jardins, Abidjan">
          <Input id="b-address" required minLength={3} maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone (facultatif)" htmlFor="b-phone">
            <Input id="b-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="WhatsApp (facultatif)" htmlFor="b-whatsapp" hint="Avec l’indicatif du pays, ex. 225 07 00 00 00 00">
            <Input id="b-whatsapp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </Field>
        </div>
        <Field label="Horaires d’ouverture (facultatif)" htmlFor="b-hours" hint="Ex. : Lundi au samedi, 8h - 19h">
          <Textarea id="b-hours" rows={2} value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <Field label="Description (facultatif)" htmlFor="b-desc">
          <Textarea id="b-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Lien Google Maps (facultatif)" htmlFor="b-maps" hint="Dans Google Maps : Partager, puis copier le lien.">
          <Input id="b-maps" type="url" placeholder="https://maps.google.com/..." value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} />
        </Field>
        <ImageUploader label="Photo de la boutique (facultatif)" value={photo} onChange={setPhoto} />
        <Checkbox id="b-active" label="Visible sur la vitrine" checked={isActive} onChange={setIsActive} />
      </Card>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" loading={busy}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
