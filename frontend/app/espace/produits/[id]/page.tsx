'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  adjustProductStock,
  adjustVariantStock,
  ApiError,
  deleteProduct,
  duplicateProduct,
  getProduct,
  setProductPublication,
} from '../../../../lib/api';
import { STOCK_LABELS, STOCK_STYLES } from '../../../../lib/labels';
import { useCan } from '../../../../lib/session';
import type { Product } from '../../../../lib/types';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { ProductForm } from '../../../../components/ProductForm';
import { Alert, Button, Card, Field, Input, Spinner } from '../../../../components/ui';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useCan();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delta, setDelta] = useState('1');
  const [variantDeltas, setVariantDeltas] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setProduct(await getProduct(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger ce produit.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteProduct(id);
      router.push('/espace/produits');
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const copy = await duplicateProduct(id);
      router.push(`/espace/produits/${copy.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Duplication impossible.');
      setBusy(false);
    }
  }

  if (error && !product) return <Alert>{error}</Alert>;
  if (!product) return <Spinner />;

  const amount = Math.trunc(Number(delta) || 0);

  function variantAmount(variantId: string) {
    return Math.trunc(Number(variantDeltas[variantId] ?? '1') || 0);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/espace/produits" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux produits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-sm text-slate-500">
            {product.sku} · {product.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('products:publish') && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(
                  () => setProductPublication(id, product.status === 'PUBLISHED' ? 'unpublish' : 'publish'),
                  product.status === 'PUBLISHED' ? 'Produit dépublié.' : 'Produit publié.',
                )
              }
            >
              {product.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
            </Button>
          )}
          {can('products:create') && (
            <Button variant="secondary" disabled={busy} onClick={duplicate}>
              Dupliquer
            </Button>
          )}
          {can('products:delete') && (
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {can('products:update') && product.hasVariants && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Stock total : {product.stock}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STOCK_STYLES[product.stockStatus]}`}>
              {STOCK_LABELS[product.stockStatus]}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {product.variants.map((variant) => (
              <div key={variant.id} className="flex flex-wrap items-end justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {variant.label || '(sans libellé)'}
                    {!variant.isActive && <span className="ml-2 text-xs font-normal text-slate-400">Désactivée</span>}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>Stock : {variant.stock}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STOCK_STYLES[variant.stockStatus]}`}>
                      {STOCK_LABELS[variant.stockStatus]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-24">
                    <Field label="Quantité" htmlFor={`stock-delta-${variant.id}`}>
                      <Input
                        id={`stock-delta-${variant.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={variantDeltas[variant.id] ?? '1'}
                        onChange={(e) => setVariantDeltas((prev) => ({ ...prev, [variant.id]: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy || variantAmount(variant.id) < 1}
                    onClick={() => run(() => adjustVariantStock(id, variant.id, variantAmount(variant.id)), 'Stock mis à jour.')}
                  >
                    Ajouter
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || variantAmount(variant.id) < 1}
                    onClick={() => run(() => adjustVariantStock(id, variant.id, -variantAmount(variant.id)), 'Stock mis à jour.')}
                  >
                    Retirer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {can('products:update') && !product.hasVariants && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Stock : {product.stock}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STOCK_STYLES[product.stockStatus]}`}>
              {STOCK_LABELS[product.stockStatus]}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Field label="Quantité" htmlFor="stock-delta">
                <Input id="stock-delta" type="number" inputMode="numeric" min={1} step={1} value={delta} onChange={(e) => setDelta(e.target.value)} />
              </Field>
            </div>
            <Button variant="secondary" disabled={busy || amount < 1} onClick={() => run(() => adjustProductStock(id, amount), 'Stock mis à jour.')}>
              Ajouter au stock
            </Button>
            <Button variant="secondary" disabled={busy || amount < 1} onClick={() => run(() => adjustProductStock(id, -amount), 'Stock mis à jour.')}>
              Retirer du stock
            </Button>
          </div>
        </Card>
      )}

      {can('products:update') ? (
        <ProductForm
          key={product.updatedAt}
          product={product}
          onSaved={() => {
            setNotice('Modifications enregistrées.');
            load();
          }}
        />
      ) : (
        <Alert kind="info">Votre rôle permet de consulter ce produit, pas de le modifier.</Alert>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce produit ?"
        message={`« ${product.name} » sera supprimé définitivement. Les commandes déjà passées restent conservées.`}
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
