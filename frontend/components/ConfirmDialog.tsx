'use client';

import { Button, Modal } from './ui';

/** Confirmation avant une action irréversible (suppression). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="danger" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
