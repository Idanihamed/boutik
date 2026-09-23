'use client';

import { useState } from 'react';
import { ApiError, createPage, updatePage } from '../lib/api';
import type { ContentPage } from '../lib/types';
import { ImageUploader } from './ImageUploader';
import { RichTextEditor } from './RichTextEditor';
import { Alert, Button, Card, Field, Input, Textarea } from './ui';

/** Vide, ou seulement des balises sans texte (ex. « <p></p> » que rend un éditeur vide). */
function isContentEmpty(html: string): boolean {
  return html.replace(/<[^>]+>/g, '').trim().length === 0;
}

/**
 * Formulaire de page de contenu (À propos, Livraison, Conditions générales de vente propres à
 * l’entreprise…), partagé par la création et la modification. La publication n'est PAS un champ
 * de ce formulaire — même choix que ProductForm : elle se fait par une action dédiée sur la fiche
 * de la page (voir app/espace/pages/[id]), pour ne jamais l'accorder à qui n'a que `pages:update`.
 * Le contenu est saisi via RichTextEditor (éditeur visuel), configuré pour ne produire que les
 * balises que sanitize-html.util.ts autorise côté serveur — qui nettoie de toute façon ce champ à
 * l'enregistrement, cet éditeur n'est qu'un confort de saisie, jamais la seule protection.
 */
export function PageForm({ page, onSaved }: { page?: ContentPage; onSaved: () => void }) {
  const [title, setTitle] = useState(page?.title ?? '');
  const [content, setContent] = useState(page?.content ?? '');
  const [image, setImage] = useState<string | null>(page?.image ?? null);
  const [seoTitle, setSeoTitle] = useState(page?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(page?.seoDescription ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isContentEmpty(content)) {
      setError('Le contenu ne peut pas être vide.');
      return;
    }
    setBusy(true);
    const input = {
      title: title.trim(),
      content,
      image: image ?? undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
    };
    try {
      if (page) await updatePage(page.id, input);
      else await createPage(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="space-y-4">
        <Field label="Titre" htmlFor="page-title" hint="Devient l’adresse de la page (ex. « Livraison » → /livraison) et son titre affiché.">
          <Input id="page-title" required minLength={2} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Contenu" htmlFor="page-content">
          <RichTextEditor value={content} onChange={setContent} />
        </Field>
        <ImageUploader label="Image d’illustration (facultative)" value={image} onChange={setImage} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Référencement (facultatif)</h2>
        <Field label="Titre pour les moteurs de recherche" htmlFor="page-seo-title">
          <Input id="page-seo-title" maxLength={150} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </Field>
        <Field label="Description pour les moteurs de recherche" htmlFor="page-seo-desc">
          <Textarea id="page-seo-desc" rows={2} maxLength={300} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        </Field>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" className="w-full sm:w-auto" loading={busy}>
        Enregistrer
      </Button>
    </form>
  );
}
