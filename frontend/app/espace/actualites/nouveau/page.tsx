'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArticleForm } from '../../../../components/ArticleForm';

export default function NewArticlePage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/espace/actualites" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux actualités
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Nouvelle actualité</h1>
      <ArticleForm onSaved={() => router.push('/espace/actualites')} />
    </div>
  );
}
