import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "./AuthProvider";

const schema = z.object({
  email: z.string().email("Введите email"),
  password: z.string().min(1, "Введите пароль"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@example.com", password: "admin12345" },
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

  return (
    <main className="min-h-screen overflow-hidden bg-soft-mesh px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_480px]">
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
        <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="mb-8">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
              <Zap size={25} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">{t("auth.welcome")}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-midnight">{t("auth.signIn")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t("auth.signInCopy")}</p>
          </div>

          {error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <Input label={t("auth.email")} type="email" error={errors.email?.message} {...register("email")} />
            <Input label={t("auth.password")} type="password" error={errors.password?.message} {...register("password")} />
            <Button variant="ai" className="w-full" type="submit" isLoading={isSubmitting}>
              {t("auth.submit")}
              <ArrowRight size={18} />
            </Button>
          </form>
        </motion.section>
      </div>
    </main>
  );
}
