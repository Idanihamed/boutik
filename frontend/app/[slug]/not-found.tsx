import Link from 'next/link';

export default function StoreNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page introuvable</h1>
      <p className="text-slate-600">
        Cette boutique n’existe pas ou n’est pas disponible pour le moment.
      </p>
      <Link href="/" className="inline-block rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
        Retour à l’accueil
      </Link>
    </div>
  );
}
