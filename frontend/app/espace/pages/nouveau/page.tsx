'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageForm } from '../../../../components/PageForm';

export default function NewContentPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/espace/pages" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux pages
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Nouvelle page</h1>
      <PageForm onSaved={() => router.push('/espace/pages')} />
    </div>
  );
}
