'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, listMessages } from '../../../lib/api';
import { formatDate, MESSAGE_STATUS_LABELS, MESSAGE_STATUS_STYLES } from '../../../lib/labels';
import type { AdminMessageRow, MessageStatus, Paginated } from '../../../lib/types';
import { Pagination } from '../../../components/Pagination';
import { Alert, Card, Select, Spinner } from '../../../components/ui';

export default function MessagesPage() {
  const [status, setStatus] = useState<MessageStatus | ''>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<AdminMessageRow> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setResult(await listMessages({ status: status || undefined, page }));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les messages.');
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <Select
          aria-label="Filtrer par statut"
          className="sm:max-w-[220px]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MessageStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les messages</option>
          {(Object.keys(MESSAGE_STATUS_LABELS) as MessageStatus[]).map((s) => (
            <option key={s} value={s}>
              {MESSAGE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}
      {!result && !error && <Spinner />}

      {result && result.data.length === 0 && (
        <Card className="text-center text-slate-500">
          {status ? 'Aucun message avec ce statut.' : 'Aucun message pour l’instant. Ceux envoyés depuis votre page « Contact » apparaîtront ici.'}
        </Card>
      )}

      {result && result.data.length > 0 && (
        <ul className="space-y-3">
          {result.data.map((m) => (
            <li key={m.id}>
              <Link href={`/espace/messages/${m.id}`} className="block">
                <Card className="space-y-1 hover:border-brand-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`truncate ${m.status === 'NOUVEAU' ? 'font-bold text-slate-900' : 'font-medium text-slate-800'}`}>
                      {m.subject}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MESSAGE_STATUS_STYLES[m.status]}`}>
                      {MESSAGE_STATUS_LABELS[m.status]}
                    </span>
                  </div>
                  <p className="truncate text-sm text-slate-600">{m.message || (m.voiceUrl ? 'Message vocal' : '')}</p>
                  <p className="text-xs text-slate-500">
                    {m.name} · {m.contact} · {formatDate(m.createdAt)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && <Pagination meta={result.meta} onChange={setPage} />}
    </div>
  );
}
