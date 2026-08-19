import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AUTH_EXPIRED_EVENT } from "../../api/client";
import {
  getCurrentUser,
  isMfaPendingResponse,
  login as apiLogin,
  logout as apiLogout,
  restoreSession,
  signupOwner as apiSignupOwner,
  socialLogin as apiSocialLogin,
  type OwnerSignupPayload,
  type SocialProvider,
  type MfaPendingResponse,
} from "../../api/auth";
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
  refreshUser: () => Promise<CurrentUser | null>;
  login: (email: string, password: string) => Promise<CurrentUser | MfaPendingResponse>;
  signupOwner: (payload: OwnerSignupPayload) => Promise<CurrentUser | MfaPendingResponse>;
  loginWithSocial: (provider: SocialProvider, idToken: string) => Promise<CurrentUser | MfaPendingResponse>;
  completeMfaSession: () => Promise<CurrentUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const mountedRef = useRef(false);
  const sessionRestoreStartedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    function handleAuthExpired() {
      if (!mountedRef.current) return;
      setUser(null);
      setAuthenticated(false);
      setLoading(false);
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (sessionRestoreStartedRef.current) return;
    sessionRestoreStartedRef.current = true;

    async function loadUser() {
      if (!tokenStorage.getAccess()) {
        try {
          await restoreSession();
        } catch {
          if (mountedRef.current) setLoading(false);
          return;
        }
      }

      try {
        const currentUser = await getCurrentUser();
        if (!mountedRef.current) return;
        setUser(currentUser);
        setAuthenticated(true);
        tokenStorage.setEmail(currentUser.email);
      } catch {
        if (!mountedRef.current) return;
        apiLogout();
        setUser(null);
        setAuthenticated(false);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    loadUser();
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
      refreshUser: async () => {
        if (!tokenStorage.getAccess()) {
          try {
            await restoreSession();
          } catch {
            return null;
          }
        }
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        setAuthenticated(true);
        tokenStorage.setEmail(currentUser.email);
        return currentUser;
      },
      login: async (email: string, password: string) => {
        const response = await apiLogin({ email, password });
        if (isMfaPendingResponse(response)) return response;
        const currentUser = await getCurrentUser();
        setAuthenticated(true);
        setUser(currentUser);
        tokenStorage.setEmail(currentUser.email);
        return currentUser;
      },
      signupOwner: async (payload: OwnerSignupPayload) => {
        const response = await apiSignupOwner(payload);
        if (isMfaPendingResponse(response)) return response;
        const currentUser = await getCurrentUser();
        setAuthenticated(true);
        setUser(currentUser);
        tokenStorage.setEmail(currentUser.email);
        return currentUser;
      },
      loginWithSocial: async (provider: SocialProvider, idToken: string) => {
        const response = await apiSocialLogin({ provider, idToken });
        if (isMfaPendingResponse(response)) return response;
        const currentUser = await getCurrentUser();
        setAuthenticated(true);
        setUser(currentUser);
        tokenStorage.setEmail(currentUser.email);
        return currentUser;
      },
      completeMfaSession: async () => {
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
