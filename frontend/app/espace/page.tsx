'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../lib/session';
import { STATUS_LABELS } from '../../lib/labels';
import { Alert, Card, Spinner, StatusBadge } from '../../components/ui';

const STATUS_MESSAGES = {
  PENDING: 'Votre entreprise est en attente de validation. Elle n’est pas encore visible du public.',
  ACTIVE: 'Votre entreprise est active et visible du public.',
  REJECTED: 'Votre inscription a été refusée.',
  SUSPENDED: 'Votre entreprise est suspendue : sa vitrine est masquée.',
  BANNED: 'Votre entreprise a été bannie de la plateforme.',
} as const;

// Espace du responsable — écran provisoire : la gestion des produits, commandes et messages
// arrive à l'étape suivante. Il montre déjà l'état de l'entreprise (validation en cours, etc.).
export default function OwnerSpacePage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && !user) router.replace('/connexion');
  }, [loading, user, router]);

  if (loading || !user) return <Spinner />;
  if (!user.business) return <Alert kind="info">Ce compte n’est rattaché à aucune entreprise.</Alert>;

  const { business } = user;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
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
      <Alert kind="info">La gestion de vos produits, commandes et messages sera disponible très bientôt dans cet espace.</Alert>
    </div>
  );
}
