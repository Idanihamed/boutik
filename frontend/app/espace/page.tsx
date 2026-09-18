'use client';

import Link from 'next/link';
import { useSession } from '../../lib/session';
import { STATUS_LABELS } from '../../lib/labels';
import { Card, StatusBadge } from '../../components/ui';

const STATUS_MESSAGES = {
  PENDING: 'Votre entreprise est en attente de validation. Elle n’est pas encore visible du public.',
  ACTIVE: 'Votre entreprise est active et visible du public.',
  REJECTED: 'Votre inscription a été refusée.',
  SUSPENDED: 'Votre entreprise est suspendue : sa vitrine est masquée.',
  BANNED: 'Votre entreprise a été bannie de la plateforme.',
} as const;

const STEPS = [
  { href: '/espace/entreprise', title: 'Complétez votre entreprise', text: 'Ajoutez votre logo et une description.', permission: 'business:update' },
  { href: '/espace/categories', title: 'Créez vos catégories', text: 'Par exemple : Téléphones, Accessoires…', permission: 'categories:create' },
  { href: '/espace/produits/nouveau', title: 'Ajoutez vos premiers produits', text: 'Photos, prix et stock.', permission: 'products:create' },
];

export default function OwnerHomePage() {
  const { user } = useSession();
  if (!user?.business) return null;
  const { business } = user;

  return (
    <div className="space-y-5">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
          <StatusBadge status={business.status} />
        </div>
        <p className="text-slate-600">{STATUS_MESSAGES[business.status]}</p>
        <p className="text-sm text-slate-500">
          Statut : {STATUS_LABELS[business.status]} · adresse de la vitrine : <strong>/{business.slug}</strong>
        </p>
      </Card>

      <section aria-labelledby="premiers-pas" className="space-y-3">
        <h2 id="premiers-pas" className="text-lg font-semibold text-slate-900">
          Premiers pas
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {STEPS.filter((s) => user.permissions.includes(s.permission)).map((step, i) => (
            <li key={step.href}>
              <Link
                href={step.href}
                className="block h-full rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-600 hover:shadow-sm"
              >
                <span className="text-sm font-semibold text-brand-700">Étape {i + 1}</span>
                <span className="mt-1 block font-semibold text-slate-900">{step.title}</span>
                <span className="mt-1 block text-sm text-slate-600">{step.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
