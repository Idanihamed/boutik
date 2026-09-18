import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-10 py-6 text-center sm:py-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Votre boutique en ligne, <span className="text-brand-700">prête en quelques minutes</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">
          Boutik permet à chaque entreprise de présenter ses produits, recevoir des commandes et échanger avec ses
          clients, depuis son téléphone ou son ordinateur.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/inscription"
          className="w-full rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white hover:bg-brand-700 sm:w-auto"
        >
          Créer mon entreprise
        </Link>
        <Link
          href="/connexion"
          className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Se connecter
        </Link>
      </div>
      <ul className="mx-auto grid max-w-3xl gap-4 text-left sm:grid-cols-3">
        {[
          ['Votre vitrine', 'Une page à votre nom, avec votre logo, vos produits et vos promotions.'],
          ['Validée pour la confiance', 'Chaque entreprise est vérifiée avant d’apparaître, pour protéger les clients.'],
          ['Simple à gérer', 'Produits, stock, commandes et messages depuis un seul espace.'],
        ].map(([title, text]) => (
          <li key={title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
