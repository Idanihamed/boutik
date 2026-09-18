'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, createBrand, deleteBrand, listBrands, updateBrand } from '../../../lib/api';
import { useCan } from '../../../lib/session';
import type { Brand } from '../../../lib/types';
import { Checkbox } from '../../../components/Checkbox';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ImageUploader } from '../../../components/ImageUploader';
import { Alert, Button, Card, Field, Input, Modal, Spinner } from '../../../components/ui';

export default function BrandsPage() {
  const can = useCan();
  const [items, setItems] = useState<Brand[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Brand | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listBrands());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les marques.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteBrand(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Marques</h1>
        {can('brands:create') && <Button onClick={() => setEditing('new')}>Ajouter une marque</Button>}
      </div>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <Card className="text-center text-slate-500">Aucune marque pour l’instant (facultatif).</Card>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((b) => (
            <li key={b.id}>
              <Card className="flex items-center gap-3">
                {b.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo} alt="" className="h-14 w-14 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{b.name}</p>
                  {!b.isActive && <p className="text-sm text-slate-500">Masquée</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {can('brands:update') && (
                    <Button variant="ghost" onClick={() => setEditing(b)}>
                      Modifier
                    </Button>
                  )}
                  {can('brands:delete') && (
                    <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(b)}>
                      Supprimer
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <BrandForm
          brand={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer cette marque ?"
        message={`« ${deleting?.name ?? ''} » sera supprimée. Impossible si des produits y sont encore rattachés.`}
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function BrandForm({ brand, onClose, onSaved }: { brand: Brand | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(brand?.name ?? '');
  const [logo, setLogo] = useState<string | null>(brand?.logo ?? null);
  const [isActive, setIsActive] = useState(brand?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input = { name: name.trim(), logo: logo ?? undefined, isActive };
    try {
      if (brand) await updateBrand(brand.id, input);
      else await createBrand(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={brand ? 'Modifier la marque' : 'Nouvelle marque'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom" htmlFor="brand-name">
          <Input id="brand-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <ImageUploader label="Logo (facultatif)" value={logo} onChange={setLogo} />
        <Checkbox id="brand-active" label="Visible sur la vitrine" checked={isActive} onChange={setIsActive} />
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
    </Modal>
  );
}
