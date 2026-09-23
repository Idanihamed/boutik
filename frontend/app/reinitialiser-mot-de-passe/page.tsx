'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApiError, resetPassword } from '../../lib/api';
import { Alert, Button, Card, Field, PasswordInput } from '../../components/ui';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.replace('/connexion'), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de réinitialiser ce mot de passe. Vérifiez votre connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Alert>
        Lien invalide.{' '}
        <Link href="/mot-de-passe-oublie" className="font-medium underline">
          Demander un nouveau lien
        </Link>
        .
      </Alert>
    );
  }

  if (done) {
    return <Alert kind="success">Mot de passe mis à jour. Redirection vers la connexion…</Alert>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nouveau mot de passe" htmlFor="newPassword" hint="10 caractères minimum.">
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={200}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" className="w-full" loading={busy}>
        Choisir ce mot de passe
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <Card className="space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Nouveau mot de passe</h1>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </div>
  );
}
