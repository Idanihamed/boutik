import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchMe, hasStoredSession, login as apiLogin, logout as apiLogout, setSessionLostHandler } from './api';
import { registerForPush, unregisterFromPush } from './push';
import type { AuthUser } from './types';

interface SessionValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

const NOT_A_BUSINESS_ACCOUNT =
  'Cette application est réservée aux responsables et à l’équipe d’une entreprise. Les clients commandent sur le site.';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Au lancement : reprend la session enregistrée sur le téléphone, s'il y en a une.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (await hasStoredSession()) {
          const me = await fetchMe();
          if (active && me.businessId) {
            setUser(me);
            void registerForPush();
          }
        }
      } catch {
        // Session expirée ou serveur injoignable : retour à l'écran de connexion.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    return () => setSessionLostHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email.trim(), password);
    const me = await fetchMe();
    if (!me.businessId) {
      await apiLogout();
      throw new ApiError(NOT_A_BUSINESS_ACCOUNT, 403);
    }
    setUser(me);
    void registerForPush();
  }, []);

  const logout = useCallback(async () => {
    await unregisterFromPush();
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, loading, login, logout, can: (permission) => Boolean(user?.permissions.includes(permission)) }),
    [user, loading, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession doit être utilisé dans <SessionProvider>.');
  return ctx;
}
