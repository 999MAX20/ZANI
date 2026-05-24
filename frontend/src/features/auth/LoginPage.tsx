import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "./AuthProvider";
import type { SocialProvider } from "../../api/auth";

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
      navigate(user.is_platform_user ? "/platform" : "/dashboard");
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
      navigate(user.is_platform_user ? "/platform" : "/dashboard");
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
    <main className="min-h-screen overflow-hidden bg-soft-mesh px-3 py-4 sm:px-4 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-center gap-6 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.1fr_480px] lg:gap-8">
        <section className="relative hidden lg:block">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-bold text-ai-700 shadow-soft backdrop-blur-xl">
            <Sparkles size={16} />
            {t("auth.badge")}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="max-w-3xl text-6xl font-semibold leading-[1.02] tracking-tight text-midnight">
            {t("auth.headline")}
          </motion.h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {t("auth.copy")}
          </p>
          <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-3">
            {[
              [t("auth.fastFollowup"), t("auth.fastFollowupText")],
              [t("auth.smartBooking"), t("auth.smartBookingText")],
              [t("auth.ownerControl"), t("auth.ownerControlText")],
            ].map(([title, desc]) => (
              <div key={title} className="glass-panel rounded-3xl p-5">
                <CheckCircle2 className="text-emerald-500" size={22} />
                <p className="mt-4 font-semibold text-midnight">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </section>
        <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel rounded-[1.75rem] p-5 sm:rounded-[2rem] sm:p-8">
          <div className="mb-5 sm:mb-8">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow sm:mb-5 sm:h-14 sm:w-14 sm:rounded-3xl">
              <Zap size={22} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">{t("auth.welcome")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-midnight sm:text-3xl">{t("auth.signIn")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t("auth.signInCopy")}</p>
          </div>

          {error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 w-full justify-center"
              isLoading={socialLoading === "google"}
              disabled={!isGoogleConfigured || isSubmitting || Boolean(socialLoading)}
              title={!isGoogleConfigured ? t("auth.socialNotConfigured") : undefined}
              onClick={handleGoogleLogin}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-black text-brand-700 shadow-sm">G</span>
              {isGoogleConfigured ? t("auth.google") : t("auth.googleSoon")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 w-full justify-center"
              isLoading={socialLoading === "apple"}
              disabled={!isAppleConfigured || isSubmitting || Boolean(socialLoading)}
              title={!isAppleConfigured ? t("auth.socialNotConfigured") : undefined}
              onClick={handleAppleLogin}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-midnight text-sm font-black text-white shadow-sm">A</span>
              {isAppleConfigured ? t("auth.apple") : t("auth.appleSoon")}
            </Button>
          </div>

          <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 sm:my-6">
            <span className="h-px flex-1 bg-slate-200" />
            {t("auth.socialDivider")}
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <Input label={t("auth.email")} type="email" error={errors.email?.message} {...register("email")} />
            <Input label={t("auth.password")} type="password" error={errors.password?.message} {...register("password")} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/forgot-password">
                {t("auth.forgotPassword")}
              </Link>
              <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/signup">
                {t("auth.registerBusiness")}
              </Link>
            </div>
            <Button variant="ai" className="w-full" type="submit" isLoading={isSubmitting} disabled={Boolean(socialLoading)}>
              {t("auth.submit")}
              <ArrowRight size={18} />
            </Button>
          </form>
        </motion.section>
      </div>
    </main>
  );
}
