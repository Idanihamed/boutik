'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, createCategory, deleteCategory, listCategories, updateCategory } from '../../../lib/api';
import { useCan } from '../../../lib/session';
import type { Category } from '../../../lib/types';
import { Checkbox } from '../../../components/Checkbox';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ImageUploader } from '../../../components/ImageUploader';
import { Alert, Button, Card, Field, Input, Modal, Spinner, Textarea } from '../../../components/ui';

export default function CategoriesPage() {
  const can = useCan();
  const [items, setItems] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listCategories());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les catégories.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCategory(deleting.id);
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
        <h1 className="text-2xl font-bold text-slate-900">Catégories</h1>
        {can('categories:create') && <Button onClick={() => setEditing('new')}>Ajouter une catégorie</Button>}
      </div>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <Card className="text-center text-slate-500">
          Aucune catégorie pour l’instant. Les catégories organisent vos produits (ex. « Téléphones »).
        </Card>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center gap-3">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{c.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {c.description || 'Sans description'} {!c.isActive && '· masquée'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {can('categories:update') && (
                    <Button variant="ghost" onClick={() => setEditing(c)}>
                      Modifier
                    </Button>
                  )}
                  {can('categories:delete') && (
                    <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(c)}>
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
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer cette catégorie ?"
        message={`« ${deleting?.name ?? ''} » sera supprimée. Impossible si des produits y sont encore rattachés.`}
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [image, setImage] = useState<string | null>(category?.image ?? null);
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      image: image ?? undefined,
      isActive,
      sortOrder: Number(sortOrder) || 0,
    };
    try {
      if (category) await updateCategory(category.id, input);
      else await createCategory(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom" htmlFor="cat-name">
          <Input id="cat-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Description (facultatif)" htmlFor="cat-desc">
          <Textarea id="cat-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ImageUploader label="Photo (facultatif)" value={image} onChange={setImage} />
        <Field label="Ordre d’affichage" htmlFor="cat-order" hint="Les plus petits nombres apparaissent en premier.">
          <Input id="cat-order" type="number" inputMode="numeric" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </Field>
        <Checkbox id="cat-active" label="Visible sur la vitrine" checked={isActive} onChange={setIsActive} />
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
