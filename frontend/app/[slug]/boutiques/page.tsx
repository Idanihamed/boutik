import { notFound } from 'next/navigation';
import { getBoutiques, getStorefront } from '../../../lib/server-api';
import { Card } from '../../../components/ui';

/** Lien WhatsApp : garde uniquement les chiffres du numéro saisi. */
function whatsappLink(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** Seuls les liens web sont acceptés (jamais javascript: ni autre schéma). */
function safeUrl(raw: string | null): string | null {
  return raw && /^https?:\/\//i.test(raw) ? raw : null;
}

export default async function BoutiquesPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const store = await getStorefront(slug);
  if (!store) notFound();
  const boutiques = (await getBoutiques(slug)) ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Nos boutiques</h1>

      {boutiques.length === 0 && (
        <Card className="text-center text-slate-500">
          {store.name} n’a pas encore de boutique physique. Vous pouvez commander en ligne.
        </Card>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {boutiques.map((b) => {
          const photo = b.images.find((i) => i.isMain) ?? b.images[0];
          const wa = b.whatsapp ? whatsappLink(b.whatsapp) : null;
          const maps = safeUrl(b.googleMapsUrl);
          return (
            <li key={b.id}>
              <Card className="h-full space-y-3">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.alt ?? b.name} className="h-40 w-full rounded-lg object-cover" />
                )}
                <h2 className="text-lg font-semibold text-slate-900">{b.name}</h2>
                <p className="text-slate-700">{b.address}</p>
                {b.hours && <p className="whitespace-pre-line text-sm text-slate-600">{b.hours}</p>}
                {b.description && <p className="text-sm text-slate-600">{b.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {b.phone && (
                    <a
                      href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Appeler
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      WhatsApp
                    </a>
                  )}
                  {maps && (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Itinéraire
                    </a>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
