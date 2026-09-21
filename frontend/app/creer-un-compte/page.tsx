'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApiError, login, registerCustomer, safeReturnPath } from '../../lib/api';
import { useSession } from '../../lib/session';
import { Alert, Button, Card, Field, Input } from '../../components/ui';

function CustomerRegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const retour = safeReturnPath(params.get('retour'));
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerCustomer({ name: name.trim(), email: email.trim(), password });
      // Connecté tout de suite : pas de seconde saisie pour un client qui voulait juste signaler.
      await login(email.trim(), password);
      await refresh();
      router.replace(retour ?? '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible. Vérifiez votre connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Créer un compte</h1>
        <p className="mt-1 text-sm text-slate-600">Pour signaler une entreprise et retrouver vos échanges.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Votre nom" htmlFor="name">
          <Input id="name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Adresse email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe" htmlFor="password" hint="10 caractères minimum.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <Alert>{error}</Alert>}
        <p className="text-center text-xs text-slate-500">
          En créant un compte, vous acceptez les{' '}
          <Link href="/conditions" className="underline">
            conditions d’utilisation
          </Link>{' '}
          et la{' '}
          <Link href="/confidentialite" className="underline">
            politique de confidentialité
          </Link>
          .
        </p>
        <Button type="submit" className="w-full" loading={busy}>
          Créer mon compte
        </Button>
      </form>
      <p className="text-center text-sm text-slate-600">
        Déjà un compte ?{' '}
        <Link
          href={retour ? `/connexion?retour=${encodeURIComponent(retour)}` : '/connexion'}
          className="font-medium text-brand-700 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </Card>
  );
}

export default function CustomerRegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <Suspense>
        <CustomerRegisterForm />
      </Suspense>
    </div>
  );
}
