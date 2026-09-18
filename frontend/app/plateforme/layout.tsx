'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../lib/session';
import { Spinner } from '../../components/ui';

/** Espace réservé à l'administrateur de la plateforme : toute autre personne est renvoyée. */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/connexion');
    else if (user.role !== 'PLATFORM_ADMIN') router.replace('/');
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'PLATFORM_ADMIN') return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Espace plateforme</h1>
      {children}
    </div>
  );
}
