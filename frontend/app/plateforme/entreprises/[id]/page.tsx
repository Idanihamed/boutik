'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, getPlatformBusiness, setReportStatus } from '../../../../lib/api';
import {
  ACTION_LABELS,
  ALLOWED_ACTIONS,
  countryName,
  EVENT_LABELS,
  formatDate,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  ROLE_LABELS,
} from '../../../../lib/labels';
import type { BusinessDetail, ModerationAction } from '../../../../lib/types';
import { ModerationDialog } from '../../../../components/ModerationDialog';
import { Alert, Button, Card, Spinner, StatusBadge } from '../../../../components/ui';

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ModerationAction | null>(null);
  const [busyReport, setBusyReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBusiness(await getPlatformBusiness(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger cette entreprise.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function closeReport(reportId: string, status: 'DISMISSED' | 'ACTIONED') {
    setBusyReport(reportId);
    try {
      await setReportStatus(reportId, status);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusyReport(null);
    }
  }

  if (error && !business) return <Alert>{error}</Alert>;
  if (!business) return <Spinner />;

  const openReports = business.reports.filter((r) => r.status === 'OPEN').length;

  return (
    <div className="space-y-5">
      <Link href="/plateforme" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour à la liste
      </Link>

      {error && <Alert>{error}</Alert>}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">{business.name}</h2>
            <p className="text-sm text-slate-500">
              /{business.slug} · {countryName(business.country)} ({business.currency}) · inscrite le{' '}
              {formatDate(business.createdAt)}
            </p>
          </div>
          <StatusBadge status={business.status} />
        </div>
        {business.description && <p className="text-slate-700">{business.description}</p>}
        {business.statusReason && (
          <Alert kind="info">
            <strong>Motif de la dernière décision :</strong> {business.statusReason}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {ALLOWED_ACTIONS[business.status].map((a) => (
            <Button
              key={a}
              variant={a === 'ban' || a === 'reject' || a === 'suspend' ? 'danger' : 'primary'}
              onClick={() => setAction(a)}
            >
              {ACTION_LABELS[a]}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">Équipe ({business.users.length})</h3>
        <ul className="divide-y divide-slate-100">
          {business.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <strong>{u.name}</strong> · {u.email}
              </span>
              <span className="text-slate-500">
                {ROLE_LABELS[u.role.name] ?? u.role.name}
                {!u.isActive && ' · désactivé'}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">
          Signalements ({business.reports.length}
          {openReports > 0 ? `, dont ${openReports} à examiner` : ''})
        </h3>
        {business.reports.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun signalement.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {business.reports.map((r) => (
              <li key={r.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{REPORT_REASON_LABELS[r.reason]}</span>
                  <span className={r.status === 'OPEN' ? 'font-medium text-red-700' : 'text-slate-500'}>
                    {REPORT_STATUS_LABELS[r.status]}
                  </span>
                </div>
                {r.comment && <p className="text-slate-700">« {r.comment} »</p>}
                <p className="text-xs text-slate-500">
                  Par {r.reporter.name} ({r.reporter.email}) · {formatDate(r.createdAt)}
                </p>
                {r.status === 'OPEN' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="secondary" loading={busyReport === r.id} onClick={() => closeReport(r.id, 'DISMISSED')}>
                      Classer sans suite
                    </Button>
                    <Button variant="ghost" loading={busyReport === r.id} onClick={() => closeReport(r.id, 'ACTIONED')}>
                      Marquer comme traité
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-slate-900">Historique des décisions</h3>
        {business.moderationLog.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune décision pour l’instant.</p>
        ) : (
          <ul className="space-y-2">
            {business.moderationLog.map((e) => (
              <li key={e.id} className="text-sm">
                <strong>{EVENT_LABELS[e.action] ?? e.action}</strong> par {e.actorName} · {formatDate(e.createdAt)}
                {e.reason && <span className="block text-slate-600">Motif : {e.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ModerationDialog
        businessId={business.id}
        businessName={business.name}
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          load();
        }}
      />
    </div>
  );
}
