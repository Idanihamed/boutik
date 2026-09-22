import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticles, getStorefront } from '../../../lib/server-api';

/** Contrairement à formatDate() (utilisée pour l'horodatage d'une commande), la date d'une
 * actualité n'a pas besoin de l'heure : elle se lit comme la date d'un article de blog. */
function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

type Props = { params: { slug: string }; searchParams: { page?: string; categorie?: string } };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const store = await getStorefront(params.slug);
  return { title: store ? `Actualités · ${store.name}` : 'Actualités' };
}

export default async function ArticlesPage({ params, searchParams }: Props) {
  const { slug } = params;
  const store = await getStorefront(slug);
  if (!store) notFound();

  const page = Math.max(1, Number(searchParams.page) || 1);
  const result = await getArticles(slug, { category: searchParams.categorie || undefined, page, limit: 9 });
  const articles = result?.data ?? [];
  const meta = result?.meta;

  function pageHref(target: number) {
    const query = new URLSearchParams();
    if (searchParams.categorie) query.set('categorie', searchParams.categorie);
    query.set('page', String(target));
    return `/${slug}/actualites?${query}`;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Actualités</h1>

      {articles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          {store.name} n’a pas encore publié d’actualité.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/${slug}/actualites/${a.slug}`}
                className="block h-full overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-brand-500 hover:shadow-[0_8px_24px_rgba(14,107,87,0.12)]"
              >
                {a.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 w-full bg-slate-100" />
                )}
                <div className="space-y-1.5 p-4">
                  {(a.category || a.publishedAt) && (
                    <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                      {a.category && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{a.category}</span>}
                      {a.publishedAt && <span>{formatArticleDate(a.publishedAt)}</span>}
                    </p>
                  )}
                  <h2 className="line-clamp-2 font-display text-base font-bold text-slate-900">{a.title}</h2>
                  {a.author && <p className="text-xs text-slate-500">Par {a.author}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
              Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-600">
            Page {meta.page} sur {meta.totalPages}
          </span>
          {page < meta.totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
              Suivant
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
