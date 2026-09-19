'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, createTeamMember, deleteTeamMember, listTeam, updateTeamMember } from '../../../lib/api';
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../../lib/labels';
import { useCan, useSession } from '../../../lib/session';
import type { TeamMember } from '../../../lib/types';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Alert, Button, Card, Field, Input, Modal, Select, Spinner } from '../../../components/ui';

const ROLES = ['GESTIONNAIRE', 'EDITEUR', 'OWNER'] as const;

/** Mot de passe temporaire lisible (sans caractères ambigus), à transmettre à l'employé. */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

export default function TeamPage() {
  const can = useCan();
  const { user } = useSession();
  const [items, setItems] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMember | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TeamMember | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listTeam());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger l’équipe.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(member: TeamMember) {
    setBusyId(member.id);
    try {
      await updateTeamMember(member.id, { isActive: !member.isActive });
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
      await deleteTeamMember(deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Équipe</h1>
        {can('users:create') && <Button onClick={() => setEditing('new')}>Ajouter un membre</Button>}
      </div>
      <p className="text-sm text-slate-600">
        Donnez accès à votre espace à vos collaborateurs, avec des droits limités selon leur rôle.
      </p>

      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}

      {items && (
        <ul className="space-y-3">
          {items.map((member) => {
            const isMe = member.id === user?.id;
            return (
              <li key={member.id}>
                <Card className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {member.name} {isMe && <span className="text-sm font-normal text-slate-500">(vous)</span>}
                      </p>
                      <p className="break-all text-sm text-slate-600">{member.email}</p>
                      <p className="text-sm text-slate-500">Ajouté le {formatDate(member.createdAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {!member.isActive && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                          Accès suspendu
                        </span>
                      )}
                    </div>
                  </div>
                  {!isMe && (
                    <div className="flex flex-wrap gap-1">
                      {can('users:update') && (
                        <>
                          <Button variant="ghost" onClick={() => setEditing(member)}>
                            Modifier
                          </Button>
                          <Button variant="ghost" loading={busyId === member.id} onClick={() => toggleActive(member)}>
                            {member.isActive ? 'Suspendre l’accès' : 'Rétablir l’accès'}
                          </Button>
                        </>
                      )}
                      {can('users:delete') && (
                        <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setDeleting(member)}>
                          Supprimer
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <MemberForm
          member={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Supprimer ce membre ?"
        message={`« ${deleting?.name ?? ''} » n’aura plus accès à votre espace. Cette action est définitive.`}
        busy={busyId === deleting?.id}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function MemberForm({ member, onClose, onSaved }: { member: TeamMember | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [roleName, setRoleName] = useState(member?.role ?? 'GESTIONNAIRE');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (member) {
        await updateTeamMember(member.id, {
          name: name.trim(),
          email: email.trim(),
          roleName,
          ...(password ? { password } : {}),
        });
      } else {
        await createTeamMember({ name: name.trim(), email: email.trim(), roleName, password });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={member ? 'Modifier le membre' : 'Nouveau membre'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom" htmlFor="member-name">
          <Input id="member-name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email" htmlFor="member-email">
          <Input id="member-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Rôle" htmlFor="member-role" hint={ROLE_DESCRIPTIONS[roleName]}>
          <Select id="member-role" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={member ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe temporaire'}
          htmlFor="member-password"
          hint="10 caractères minimum. Transmettez-le à la personne : elle pourra se connecter avec son email."
        >
          <div className="flex gap-2">
            <Input
              id="member-password"
              required={!member}
              minLength={10}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>
              Générer
            </Button>
          </div>
        </Field>
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
    </Modal>
  );
}
