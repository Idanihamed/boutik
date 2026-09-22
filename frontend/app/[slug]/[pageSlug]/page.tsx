import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentPage } from '../../../lib/server-api';

type Props = { params: { slug: string; pageSlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getContentPage(params.slug, params.pageSlug);
  if (!page) return { title: 'Page introuvable' };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription ?? undefined,
  };
}

// Page de contenu propre à une entreprise (À propos, Livraison, ses propres conditions de
// vente…), à l'adresse de son choix (/<slug>/<pageSlug>). Le contenu est déjà assaini côté
// serveur à l'enregistrement (voir sanitize-html.util.ts) : c'est la seule page du site public
// qui injecte du HTML fourni par un compte entreprise via dangerouslySetInnerHTML, jamais du
// HTML brut non filtré.
export default async function ContentPagePage({ params }: Props) {
  const page = await getContentPage(params.slug, params.pageSlug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      {page.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.image} alt="" className="max-h-80 w-full rounded-xl object-cover" />
      )}
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{page.title}</h1>
      {/*
        Pas de plugin Tailwind Typography installé : styles manuels ciblant directement les
        balises que sanitize-html.util.ts autorise (voir sa liste ALLOWED_TAGS côté serveur),
        rien de plus n'a donc besoin d'être stylé ici.
      */}
      <div
        className="space-y-4 leading-relaxed text-slate-700 [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-slate-900 [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </article>
  );
}
