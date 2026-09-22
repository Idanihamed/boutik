'use client';

import { useState } from 'react';
import { ApiError, createPage, updatePage } from '../lib/api';
import type { ContentPage } from '../lib/types';
import { ImageUploader } from './ImageUploader';
import { Alert, Button, Card, Field, Input, Textarea } from './ui';

const ALLOWED_TAGS_HINT =
  'Seules ces balises sont conservées : <p>, <br>, <strong>/<b>, <em>/<i>, <u>, <ul>/<ol>/<li>, <h2>/<h3>, <blockquote>, <a href="…">. Tout le reste (scripts, styles, autres balises) est retiré automatiquement à l’enregistrement.';

/**
 * Formulaire de page de contenu (À propos, Livraison, Conditions générales de vente propres à
 * l’entreprise…), partagé par la création et la modification. La publication n'est PAS un champ
 * de ce formulaire — même choix que ProductForm : elle se fait par une action dédiée sur la fiche
 * de la page (voir app/espace/pages/[id]), pour ne jamais l'accorder à qui n'a que `pages:update`.
 * Le contenu est saisi en HTML "simple" : pas encore de véritable éditeur visuel (voir
 * sanitize-html.util.ts côté serveur, qui nettoie de toute façon ce champ à l'enregistrement — un
 * champ mal formé n'est jamais une faille, seulement une mise en forme perdue).
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
        <Field label="Contenu" htmlFor="page-content" hint={ALLOWED_TAGS_HINT}>
          <Textarea
            id="page-content"
            required
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="font-mono text-sm"
          />
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
