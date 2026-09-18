'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, logout as apiLogout } from './api';
import type { AuthUser } from './types';

interface SessionValue {
  user: AuthUser | null;
  /** true tant que la première vérification de session n'est pas terminée. */
  loading: boolean;
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      // Erreur passagère (réseau coupé, serveur indisponible) : on ne déconnecte pas
      // l'utilisateur pour autant — seule une réponse « non connecté » (401/403, gérée dans
      // fetchMe) vide la session.
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return <SessionContext.Provider value={{ user, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession doit être utilisé sous <SessionProvider>.');
  return value;
}

/** Où envoyer un compte après connexion, selon son rôle. */
export function homeFor(user: AuthUser): string {
  if (user.role === 'PLATFORM_ADMIN') return '/plateforme';
  if (user.businessId) return '/espace';
  return '/';
}
