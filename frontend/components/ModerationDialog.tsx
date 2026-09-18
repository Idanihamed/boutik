'use client';

import { useState } from 'react';
import { ApiError, moderateBusiness } from '../lib/api';
import { ACTION_LABELS, REASON_REQUIRED } from '../lib/labels';
import type { ModerationAction } from '../lib/types';
import { Alert, Button, Field, Modal, Textarea } from './ui';

const CONFIRM_TEXT: Record<ModerationAction, string> = {
  approve: 'L’entreprise deviendra visible du public et son responsable sera prévenu.',
  reject: 'L’inscription sera refusée. Le motif sera communiqué au responsable.',
  suspend: 'La vitrine sera masquée et les sessions du personnel coupées. Le motif sera communiqué.',
  ban: 'L’entreprise sera retirée définitivement de la plateforme. Le motif sera communiqué.',
  reactivate: 'La vitrine sera de nouveau visible et le personnel pourra se reconnecter.',
};

/** Confirme une décision de modération, avec un motif obligatoire quand l'API l'exige. */
export function ModerationDialog({
  businessId,
  businessName,
  action,
  onClose,
  onDone,
}: {
  businessId: string;
  businessName: string;
  action: ModerationAction | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!action) return null;
  const needsReason = REASON_REQUIRED[action];

  function close() {
    setReason('');
    setError(null);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      await moderateBusiness(businessId, action, reason.trim() || undefined);
      setReason('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La décision a échoué.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`${ACTION_LABELS[action]} « ${businessName} »`} onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">{CONFIRM_TEXT[action]}</p>
        <Field label={needsReason ? 'Motif (obligatoire)' : 'Motif (facultatif)'} htmlFor="reason">
          <Textarea
            id="reason"
            rows={3}
            maxLength={500}
            required={needsReason}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Annuler
          </Button>
          <Button type="submit" variant={action === 'ban' || action === 'reject' || action === 'suspend' ? 'danger' : 'primary'} loading={busy}>
            {ACTION_LABELS[action]}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
