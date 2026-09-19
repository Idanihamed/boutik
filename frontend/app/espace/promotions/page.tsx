'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  createPromotion,
  deletePromotion,
  listCategories,
  listProducts,
  listPromotions,
  setPromotionStatus,
  updatePromotion,
} from '../../../lib/api';
import {
  describePromotionValue,
  formatDate,
  PROMOTION_STATUS_LABELS,
  PROMOTION_STATUS_STYLES,
  PROMOTION_TYPE_LABELS,
} from '../../../lib/labels';
import { useCan, useSession } from '../../../lib/session';
import type { Category, Product, Promotion, PromotionInput, PromotionType } from '../../../lib/types';
import { Checkbox } from '../../../components/Checkbox';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ImageUploader } from '../../../components/ImageUploader';
import { Alert, Button, Card, Field, Input, Select, Spinner, Textarea } from '../../../components/ui';

export default function PromotionsPage() {
  const can = useCan();
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';

  const [items, setItems] = useState<Promotion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await listPromotions()).data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les promotions.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(promo: Promotion, action: 'activate' | 'disable' | 'draft') {
    setBusyId(promo.id);
    try {
      await setPromotionStatus(promo.id, action);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deletePromotion(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  }

  if (editing) {
    return (
      <PromotionForm
        promotion={editing === 'new' ? null : editing}
        currency={currency}
        canActivate={can('promotions:activate')}
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
        <h1 className="text-2xl font-bold text-slate-900">Promotions</h1>
        {can('promotions:create') && <Button onClick={() => setEditing('new')}>Nouvelle promotion</Button>}
      </div>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <Card className="text-center text-slate-500">
          Aucune promotion pour l’instant. Créez-en une pour afficher des prix réduits sur votre vitrine.
        </Card>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((promo) => (
            <li key={promo.id}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{promo.name}</p>
                    <p className="text-sm text-slate-600">
                      {describePromotionValue(promo.type, promo.value, currency)} · du {formatDate(promo.startsAt)} au{' '}
                      {formatDate(promo.endsAt)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {promo.products.length + promo.categories.length === 0
                        ? 'Aucun produit ciblé'
                        : [
                            promo.products.length > 0 && `${promo.products.length} produit(s)`,
                            promo.categories.length > 0 && `${promo.categories.length} catégorie(s)`,
                          ]
                            .filter(Boolean)
                            .join(' et ')}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${PROMOTION_STATUS_STYLES[promo.displayStatus]}`}
                  >
                    {PROMOTION_STATUS_LABELS[promo.displayStatus]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {can('promotions:activate') && promo.adminStatus !== 'ACTIVE' && (
                    <Button variant="secondary" loading={busyId === promo.id} onClick={() => changeStatus(promo, 'activate')}>
                      Activer
                    </Button>
                  )}
                  {can('promotions:activate') && promo.adminStatus === 'ACTIVE' && (
                    <Button variant="secondary" loading={busyId === promo.id} onClick={() => changeStatus(promo, 'disable')}>
                      Désactiver
                    </Button>
                  )}
                  {can('promotions:update') && (
                    <Button variant="ghost" onClick={() => setEditing(promo)}>
                      Modifier
                    </Button>
                  )}
                  {can('promotions:delete') && (
                    <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(promo)}>
                      Supprimer
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer cette promotion ?"
        message={`« ${deleting?.name ?? ''} » sera supprimée. Les prix des produits redeviendront normaux.`}
        busy={busyId === deleting?.id}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/** ISO (UTC) → valeur d'un champ « datetime-local » dans le fuseau de l'utilisateur. */
function toLocalInput(iso: string | undefined, fallback: Date): string {
  const date = iso ? new Date(iso) : fallback;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function PromotionForm({
  promotion,
  currency,
  canActivate,
  onClose,
  onSaved,
}: {
  promotion: Promotion | null;
  currency: string;
  canActivate: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const inOneWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const [name, setName] = useState(promotion?.name ?? '');
  const [description, setDescription] = useState(promotion?.description ?? '');
  const [type, setType] = useState<PromotionType>(promotion?.type ?? 'PERCENTAGE');
  const [value, setValue] = useState(String(promotion?.value ?? ''));
  const [startsAt, setStartsAt] = useState(toLocalInput(promotion?.startsAt, new Date()));
  const [endsAt, setEndsAt] = useState(toLocalInput(promotion?.endsAt, inOneWeek));
  const [conditions, setConditions] = useState(promotion?.conditions ?? '');
  const [bannerTitle, setBannerTitle] = useState(promotion?.bannerTitle ?? '');
  const [bannerSubtitle, setBannerSubtitle] = useState(promotion?.bannerSubtitle ?? '');
  const [bannerImage, setBannerImage] = useState<string | null>(promotion?.bannerImage ?? null);
  const [productIds, setProductIds] = useState<string[]>(promotion?.products.map((p) => p.id) ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(promotion?.categories.map((c) => c.id) ?? []);
  const [activateNow, setActivateNow] = useState(promotion ? promotion.adminStatus === 'ACTIVE' : true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      listProducts({ search: productSearch || undefined, page: 1 })
        .then((res) => setProducts(res.data))
        .catch(() => setProducts([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 1) return setError('Indiquez une valeur entière supérieure à 0.');
    if (type === 'PERCENTAGE' && amount > 100) return setError('Un pourcentage ne peut pas dépasser 100.');
    if (new Date(endsAt) <= new Date(startsAt)) return setError('La date de fin doit être après la date de début.');
    if (productIds.length + categoryIds.length === 0) {
      return setError('Choisissez au moins un produit ou une catégorie à réduire.');
    }

    const input: PromotionInput = {
      name: name.trim(),
      description: description.trim(),
      type,
      value: amount,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      conditions: conditions.trim(),
      bannerTitle: bannerTitle.trim(),
      bannerSubtitle: bannerSubtitle.trim(),
      bannerImage: bannerImage ?? '',
      productIds,
      categoryIds,
    };
    const body = { ...input, ...(canActivate ? { adminStatus: activateNow ? 'ACTIVE' : 'DRAFT' } : {}) };

    setBusy(true);
    try {
      if (promotion) await updatePromotion(promotion.id, body);
      else await createPromotion(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  const valueLabel =
    type === 'PERCENTAGE' ? 'Pourcentage (1 à 100)' : `Montant en ${currency === 'XOF' ? 'FCFA' : currency}`;

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{promotion ? 'Modifier la promotion' : 'Nouvelle promotion'}</h1>

      <Card className="space-y-4">
        <Field label="Nom de la promotion" htmlFor="promo-name">
          <Input id="promo-name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de réduction" htmlFor="promo-type">
            <Select id="promo-type" value={type} onChange={(e) => setType(e.target.value as PromotionType)}>
              {Object.entries(PROMOTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={valueLabel} htmlFor="promo-value">
            <Input id="promo-value" required type="number" min={1} step={1} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Début" htmlFor="promo-start">
            <Input id="promo-start" required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Fin" htmlFor="promo-end">
            <Input id="promo-end" required type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Description (facultatif)" htmlFor="promo-desc">
          <Textarea id="promo-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Produits concernés</h2>
        {categories.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium text-slate-700">Catégories entières</legend>
            {categories.map((c) => (
              <Checkbox
                key={c.id}
                id={`promo-cat-${c.id}`}
                label={c.name}
                checked={categoryIds.includes(c.id)}
                onChange={() => setCategoryIds(toggle(categoryIds, c.id))}
              />
            ))}
          </fieldset>
        )}
        <div className="space-y-2">
          <Field label="Produits précis" htmlFor="promo-product-search">
            <Input
              id="promo-product-search"
              type="search"
              placeholder="Rechercher un produit…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </Field>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {products.length === 0 && <p className="text-sm text-slate-500">Aucun produit trouvé.</p>}
            {products.map((p) => (
              <Checkbox
                key={p.id}
                id={`promo-prod-${p.id}`}
                label={p.name}
                checked={productIds.includes(p.id)}
                onChange={() => setProductIds(toggle(productIds, p.id))}
              />
            ))}
          </div>
          <p className="text-sm text-slate-500">
            {productIds.length} produit(s) et {categoryIds.length} catégorie(s) sélectionné(s).
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Bannière et conditions (facultatif)</h2>
        <Field label="Titre de la bannière" htmlFor="promo-banner-title">
          <Input id="promo-banner-title" maxLength={120} value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} />
        </Field>
        <Field label="Sous-titre" htmlFor="promo-banner-sub">
          <Input id="promo-banner-sub" maxLength={200} value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} />
        </Field>
        <ImageUploader label="Image de la bannière" value={bannerImage} onChange={setBannerImage} />
        <Field label="Conditions" htmlFor="promo-conditions">
          <Textarea id="promo-conditions" rows={2} value={conditions} onChange={(e) => setConditions(e.target.value)} />
        </Field>
      </Card>

      {canActivate && (
        <Checkbox
          id="promo-activate"
          label="Activer la promotion"
          hint="Elle s’applique automatiquement entre la date de début et la date de fin. Sinon, elle reste en brouillon."
          checked={activateNow}
          onChange={setActivateNow}
        />
      )}

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
