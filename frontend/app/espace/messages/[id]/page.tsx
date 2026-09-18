'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, deleteMessage, getMessage, replyToMessage, setMessageStatus } from '../../../../lib/api';
import {
  attachmentKind,
  contactLinks,
  formatDate,
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUS_STYLES,
} from '../../../../lib/labels';
import { useCan } from '../../../../lib/session';
import type { AdminMessage, MessageStatus } from '../../../../lib/types';
import { ConfirmDialog } from '../../../../components/ConfirmDialog';
import { Alert, Button, Card, Field, Spinner, Textarea } from '../../../../components/ui';

function Attachment({ url, label }: { url: string; label: string }) {
  const kind = attachmentKind(url);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="max-h-72 rounded-lg border border-slate-200" />
      )}
      {kind === 'video' && <video src={url} controls className="max-h-72 rounded-lg" />}
      {kind === 'other' && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 underline">
          Ouvrir le fichier
        </a>
      )}
    </div>
  );
}

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useCan();

  const [message, setMessage] = useState<AdminMessage | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      // Ouvrir un message « Nouveau » le passe automatiquement à « Lu » (côté API).
      setMessage(await getMessage(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger ce message.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
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
      await deleteMessage(id);
      router.push('/espace/messages');
    } catch (err) {
      setConfirmDelete(false);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
      setBusy(false);
    }
  }

  if (error && !message) return <Alert>{error}</Alert>;
  if (!message) return <Spinner />;

  const canUpdate = can('messages:update');
  const links = contactLinks(message.contact);
  const isEmail = message.contact.includes('@');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/espace/messages" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux messages
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">{message.subject}</h1>
          <p className="text-sm text-slate-500">
            {formatDate(message.createdAt)} · référence {message.reference}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${MESSAGE_STATUS_STYLES[message.status]}`}>
          {MESSAGE_STATUS_LABELS[message.status]}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card className="space-y-3">
        <div>
          <p className="font-medium text-slate-900">{message.name}</p>
          <p className="text-sm text-slate-600">{message.contact}</p>
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target={l.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
        {message.message && <p className="whitespace-pre-line border-t border-slate-100 pt-3 text-slate-800">{message.message}</p>}
        {message.voiceUrl && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Message vocal</p>
            <audio src={message.voiceUrl} controls className="w-full" />
          </div>
        )}
        {message.attachmentUrl && <Attachment url={message.attachmentUrl} label="Fichier joint" />}
      </Card>

      {message.replyMessage || message.replyVoiceUrl ? (
        <Card className="space-y-2 border-emerald-200 bg-emerald-50">
          <h2 className="font-semibold text-emerald-900">
            Votre réponse{message.repliedAt ? ` · ${formatDate(message.repliedAt)}` : ''}
          </h2>
          {message.replyMessage && <p className="whitespace-pre-line text-slate-800">{message.replyMessage}</p>}
          {message.replyVoiceUrl && <audio src={message.replyVoiceUrl} controls className="w-full" />}
          {message.replyAttachmentUrl && <Attachment url={message.replyAttachmentUrl} label="Fichier joint à la réponse" />}
        </Card>
      ) : (
        canUpdate && (
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => replyToMessage(id, reply.trim()), 'Réponse enregistrée.');
              }}
              className="space-y-3"
            >
              <Field
                label="Votre réponse"
                htmlFor="reply"
                hint={
                  isEmail
                    ? 'Elle sera aussi envoyée par email au client, et consultable avec sa référence.'
                    : 'Le client la consultera sur la page « Suivi » de votre boutique avec sa référence.'
                }
              >
                <Textarea id="reply" rows={5} required minLength={2} maxLength={5000} value={reply} onChange={(e) => setReply(e.target.value)} />
              </Field>
              <Button type="submit" loading={busy}>
                Envoyer la réponse
              </Button>
            </form>
          </Card>
        )
      )}

      {canUpdate && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MESSAGE_STATUS_LABELS) as MessageStatus[])
            .filter((s) => s !== message.status)
            .map((s) => (
              <Button key={s} variant="secondary" disabled={busy} onClick={() => run(() => setMessageStatus(id, s), 'Statut mis à jour.')}>
                Marquer comme {MESSAGE_STATUS_LABELS[s].toLowerCase()}
              </Button>
            ))}
          {can('messages:delete') && (
            <Button variant="ghost" className="text-red-700 hover:bg-red-50" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce message ?"
        message="Ce message sera supprimé définitivement."
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
