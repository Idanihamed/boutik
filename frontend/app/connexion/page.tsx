'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApiError, login, safeReturnPath } from '../../lib/api';
import { homeFor, useSession } from '../../lib/session';
import { Alert, Button, Card, Field, Input, PasswordInput } from '../../components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const retour = safeReturnPath(params.get('retour'));
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
      // Un client est renvoyé là où il était (ex. la vitrine qu'il voulait signaler) ; le
      // personnel et la plateforme retrouvent leur espace.
      router.replace(user && (user.role === 'PLATFORM_ADMIN' || user.businessId) ? homeFor(user) : (retour ?? '/'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Vérifiez votre connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Adresse email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <p className="text-right text-sm">
          <Link href="/mot-de-passe-oublie" className="font-medium text-brand-700 hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" className="w-full" loading={busy}>
          Se connecter
        </Button>
      </form>
      <div className="space-y-1 text-center text-sm text-slate-600">
        <p>
          Pas encore de compte ?{' '}
          <Link
            href={retour ? `/creer-un-compte?retour=${encodeURIComponent(retour)}` : '/creer-un-compte'}
            className="font-medium text-brand-700 hover:underline"
          >
            Créer un compte
          </Link>
        </p>
        <p>
          Vous avez une entreprise à présenter ?{' '}
          <Link href="/inscription" className="font-medium text-brand-700 hover:underline">
            Créer mon entreprise
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
