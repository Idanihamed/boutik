'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError, createProduct, listBrands, listCategories, updateProduct, uploadImage } from '../lib/api';
import { currencyLabel } from '../lib/labels';
import { useCan, useSession } from '../lib/session';
import type { Brand, Category, Product, ProductInput } from '../lib/types';
import { Checkbox } from './Checkbox';
import { Alert, Button, Card, Field, Input, Select, Textarea } from './ui';

interface ImageItem {
  url: string;
  alt: string;
  isMain: boolean;
}

interface AttributeItem {
  key: string;
  value: string;
}

/** Garantit exactement une image principale (la première si aucune n'est choisie). */
function withMain(images: ImageItem[]): ImageItem[] {
  if (images.length === 0) return images;
  const mainIndex = images.findIndex((i) => i.isMain);
  const chosen = mainIndex === -1 ? 0 : mainIndex;
  return images.map((img, i) => ({ ...img, isMain: i === chosen }));
}

const toInt = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * Formulaire produit, partagé par la création et la modification. À la modification, le stock
 * n'est PAS un champ du formulaire : il s'ajuste par ajout/retrait (voir la fiche produit), ce qui
 * évite d'écraser un stock qui aurait bougé entre-temps (commande reçue pendant la saisie).
 */
export function ProductForm({ product, onSaved }: { product?: Product; onSaved: (product: Product) => void }) {
  const can = useCan();
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const isEdit = Boolean(product);
  const canPublish = can('products:publish');

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? '');
  const [brandId, setBrandId] = useState(product?.brand?.id ?? '');
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [promoPrice, setPromoPrice] = useState(product?.promoPrice != null ? String(product.promoPrice) : '');
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product?.lowStockThreshold ?? 5));
  const [warranty, setWarranty] = useState(product?.warranty ?? '');
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(product?.status ?? 'DRAFT');
  const [images, setImages] = useState<ImageItem[]>(
    withMain((product?.images ?? []).map((i) => ({ url: i.url, alt: i.alt ?? '', isMain: i.isMain }))),
  );
  const [attributes, setAttributes] = useState<AttributeItem[]>(
    (product?.attributes ?? []).map((a) => ({ key: a.key, value: a.value })),
  );

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    listBrands()
      .then(setBrands)
      .catch(() => setBrands([]));
  }, []);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const added: ImageItem[] = [];
      for (const file of Array.from(files)) {
        added.push({ url: await uploadImage(file), alt: '', isMain: false });
      }
      setImages((current) => withMain([...current, ...added]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le téléversement a échoué.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceValue = toInt(price);
    const promoValue = promoPrice.trim() === '' ? null : toInt(promoPrice);
    if (promoValue !== null && promoValue >= priceValue) {
      setError('Le prix promotionnel doit être inférieur au prix normal.');
      return;
    }

    // À la création, un champ vide est simplement omis ; à la modification, il est envoyé vide
    // pour EFFACER l'ancienne valeur.
    const text = (value: string) => (isEdit ? value.trim() : value.trim() || undefined);
    const input: ProductInput = {
      name: name.trim(),
      sku: sku.trim(),
      categoryId,
      brandId: isEdit ? brandId || null : brandId || undefined,
      shortDescription: text(shortDescription),
      description: text(description),
      price: priceValue,
      promoPrice: isEdit ? promoValue : (promoValue ?? undefined),
      stock: toInt(stock),
      lowStockThreshold: toInt(lowStockThreshold),
      warranty: text(warranty),
      isFeatured,
      status: canPublish ? status : (product?.status ?? 'DRAFT'),
      images: withMain(images).map((img, i) => ({
        url: img.url,
        alt: img.alt.trim() || undefined,
        isMain: img.isMain,
        sortOrder: i,
      })),
      attributes: attributes
        .filter((a) => a.key.trim())
        .map((a, i) => ({ key: a.key.trim(), value: a.value.trim(), sortOrder: i })),
    };

    setBusy(true);
    try {
      if (product) {
        const { stock: _ignored, ...withoutStock } = input;
        void _ignored;
        onSaved(await updateProduct(product.id, withoutStock));
      } else {
        onSaved(await createProduct(input));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (categories && categories.length === 0) {
    return (
      <Alert kind="info">
        Avant d’ajouter un produit, créez au moins une catégorie.{' '}
        <Link href="/espace/categories" className="font-medium underline">
          Créer une catégorie
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Informations</h2>
        <Field label="Nom du produit" htmlFor="p-name">
          <Input id="p-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Référence (SKU)" htmlFor="p-sku" hint="Code unique de ce produit dans votre entreprise.">
            <Input id="p-sku" required value={sku} onChange={(e) => setSku(e.target.value)} />
          </Field>
          <Field label="Catégorie" htmlFor="p-category">
            <Select id="p-category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choisir…</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Marque (facultatif)" htmlFor="p-brand">
          <Select id="p-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Aucune</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Résumé (facultatif)" htmlFor="p-short">
          <Input id="p-short" maxLength={200} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </Field>
        <Field label="Description (facultatif)" htmlFor="p-desc">
          <Textarea id="p-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Prix et stock</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Prix (${currencyLabel(currency)})`} htmlFor="p-price">
            <Input id="p-price" type="number" inputMode="numeric" min={0} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label={`Prix promotionnel (${currencyLabel(currency)}, facultatif)`} htmlFor="p-promo">
            <Input id="p-promo" type="number" inputMode="numeric" min={0} step={1} value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {isEdit ? (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              Stock actuel : <strong>{product?.stock}</strong>. Pour le modifier, utilisez « Ajuster le stock » sur la fiche
              du produit.
            </p>
          ) : (
            <Field label="Stock initial" htmlFor="p-stock">
              <Input id="p-stock" type="number" inputMode="numeric" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} />
            </Field>
          )}
          <Field label="Alerte de stock faible à partir de" htmlFor="p-threshold">
            <Input id="p-threshold" type="number" inputMode="numeric" min={0} step={1} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
          </Field>
        </div>
        <Field label="Garantie (facultatif)" htmlFor="p-warranty">
          <Input id="p-warranty" placeholder="Ex. 12 mois" value={warranty} onChange={(e) => setWarranty(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
        {images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img, i) => (
              <li key={`${img.url}-${i}`} className="space-y-2 rounded-lg border border-slate-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full rounded-md object-cover" />
                {img.isMain ? (
                  <p className="text-center text-xs font-medium text-brand-700">Photo principale</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setImages((cur) => cur.map((c, idx) => ({ ...c, isMain: idx === i })))}
                    className="w-full text-center text-xs font-medium text-slate-600 underline"
                  >
                    Définir comme principale
                  </button>
                )}
                <div className="flex justify-between">
                  <Button type="button" variant="ghost" className="min-h-[36px] px-2" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label="Déplacer vers la gauche">
                    ←
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[36px] px-2 text-red-700 hover:bg-red-50"
                    onClick={() => setImages((cur) => withMain(cur.filter((_, idx) => idx !== i)))}
                  >
                    Retirer
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-[36px] px-2" disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} aria-label="Déplacer vers la droite">
                    →
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button type="button" variant="secondary" loading={uploading} onClick={() => fileInput.current?.click()}>
            Ajouter des photos
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <p className="mt-2 text-xs text-slate-500">JPG, PNG ou WebP, 5 Mo maximum chacune, 20 photos au plus.</p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Caractéristiques (facultatif)</h2>
        {attributes.map((attr, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label="Nom" htmlFor={`attr-key-${i}`}>
              <Input id={`attr-key-${i}`} placeholder="Ex. Couleur" value={attr.key} onChange={(e) => setAttributes((cur) => cur.map((a, idx) => (idx === i ? { ...a, key: e.target.value } : a)))} />
            </Field>
            <Field label="Valeur" htmlFor={`attr-value-${i}`}>
              <Input id={`attr-value-${i}`} placeholder="Ex. Noir" value={attr.value} onChange={(e) => setAttributes((cur) => cur.map((a, idx) => (idx === i ? { ...a, value: e.target.value } : a)))} />
            </Field>
            <Button type="button" variant="ghost" className="text-red-700 hover:bg-red-50" aria-label="Retirer cette caractéristique" onClick={() => setAttributes((cur) => cur.filter((_, idx) => idx !== i))}>
              ✕
            </Button>
          </div>
        ))}
        {attributes.length < 50 && (
          <Button type="button" variant="secondary" onClick={() => setAttributes((cur) => [...cur, { key: '', value: '' }])}>
            Ajouter une caractéristique
          </Button>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Publication</h2>
        <Field
          label="Statut"
          htmlFor="p-status"
          hint={canPublish ? 'Un brouillon n’est visible que de vous.' : 'Votre rôle ne permet pas de publier : le produit reste en brouillon.'}
        >
          <Select id="p-status" disabled={!canPublish} value={canPublish ? status : (product?.status ?? 'DRAFT')} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}>
            <option value="DRAFT">Brouillon</option>
            <option value="PUBLISHED">Publié</option>
          </Select>
        </Field>
        <Checkbox id="p-featured" label="Mettre en avant sur la vitrine" checked={isFeatured} onChange={setIsFeatured} />
      </Card>

      {error && <Alert>{error}</Alert>}
      <Button type="submit" className="w-full sm:w-auto" loading={busy} disabled={uploading}>
        {isEdit ? 'Enregistrer les modifications' : 'Créer le produit'}
      </Button>
    </form>
  );
}
