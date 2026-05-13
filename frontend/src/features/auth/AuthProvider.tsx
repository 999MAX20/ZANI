import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getCurrentUser, login as apiLogin, logout as apiLogout } from "../../api/auth";
import { tokenStorage } from "../../lib/storage";
import type { Business, CurrentUser } from "../../types";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CurrentUser | null;
  userEmail: string | null;
  role: CurrentUser["role"] | null;
  businesses: Business[];
  isPlatformUser: boolean;
  isMerchantUser: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(Boolean(tokenStorage.getAccess()));
  const [isLoading, setLoading] = useState(Boolean(tokenStorage.getAccess()));
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      if (!tokenStorage.getAccess()) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (!active) return;
        setUser(currentUser);
        setAuthenticated(true);
        tokenStorage.setEmail(currentUser.email);
      } catch {
        if (!active) return;
        apiLogout();
        setUser(null);
        setAuthenticated(false);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      userEmail: user?.email ?? tokenStorage.getEmail(),
      role: user?.role ?? null,
      businesses: user?.businesses ?? [],
      isPlatformUser: Boolean(user?.is_platform_user),
      isMerchantUser: Boolean(user?.is_merchant_user),
      login: async (email: string, password: string) => {
        await apiLogin({ email, password });
        const currentUser = await getCurrentUser();
        setAuthenticated(true);
        setUser(currentUser);
        tokenStorage.setEmail(currentUser.email);
        return currentUser;
      },
      logout: () => {
        apiLogout();
        setAuthenticated(false);
        setUser(null);
      },
    }),
    [isAuthenticated, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
