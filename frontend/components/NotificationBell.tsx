'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api';
import { formatDate } from '../lib/labels';
import type { AppNotification } from '../lib/types';
import { Alert, Button, Modal, Spinner } from './ui';

const REFRESH_MS = 30_000;

/** Cloche du responsable : compteur des alertes non lues (commande, message, stock) et liste. */
export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      setCount(await getUnreadCount());
    } catch {
      // Silencieux : la cloche ne doit jamais gêner la navigation (réseau coupé, session expirée...).
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  const loadList = useCallback(async () => {
    try {
      setItems(await listNotifications());
      setError(null);
    } catch {
      setError('Impossible de charger les notifications.');
    }
  }, []);

  function openPanel() {
    setOpen(true);
    setItems(null);
    loadList();
  }

  async function openNotification(n: AppNotification) {
    if (!n.isRead && !n.virtual) {
      await markNotificationRead(n.id).catch(() => undefined);
      refreshCount();
    }
    setOpen(false);
    // Seuls les chemins internes de l'espace sont suivis.
    if (n.link && n.link.startsWith('/espace')) router.push(n.link);
  }

  async function readAll() {
    await markAllNotificationsRead().catch(() => undefined);
    await Promise.all([loadList(), refreshCount()]);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={count > 0 ? `Notifications, ${count} non lue${count > 1 ? 's' : ''}` : 'Notifications'}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <Modal open={open} title="Notifications" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          {error && <Alert>{error}</Alert>}
          {!items && !error && <Spinner />}
          {items && items.length === 0 && <p className="py-6 text-center text-slate-500">Rien de nouveau pour l’instant.</p>}
          {items && items.length > 0 && (
            <>
              <ul className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand-600'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.isRead ? 'text-slate-600' : 'font-medium text-slate-900'}`}>
                          {n.message}
                        </span>
                        <span className="block text-xs text-slate-500">{formatDate(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {count > 0 && (
                <Button variant="secondary" onClick={readAll}>
                  Tout marquer comme lu
                </Button>
              )}
            </>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
