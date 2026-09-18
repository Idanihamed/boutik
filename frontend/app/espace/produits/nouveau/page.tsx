'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductForm } from '../../../../components/ProductForm';

export default function NewProductPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/espace/produits" className="text-sm font-medium text-brand-700 hover:underline">
        ← Retour aux produits
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Nouveau produit</h1>
      <ProductForm onSaved={() => router.push('/espace/produits')} />
    </div>
  );
}
