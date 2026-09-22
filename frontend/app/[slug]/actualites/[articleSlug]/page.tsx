import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticle, getStorefront } from '../../../../lib/server-api';

/** Voir le commentaire équivalent dans app/[slug]/actualites/page.tsx. */
function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

type Props = { params: { slug: string; articleSlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle(params.slug, params.articleSlug);
  if (!article) return { title: 'Actualité introuvable' };
  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription ?? undefined,
  };
}

// Même principe que la page de contenu /<slug>/<pageSlug> : le contenu est déjà assaini côté
// serveur à l'enregistrement (voir sanitize-html.util.ts), donc sûr à injecter tel quel ici.
export default async function ArticlePage({ params }: Props) {
  const { slug, articleSlug } = params;
  const article = await getArticle(slug, articleSlug);
  if (!article) notFound();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <Link href={`/${slug}/actualites`} className="text-sm font-medium text-brand-700 hover:underline">
        ← Toutes les actualités
      </Link>

      {article.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.image} alt="" className="max-h-80 w-full rounded-xl object-cover" />
      )}

      <div className="space-y-2">
        {(article.category || article.publishedAt || article.author) && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {article.category && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{article.category}</span>}
            {article.publishedAt && <span>{formatArticleDate(article.publishedAt)}</span>}
            {article.author && <span>Par {article.author}</span>}
          </p>
        )}
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{article.title}</h1>
      </div>

      {/* Styles manuels ciblant les balises autorisées par sanitize-html.util.ts (voir la page
          de contenu /<slug>/<pageSlug>, même approche). */}
      <div
        className="space-y-4 leading-relaxed text-slate-700 [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-900 [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />
    </article>
  );
}
