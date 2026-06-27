import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Zap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useI18n } from "../../lib/i18n";
import { AuthExperienceShell } from "./AuthExperienceShell";
import { useAuth } from "./AuthProvider";
import type { SocialProvider } from "../../api/auth";
import "./authExperience.css";
import "./authExperienceMobileFix.css";

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
    <AuthExperienceShell mode="login">
      <section className="zani-auth-card">
        <div className="zani-auth-card-icon">
          <Zap size={30} />
        </div>
        <h2>{t("auth.signIn")}</h2>
        <p>{t("auth.signInAppCopy")}</p>

        {error ? <div className="zani-auth-error">{error}</div> : null}

        <div className="zani-auth-secondary-row">
          <Button
            type="button"
            className="zani-auth-social"
            isLoading={socialLoading === "google"}
            disabled={!isGoogleConfigured || isSubmitting || Boolean(socialLoading)}
            title={!isGoogleConfigured ? t("auth.socialNotConfigured") : undefined}
            onClick={handleGoogleLogin}
          >
            <mark>G</mark>
            {isGoogleConfigured ? "Google" : t("auth.googleSoon")}
          </Button>
          <Button
            type="button"
            className="zani-auth-social"
            isLoading={socialLoading === "apple"}
            disabled={!isAppleConfigured || isSubmitting || Boolean(socialLoading)}
            title={!isAppleConfigured ? t("auth.socialNotConfigured") : undefined}
            onClick={handleAppleLogin}
          >
            <mark></mark>
            {isAppleConfigured ? "Apple" : t("auth.appleSoon")}
          </Button>
        </div>

        <div className="zani-auth-divider">{t("auth.emailDivider")}</div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Input label={t("auth.email")} type="email" placeholder={t("auth.emailPlaceholder")} error={errors.email?.message} {...register("email")} />
          <Input label={t("auth.password")} type="password" placeholder={t("auth.passwordPlaceholder")} error={errors.password?.message} {...register("password")} />
          <div className="zani-auth-links">
            <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>
            <Link to="/signup">{t("auth.registerBusiness")}</Link>
          </div>
          <Button className="zani-auth-primary" type="submit" isLoading={isSubmitting} disabled={Boolean(socialLoading)}>
            {t("auth.submit")}
            <ArrowRight size={18} />
          </Button>
        </form>
      </section>
    </AuthExperienceShell>
  );
}
