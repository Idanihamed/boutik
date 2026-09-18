'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ApiError, request } from '../../../lib/api';
import { REPORT_REASON_LABELS } from '../../../lib/labels';
import { useSession } from '../../../lib/session';
import { useStore } from '../../../lib/store-context';
import type { ReportReason } from '../../../lib/types';
import { Alert, Button, Card, Field, Select, Spinner, Textarea } from '../../../components/ui';

export default function ReportPage() {
  const { store } = useStore();
  const { user, loading } = useSession();
  const pathname = usePathname();
  const [reason, setReason] = useState<ReportReason>('SCAM');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request(`/businesses/${store.slug}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le signalement n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="space-y-3 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Merci</h1>
          <p className="text-slate-600">Votre signalement a été transmis à l’équipe Boutik, qui l’examinera.</p>
          <Link href={`/${store.slug}`} className="inline-block font-medium text-brand-700 hover:underline">
            Retour à la boutique
          </Link>
        </Card>
      </div>
    );
  }

  const retour = encodeURIComponent(pathname);

  return (
    <div className="mx-auto max-w-lg">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Signaler {store.name}</h1>
        {!user ? (
          <>
            <Alert kind="info">
              Pour éviter les abus, il faut un compte pour signaler une entreprise. La connexion ou l’inscription ne
              prend qu’une minute.
            </Alert>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/connexion?retour=${retour}`}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Se connecter
              </Link>
              <Link
                href={`/creer-un-compte?retour=${retour}`}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Créer un compte
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-600">
              Signalez cette entreprise si vous pensez qu’elle enfreint les règles (arnaque, faux produits…). Une
              équipe examine chaque signalement ; l’entreprise n’est jamais suspendue automatiquement.
            </p>
            <Field label="Motif" htmlFor="r-reason">
              <Select id="r-reason" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
                {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
                  <option key={r} value={r}>
                    {REPORT_REASON_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Précisions (facultatif)" htmlFor="r-comment">
              <Textarea id="r-comment" rows={4} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" loading={busy}>
              Envoyer le signalement
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
