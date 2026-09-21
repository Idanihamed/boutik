'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { homeFor, useSession } from '../lib/session';
import { NotificationBell } from './NotificationBell';
import { Button } from './ui';

// Pages de la plateforme elle-même. Toute autre adresse est la vitrine d'une entreprise, qui a son
// propre en-tête (StoreHeader) : celui de Boutik s'y effacerait pour laisser la place à l'entreprise.
const PLATFORM_PATHS = [
  '/connexion',
  '/inscription',
  '/creer-un-compte',
  '/espace',
  '/plateforme',
  '/conditions',
  '/confidentialite',
  '/mentions-legales',
  '/entreprises',
  '/mes-commandes',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
];

export function Header() {
  const { user, loading, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isPlatformPage = pathname === '/' || PLATFORM_PATHS.some((p) => pathname.startsWith(p));
  if (!isPlatformPage) return null;

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand-700">
          Boutik
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {loading ? null : user ? (
            <>
              {user.businessId && pathname.startsWith('/espace') && <NotificationBell />}
              <Link href={homeFor(user)} className="hidden rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 sm:inline">
                {user.name}
              </Link>
              <Button variant="secondary" onClick={handleLogout}>
                Déconnexion
              </Button>
            </>
          ) : (
            <>
              <Link href="/connexion" className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
                Se connecter
              </Link>
              <Link
                href="/inscription"
                className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700"
              >
                Créer mon entreprise
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
