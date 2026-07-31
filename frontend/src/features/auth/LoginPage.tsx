import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
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

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      navigate(user.is_platform_user ? "/platform" : "/app");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function completeSocialLogin(provider: SocialProvider, idToken?: string) {
    if (!idToken) {
      setError(t("auth.socialFailed"));
      return;
    }

    setError(null);
    setSocialLoading(provider);
    try {
      const user = await loginWithSocial(provider, idToken);
      navigate(user.is_platform_user ? "/platform" : "/app");
    } catch (err) {
      setError(getApiErrorMessage(err));
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
      window.google?.accounts?.id?.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void completeSocialLogin("google", response.credential);
        },
      });
      window.google?.accounts?.id?.prompt((notification) => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
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
      window.AppleID?.auth?.init({
        clientId: appleClientId,
        scope: "name email",
        redirectURI: `${window.location.origin}/login`,
        usePopup: true,
      });
      const response = await window.AppleID?.auth?.signIn();
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
        <Link className="serenity-login__brand" to="/">
          <span className="serenity-login__brand-mark" aria-hidden="true">
            <Zap size={20} />
          </span>
          <span className="serenity-login__brand-copy">
            <strong>ZANI</strong>
            <small>{t("auth.brandTagline")}</small>
          </span>
        </Link>

        <div className="serenity-login__header-actions">
          <span>{t("auth.noAccount")}</span>
          <Link className="serenity-login__signup-link" to="/signup">
            {t("auth.create")}
          </Link>
          <LanguageSelector className="serenity-login__language" />
        </div>
      </header>

      <div className="serenity-login__layout">
        <section className="serenity-login__story" aria-label={t("auth.heroAria")}>
          <Link className="serenity-login__back" to="/">
            <ArrowLeft size={18} />
            {t("auth.backToSite")}
          </Link>

          <div className="serenity-login__badge">
            <Sparkles size={16} />
            {t("auth.badge")}
          </div>
          <h1>{t("auth.headline")}</h1>
          <p className="serenity-login__lead">{t("auth.copy")}</p>

          <div className="serenity-login__benefits">
            <article>
              <span aria-hidden="true"><MessageCircleMore size={19} /></span>
              <div>
                <h2>{t("auth.fastFollowup")}</h2>
                <p>{t("auth.fastFollowupText")}</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true"><CalendarDays size={19} /></span>
              <div>
                <h2>{t("auth.smartBooking")}</h2>
                <p>{t("auth.smartBookingText")}</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true"><UsersRound size={19} /></span>
              <div>
                <h2>{t("auth.ownerControl")}</h2>
                <p>{t("auth.ownerControlText")}</p>
              </div>
            </article>
          </div>

          <div className="serenity-login__visual" aria-hidden="true">
            <div className="serenity-login__sun">
              <span />
              <Zap size={32} />
            </div>
            <div className="serenity-login__orbit serenity-login__orbit--one" />
            <div className="serenity-login__orbit serenity-login__orbit--two" />
            <div className="serenity-login__signal serenity-login__signal--clients">
              <UsersRound size={17} />
              <span>{t("nav.clients")}</span>
            </div>
            <div className="serenity-login__signal serenity-login__signal--messages">
              <MessageCircleMore size={17} />
              <span>{t("nav.conversations")}</span>
            </div>
            <div className="serenity-login__signal serenity-login__signal--calendar">
              <CalendarDays size={17} />
              <span>{t("nav.calendar")}</span>
            </div>
          </div>
        </section>

        <section className="serenity-login__form-area" aria-label={t("auth.signIn")}>
          <div className="serenity-login__card">
            <div className="serenity-login__card-mark" aria-hidden="true">
              <Zap size={26} />
            </div>
            <span className="serenity-login__eyebrow">{t("auth.welcome")}</span>
            <h2>{t("auth.signIn")}</h2>
            <p className="serenity-login__card-copy">{t("auth.signInCopy")}</p>

            {error ? (
              <div className="serenity-login__error" role="alert" aria-live="polite">
                {error}
              </div>
            ) : null}

            <div className="serenity-login__social-row">
              <Button
                type="button"
                className="serenity-login__social"
                isLoading={socialLoading === "google"}
                disabled={!isGoogleConfigured || isSubmitting || Boolean(socialLoading)}
                title={!isGoogleConfigured ? t("auth.socialNotConfigured") : undefined}
                onClick={handleGoogleLogin}
              >
                <span className="serenity-login__provider-mark" aria-hidden="true">G</span>
                {isGoogleConfigured ? "Google" : t("auth.googleSoon")}
              </Button>
              <Button
                type="button"
                className="serenity-login__social"
                isLoading={socialLoading === "apple"}
                disabled={!isAppleConfigured || isSubmitting || Boolean(socialLoading)}
                title={!isAppleConfigured ? t("auth.socialNotConfigured") : undefined}
                onClick={handleAppleLogin}
              >
                <span className="serenity-login__provider-mark" aria-hidden="true">A</span>
                {isAppleConfigured ? "Apple" : t("auth.appleSoon")}
              </Button>
            </div>

            <div className="serenity-login__divider">
              <span>{t("auth.emailDivider")}</span>
            </div>

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

            <div className="serenity-login__trust">
              <ShieldCheck size={17} />
              <span>{t("auth.trustSecurity")}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
