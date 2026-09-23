'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, forgotPassword } from '../../lib/api';
import { Alert, Button, Card, Field, Input } from '../../components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      // Toujours le même message, que l'email existe ou non (voir AuthService.requestPasswordReset).
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’envoyer cet email. Vérifiez votre connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-slate-600">
            Indiquez votre adresse email : si un compte y est associé, vous recevrez un lien pour choisir un nouveau mot de passe.
          </p>
        </div>

        {sent ? (
          <Alert kind="success">
            Si un compte existe pour cette adresse, un email vient d’être envoyé avec un lien valable 1 heure.
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Adresse email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" loading={busy}>
              Envoyer le lien
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-slate-600">
          <Link href="/connexion" className="font-medium text-brand-700 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </Card>
    </div>
  );
}
