'use client';

import { useState } from 'react';
import { ApiError, createArticle, updateArticle } from '../lib/api';
import type { Article } from '../lib/types';
import { ImageUploader } from './ImageUploader';
import { Alert, Button, Card, Field, Input, Textarea } from './ui';

const ALLOWED_TAGS_HINT =
  'Seules ces balises sont conservées : <p>, <br>, <strong>/<b>, <em>/<i>, <u>, <ul>/<ol>/<li>, <h2>/<h3>, <blockquote>, <a href="…">. Tout le reste (scripts, styles, autres balises) est retiré automatiquement à l’enregistrement.';

/** Date au format YYYY-MM-DD attendu par un <input type="date">, à partir d'un ISO complet. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

/**
 * Formulaire d'actualité, partagé par la création et la modification — même principe que
 * PageForm : la publication n'est pas un champ de ce formulaire, elle se fait par une action
 * dédiée sur la fiche de l'actualité (voir app/espace/actualites/[id]), jamais accordée à qui
 * n'a que `articles:update`. Contenu en HTML "simple", assaini côté serveur à l'enregistrement
 * (voir sanitize-html.util.ts) : pas encore de véritable éditeur visuel.
 */
export function ArticleForm({ article, onSaved }: { article?: Article; onSaved: () => void }) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [content, setContent] = useState(article?.content ?? '');
  const [image, setImage] = useState<string | null>(article?.image ?? null);
  const [author, setAuthor] = useState(article?.author ?? '');
  const [category, setCategory] = useState(article?.category ?? '');
  const [publishedAt, setPublishedAt] = useState(toDateInputValue(article?.publishedAt ?? null));
  const [seoTitle, setSeoTitle] = useState(article?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(article?.seoDescription ?? '');
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
      author: author.trim() || undefined,
      category: category.trim() || undefined,
      publishedAt: publishedAt || undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
    };
    try {
      if (article) await updateArticle(article.id, input);
      else await createArticle(input);
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
        <Field label="Titre" htmlFor="article-title" hint="Devient l’adresse de l’actualité (ex. « Soldes de rentrée » → /actualites/soldes-de-rentree).">
          <Input id="article-title" required minLength={2} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auteur (facultatif)" htmlFor="article-author">
            <Input id="article-author" maxLength={100} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Catégorie (facultatif)" htmlFor="article-category" hint="Sert de filtre sur la liste publique des actualités.">
            <Input id="article-category" maxLength={60} value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
        </div>
        <Field
          label="Date (facultatif)"
          htmlFor="article-date"
          hint="Utilisée pour trier les actualités. Renseignée automatiquement à la première publication si vous la laissez vide."
        >
          <Input id="article-date" type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
        </Field>
        <Field label="Contenu" htmlFor="article-content" hint={ALLOWED_TAGS_HINT}>
          <Textarea
            id="article-content"
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
        <Field label="Titre pour les moteurs de recherche" htmlFor="article-seo-title">
          <Input id="article-seo-title" maxLength={150} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </Field>
        <Field label="Description pour les moteurs de recherche" htmlFor="article-seo-desc">
          <Textarea id="article-seo-desc" rows={2} maxLength={300} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        </Field>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Button type="submit" className="w-full sm:w-auto" loading={busy}>
        Enregistrer
      </Button>
    </form>
  );
}
