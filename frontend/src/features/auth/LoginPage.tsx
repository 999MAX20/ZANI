import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import type { SocialProvider } from "../../api/auth";
import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "./AuthProvider";
import "./authLoginSerenity.css";

type FormValues = {
  email: string;
  password: string;
};

type LoginLocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

function loadExternalScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithSocial } = useAuth();
  const { t } = useI18n();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID;
  const isGoogleConfigured = Boolean(googleClientId);
  const isAppleConfigured = Boolean(appleClientId);
  const schema = z.object({
    email: z.string().email(t("validation.email")),
    password: z.string().min(1, t("validation.passwordRequired")),
  });
  const [error, setError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const hasSocialLogin = isGoogleConfigured || isAppleConfigured;

  function getPostLoginPath(user: Awaited<ReturnType<typeof login>>) {
    const fallback = user.is_platform_user ? "/platform" : "/app";
    const from = (location.state as LoginLocationState | null)?.from;
    const pathname = from?.pathname;

    if (!pathname) return fallback;
    if (user.is_platform_user && !pathname.startsWith("/platform")) return fallback;
    if (!user.is_platform_user && !pathname.startsWith("/app")) return fallback;

    return `${pathname}${from?.search ?? ""}${from?.hash ?? ""}`;
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      navigate(getPostLoginPath(user), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function completeSocialLogin(provider: SocialProvider, idToken?: string) {
    setError(null);
    setSocialLoading(provider);
    try {
      if (!idToken) {
        throw new Error("Missing social identity token");
      }
      const user = await loginWithSocial(provider, idToken);
      navigate(getPostLoginPath(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message === "Missing social identity token" ? t("auth.socialFailed") : getApiErrorMessage(err));
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleGoogleLogin() {
    if (!googleClientId) {
      setError(t("auth.socialNotConfigured"));
      return;
    }

    setError(null);
    setSocialLoading("google");
    try {
      await loadExternalScript("google-identity-services", "https://accounts.google.com/gsi/client");
      const googleIdentity = window.google?.accounts?.id;
      if (!googleIdentity) {
        throw new Error("Google Identity Services unavailable");
      }
      googleIdentity.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void completeSocialLogin("google", response.credential);
        },
      });
      googleIdentity.prompt((notification) => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.() || notification.isDismissedMoment?.()) {
          setError(t("auth.socialFailed"));
          setSocialLoading(null);
        }
      });
    } catch {
      setError(t("auth.socialFailed"));
      setSocialLoading(null);
    }
  }

  async function handleAppleLogin() {
    if (!appleClientId) {
      setError(t("auth.socialNotConfigured"));
      return;
    }

    setError(null);
    setSocialLoading("apple");
    try {
      await loadExternalScript("apple-signin", "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
      const appleAuth = window.AppleID?.auth;
      if (!appleAuth) {
        throw new Error("Apple Sign In unavailable");
      }
      appleAuth.init({
        clientId: appleClientId,
        scope: "name email",
        redirectURI: `${window.location.origin}/login`,
        usePopup: true,
      });
      const response = await appleAuth.signIn();
      await completeSocialLogin("apple", response?.authorization?.id_token);
    } catch {
      setError(t("auth.socialFailed"));
      setSocialLoading(null);
    }
  }

  return (
    <main className="serenity-login">
      <div className="serenity-login__ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="serenity-login__header">
        <Link className="serenity-login__brand" to="/login">
          <span className="serenity-login__brand-mark" aria-hidden="true">
            <Zap size={20} />
          </span>
          <span className="serenity-login__brand-copy">
            <strong>ZANI</strong>
            <small>{t("auth.brandTagline")}</small>
          </span>
        </Link>

        <div className="serenity-login__header-actions">
          <LanguageSelector className="serenity-login__language" />
        </div>
      </header>

      <div className="serenity-login__layout">
        <section className="serenity-login__story" aria-label={t("auth.heroAria")}>
          <h1>{t("auth.headline")}</h1>
        </section>

        <section className="serenity-login__form-area" aria-label={t("auth.signIn")}>
          <div className="serenity-login__card">
            <div className="serenity-login__card-mark" aria-hidden="true">
              <Zap size={26} />
            </div>
            <h2>{t("auth.signIn")}</h2>
            <p className="serenity-login__card-copy">{t("auth.signInCopy")}</p>

            {error ? (
              <div className="serenity-login__error" role="alert" aria-live="polite">
                {error}
              </div>
            ) : null}

            {hasSocialLogin ? (
              <>
                <div className="serenity-login__social-row">
                  {isGoogleConfigured ? (
                    <Button
                      type="button"
                      className="serenity-login__social"
                      isLoading={socialLoading === "google"}
                      disabled={isSubmitting || Boolean(socialLoading)}
                      onClick={handleGoogleLogin}
                    >
                      <span className="serenity-login__provider-mark" aria-hidden="true">G</span>
                      Google
                    </Button>
                  ) : null}
                  {isAppleConfigured ? (
                    <Button
                      type="button"
                      className="serenity-login__social"
                      isLoading={socialLoading === "apple"}
                      disabled={isSubmitting || Boolean(socialLoading)}
                      onClick={handleAppleLogin}
                    >
                      <span className="serenity-login__provider-mark" aria-hidden="true">A</span>
                      Apple
                    </Button>
                  ) : null}
                </div>

                <div className="serenity-login__divider">
                  <span>{t("auth.emailDivider")}</span>
                </div>
              </>
            ) : null}

            <form className="serenity-login__form" noValidate onSubmit={handleSubmit(onSubmit)}>
              <Input
                label={t("auth.email")}
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label={t("auth.password")}
                type="password"
                autoComplete="current-password"
                placeholder={t("auth.passwordPlaceholder")}
                error={errors.password?.message}
                {...register("password")}
              />
              <div className="serenity-login__links">
                <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>
                <Link to="/signup">{t("auth.registerBusiness")}</Link>
              </div>
              <Button
                className="serenity-login__primary"
                type="submit"
                isLoading={isSubmitting}
                disabled={Boolean(socialLoading)}
              >
                {t("auth.submit")}
                <ArrowRight size={18} />
              </Button>
            </form>

          </div>
        </section>
      </div>
    </main>
  );
}
