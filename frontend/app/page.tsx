import Link from 'next/link';
import { ShopCard } from '../components/ShopCard';
import { getDirectory } from '../lib/server-api';

// Les boutiques à découvrir se rafraîchissent chaque minute, sans redéploiement.
export const revalidate = 60;

const STEPS = [
  ['Créez votre boutique', 'Votre nom, votre logo, votre pays. Boutik vérifie puis publie votre vitrine.'],
  ['Ajoutez vos produits', 'Une photo prise avec le téléphone, un prix, un stock. C’est tout.'],
  ['Recevez les commandes', 'Votre téléphone sonne à chaque commande, même application fermée.'],
];

export default async function HomePage() {
  const shops = await getDirectory({ limit: 6 });

  return (
    <div className="space-y-14 sm:space-y-20">
      <section className="grid items-center gap-8 sm:grid-cols-[1.2fr_1fr] sm:gap-12">
        <div className="space-y-5">
          <span className="inline-block rounded-full bg-brand-100 px-3 py-1.5 text-[13px] font-semibold text-brand-700">
            Pour les commerçants
          </span>
          <h1 className="text-[2.75rem] font-extrabold leading-[1.04] tracking-tight text-slate-900 sm:text-6xl">
            Votre boutique en ligne, <span className="text-brand-600">prête aujourd’hui.</span>
          </h1>
          <p className="max-w-xl text-[17px] leading-relaxed text-slate-500">
            Présentez vos produits, recevez les commandes et répondez à vos clients, depuis votre téléphone.
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href="/inscription"
              className="flex h-[54px] items-center justify-center rounded-2xl bg-brand-600 px-8 text-[17px] font-bold text-white hover:bg-brand-700"
            >
              Créer ma boutique
            </Link>
            <Link
              href="/entreprises"
              className="flex h-[54px] items-center justify-center rounded-2xl border-[1.5px] border-slate-300 bg-white px-8 text-[17px] font-semibold text-slate-900 hover:bg-slate-100"
            >
              Découvrir les boutiques
            </Link>
          </div>
        </div>

        {/* Illustration : l'alerte que reçoit un commerçant à chaque commande. */}
        <div className="relative pb-6 pt-2" aria-hidden="true">
          <div className="absolute inset-x-5 bottom-0 h-20 rounded-2xl bg-slate-100" />
          <div className="relative flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-[0_6px_20px_rgba(27,31,29,0.08)]">
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-accent-50 text-accent-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-slate-900">Nouvelle commande</span>
              <span className="block text-sm text-slate-500">Awa · 2 articles · 10 500 FCFA</span>
            </span>
            <span className="text-xs font-semibold text-slate-500">à l’instant</span>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Comment ça marche</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand-600 font-display text-xl font-extrabold text-brand-600">
                {i + 1}
              </span>
              <span>
                <span className="block text-lg font-bold text-slate-900">{title}</span>
                <span className="mt-1 block text-[15px] leading-relaxed text-slate-500">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {shops.data.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Boutiques à découvrir</h2>
            <Link href="/entreprises" className="shrink-0 text-[15px] font-semibold text-brand-700 hover:underline">
              Tout voir
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {shops.data.map((shop) => (
              <li key={shop.slug}>
                <ShopCard shop={shop} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex flex-wrap justify-center gap-4 pb-4 text-[13px] text-slate-500">
        <Link href="/conditions" className="hover:underline">
          Conditions d’utilisation
        </Link>
        <Link href="/confidentialite" className="hover:underline">
          Confidentialité
        </Link>
      </p>
    </div>
  );
}
