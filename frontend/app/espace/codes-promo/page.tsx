'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, createPromoCode, deletePromoCode, listPromoCodes, updatePromoCode } from '../../../lib/api';
import { currencyLabel, formatDate, formatPrice, PROMO_CODE_TYPE_LABELS } from '../../../lib/labels';
import { useCan, useSession } from '../../../lib/session';
import type { PromoCode, PromoCodeInput, PromoCodeType } from '../../../lib/types';
import { Checkbox } from '../../../components/Checkbox';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, Button, Card, Field, Input, Select, Spinner } from '../../../components/ui';

/** ISO (UTC) → valeur d'un champ « datetime-local » dans le fuseau de l'utilisateur ('' si vide). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describeValue(code: PromoCode, currency: string): string {
  return code.type === 'PERCENTAGE' ? `-${code.value} %` : `-${formatPrice(code.value, currency)}`;
}

function statusOf(code: PromoCode): { label: string; style: string } {
  const now = Date.now();
  if (!code.isActive) return { label: 'Désactivé', style: 'bg-amber-100 text-amber-800' };
  if (code.endsAt && now > new Date(code.endsAt).getTime()) return { label: 'Expiré', style: 'bg-slate-100 text-slate-500' };
  if (code.startsAt && now < new Date(code.startsAt).getTime()) return { label: 'Programmé', style: 'bg-blue-100 text-blue-800' };
  if (code.maxUses !== null && code.usedCount >= code.maxUses) return { label: 'Épuisé', style: 'bg-slate-100 text-slate-500' };
  return { label: 'Actif', style: 'bg-green-100 text-green-800' };
}

export default function PromoCodesPage() {
  const can = useCan();
  const { user } = useSession();
  const currency = user?.business?.currency ?? 'XOF';
  const [items, setItems] = useState<PromoCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PromoCode | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PromoCode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listPromoCodes());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les codes promo.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(code: PromoCode) {
    setBusyId(code.id);
    try {
      await updatePromoCode(code.id, { isActive: !code.isActive });
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
      await deletePromoCode(deleting.id);
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
      <PromoCodeForm
        code={editing === 'new' ? null : editing}
        currency={currency}
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
        <h1 className="text-2xl font-bold text-slate-900">Codes promo</h1>
        {can('promotions:create') && <Button onClick={() => setEditing('new')}>Nouveau code</Button>}
      </div>
      <p className="text-sm text-slate-600">
        Des codes que vos clients tapent dans leur panier pour obtenir une réduction, par exemple à partager sur WhatsApp ou
        Facebook.
      </p>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}
      {items && items.length === 0 && <Card className="text-center text-slate-500">Aucun code promo pour l’instant.</Card>}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((code) => {
            const status = statusOf(code);
            return (
              <li key={code.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-bold tracking-wider text-slate-900">{code.code}</p>
                      <p className="text-sm text-slate-600">
                        {describeValue(code, currency)}
                        {code.minOrderAmount !== null && ` · dès ${formatPrice(code.minOrderAmount, currency)} d’achats`}
                      </p>
                      <p className="text-sm text-slate-500">
                        Utilisé {code.usedCount} fois{code.maxUses !== null ? ` sur ${code.maxUses}` : ''}
                        {code.endsAt && ` · jusqu’au ${formatDate(code.endsAt)}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.style}`}>{status.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {can('promotions:update') && (
                      <>
                        <Button variant="secondary" loading={busyId === code.id} onClick={() => toggle(code)}>
                          {code.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditing(code)}>
                          Modifier
                        </Button>
                      </>
                    )}
                    {can('promotions:delete') && (
                      <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(code)}>
                        Supprimer
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer ce code ?"
        message={`« ${deleting?.code ?? ''} » ne fonctionnera plus. Les commandes déjà passées avec ce code ne changent pas.`}
        busy={busyId === deleting?.id}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function PromoCodeForm({ code, currency, onClose, onSaved }: { code: PromoCode | null; currency: string; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(code?.code ?? '');
  const [type, setType] = useState<PromoCodeType>(code?.type ?? 'PERCENTAGE');
  const [value, setValue] = useState(String(code?.value ?? ''));
  const [minOrder, setMinOrder] = useState(code?.minOrderAmount != null ? String(code.minOrderAmount) : '');
  const [maxUses, setMaxUses] = useState(code?.maxUses != null ? String(code.maxUses) : '');
  const [startsAt, setStartsAt] = useState(toLocalInput(code?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(code?.endsAt ?? null));
  const [isActive, setIsActive] = useState(code?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toInt = (raw: string) => Number(raw.replace(/\s/g, ''));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = toInt(value);
    if (!Number.isInteger(amount) || amount < 1) return setError('Indiquez une valeur entière supérieure à 0.');
    if (type === 'PERCENTAGE' && amount > 100) return setError('Un pourcentage ne peut pas dépasser 100.');
    const min = minOrder.trim() === '' ? null : toInt(minOrder);
    const uses = maxUses.trim() === '' ? null : toInt(maxUses);
    if (min !== null && (!Number.isInteger(min) || min < 0)) return setError('Le montant minimum doit être un entier, 0 ou plus.');
    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) return setError('Le nombre d’utilisations doit être au moins 1.');
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return setError('La date de fin doit être après la date de début.');

    const input: PromoCodeInput = {
      code: text.trim(),
      type,
      value: amount,
      minOrderAmount: min,
      maxUses: uses,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      isActive,
    };
    setBusy(true);
    try {
      if (code) await updatePromoCode(code.id, input);
      else await createPromoCode(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{code ? 'Modifier le code' : 'Nouveau code promo'}</h1>
      <Card className="space-y-4">
        <Field label="Code" htmlFor="pc-code" hint="3 à 20 caractères : lettres, chiffres, tiret. Ex. BIENVENUE10. Le client peut le taper en majuscules ou en minuscules.">
          <Input id="pc-code" required minLength={3} maxLength={20} autoCapitalize="characters" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type de réduction" htmlFor="pc-type">
            <Select id="pc-type" value={type} onChange={(e) => setType(e.target.value as PromoCodeType)}>
              {Object.entries(PROMO_CODE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={type === 'PERCENTAGE' ? 'Pourcentage (1 à 100)' : `Montant (${currencyLabel(currency)})`} htmlFor="pc-value">
            <Input id="pc-value" required inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Achats minimum (${currencyLabel(currency)}, facultatif)`} htmlFor="pc-min">
            <Input id="pc-min" inputMode="numeric" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </Field>
          <Field label="Nombre d’utilisations max (facultatif)" htmlFor="pc-uses" hint="Vide = illimité.">
            <Input id="pc-uses" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </Field>
          <Field label="Valable à partir du (facultatif)" htmlFor="pc-start">
            <Input id="pc-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Valable jusqu’au (facultatif)" htmlFor="pc-end">
            <Input id="pc-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>
        <Checkbox id="pc-active" label="Code actif" checked={isActive} onChange={setIsActive} />
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
