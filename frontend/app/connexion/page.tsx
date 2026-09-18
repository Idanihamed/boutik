'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, login } from '../../lib/api';
import { homeFor, useSession } from '../../lib/session';
import { Alert, Button, Card, Field, Input } from '../../components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      const user = await refresh();
      router.replace(user ? homeFor(user) : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Vérifiez votre connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="space-y-5">
        <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Adresse email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mot de passe" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>
            Se connecter
          </Button>
        </form>
        <p className="text-center text-sm text-slate-600">
          Pas encore d’entreprise ?{' '}
          <Link href="/inscription" className="font-medium text-brand-700 hover:underline">
            Créer mon entreprise
          </Link>
        </p>
      </Card>
    </div>
  );
}
