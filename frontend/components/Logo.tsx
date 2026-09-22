import Link from 'next/link';

/** Logo de Boutik : un sac vert et le nom en police d'affichage. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Boutik, accueil">
      <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand-600 text-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </span>
      <span className="font-display text-2xl font-extrabold tracking-tight text-slate-900">Boutik</span>
    </Link>
  );
}
