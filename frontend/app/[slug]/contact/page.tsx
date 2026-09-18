'use client';

import { useState } from 'react';
import { ApiError, request } from '../../../lib/api';
import { useStore } from '../../../lib/store-context';
import { Alert, Button, Card, Field, Input, Textarea } from '../../../components/ui';

export default function ContactPage() {
  const { store } = useStore();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // piège à robots
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await request<{ success: boolean; reference?: string }>(`/b/${store.slug}/contact`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          subject: subject.trim(),
          message: message.trim(),
          website: website || undefined,
        }),
      });
      setReference(res.reference ?? 'envoyé');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le message n’a pas pu être envoyé. Vérifiez votre connexion.');
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-md">
        <Card className="space-y-3 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Message envoyé</h1>
          <p className="text-slate-600">{store.name} vous répondra dès que possible.</p>
          {reference !== 'envoyé' && <p className="text-sm text-slate-500">Référence : <strong>{reference}</strong></p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Contacter {store.name}</h1>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Votre nom" htmlFor="m-name">
            <Input id="m-name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Téléphone ou email" htmlFor="m-contact" hint="Pour que l’entreprise puisse vous répondre.">
            <Input id="m-contact" required minLength={3} maxLength={150} value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Sujet" htmlFor="m-subject">
            <Input id="m-subject" required minLength={2} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" htmlFor="m-message">
            <Textarea id="m-message" rows={5} required minLength={5} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            <label htmlFor="m-website">Ne pas remplir</label>
            <input id="m-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>
            Envoyer
          </Button>
        </form>
      </Card>
    </div>
  );
}
