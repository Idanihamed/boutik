'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApiError, registerBusiness } from '../../lib/api';
import { COUNTRIES, slugify } from '../../lib/labels';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui';

export default function RegisterPage() {
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [country, setCountry] = useState('CI');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string } | null>(null);

  function onBusinessNameChange(value: string) {
    setBusinessName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await registerBusiness({
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        businessName: businessName.trim(),
        slug: slug || undefined,
        country,
        description: description.trim() || undefined,
      });
      setDone({ name: res.business.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible. Vérifiez votre connexion internet.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Inscription reçue</h1>
          <p className="text-slate-600">
            Votre entreprise <strong>{done.name}</strong> est en attente de validation. Vous serez prévenu par email dès
            qu’elle sera examinée.
          </p>
          <p className="text-sm text-slate-500">En attendant, vous pouvez vous connecter pour préparer votre catalogue.</p>
          <Link
            href="/connexion"
            className="inline-block rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
          >
            Se connecter
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Créer mon entreprise</h1>
          <p className="mt-1 text-sm text-slate-600">Votre entreprise sera examinée avant d’apparaître publiquement.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Votre entreprise</legend>
            <Field label="Nom de l’entreprise" htmlFor="businessName">
              <Input
                id="businessName"
                required
                minLength={2}
                maxLength={100}
                value={businessName}
                onChange={(e) => onBusinessNameChange(e.target.value)}
              />
            </Field>
            <Field
              label="Adresse de votre vitrine"
              htmlFor="slug"
              hint={`Votre vitrine sera accessible sous « /${slug || 'nom-de-votre-entreprise'} ».`}
            >
              <Input
                id="slug"
                pattern="[a-z0-9][a-z0-9\-]{1,62}"
                title="Lettres minuscules, chiffres et tirets uniquement (2 à 63 caractères)."
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
              />
            </Field>
            <Field label="Pays" htmlFor="country" hint="La devise est choisie automatiquement selon le pays.">
              <Select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description (facultatif)" htmlFor="description">
              <Textarea
                id="description"
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 text-sm font-semibold text-slate-900">Votre compte responsable</legend>
            <Field label="Votre nom" htmlFor="ownerName">
              <Input
                id="ownerName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
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
          </fieldset>

          {error && <Alert>{error}</Alert>}
          <p className="text-center text-xs text-slate-500">
            En créant votre entreprise, vous acceptez les{' '}
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
            Créer mon entreprise
          </Button>
        </form>
        <p className="text-center text-sm text-slate-600">
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="font-medium text-brand-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  );
}
