import Link from 'next/link';

/** Mise en page commune aux textes légaux : titre, date, sections numérotées. */
export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 text-slate-700">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">Dernière mise à jour : {updated}</p>
      </header>
      <div className="space-y-6 leading-relaxed">{children}</div>
      <footer className="flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm">
        <Link href="/conditions" className="text-brand-700 hover:underline">
          Conditions d’utilisation
        </Link>
        <Link href="/confidentialite" className="text-brand-700 hover:underline">
          Politique de confidentialité
        </Link>
        <Link href="/" className="text-slate-500 hover:underline">
          Retour à l’accueil
        </Link>
      </footer>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
