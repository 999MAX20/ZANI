import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { requestPasswordReset } from "../../api/auth";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useI18n } from "../../lib/i18n";

type FormValues = {
  email: string;
  delivery_channel: "email" | "whatsapp" | "telegram" | "manual";
};

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const schema = z.object({
    email: z.string().email(t("validation.email")),
    delivery_channel: z.enum(["email", "whatsapp", "telegram", "manual"]),
  });
  const [error, setError] = useState<string | null>(null);
  const [resetPath, setResetPath] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { delivery_channel: "email" },
  });
  const email = watch("email");
  const resetUrl = useMemo(() => (resetPath ? `${window.location.origin}${resetPath}` : ""), [resetPath]);

  async function onSubmit(values: FormValues) {
    setError(null);
    setResetPath(null);
    try {
      const response = await requestPasswordReset(values);
      setResetPath(response.reset_path ?? null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  function shareUrl() {
    const text = encodeURIComponent(t("passwordReset.shareBody", { url: resetUrl }));
    return `mailto:${encodeURIComponent(email || "")}?subject=Zani password reset&body=${text}`;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-soft-mesh px-4 py-8">
      <section className="glass-panel w-full max-w-lg rounded-[2rem] p-6 sm:p-8">
        <div className="mb-7">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
            <KeyRound size={25} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-midnight">{t("passwordReset.requestTitle")}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t("passwordReset.requestText")}
          </p>
        </div>

        {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
          <Select
            label={t("passwordReset.deliveryChannel")}
            options={[
              { value: "email", label: "Email" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "telegram", label: "Telegram" },
              { value: "manual", label: t("passwordReset.manualChannel") },
            ]}
            error={errors.delivery_channel?.message}
            {...register("delivery_channel")}
          />
          <Button variant="ai" className="w-full" type="submit" isLoading={isSubmitting}>
            {t("passwordReset.getLink")}
            <Send size={18} />
          </Button>
        </form>

        {resetUrl ? (
          <div className="mt-5 rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
            <p className="text-sm font-bold text-midnight">{t("passwordReset.testLinkReady")}</p>
            <p className="mt-2 break-all text-sm text-slate-600">{resetUrl}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(resetUrl)}>
                <Copy size={16} />
                {t("common.copy")}
              </Button>
              <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm" href={shareUrl()}>
                <Send size={16} />
                {t("passwordReset.sendEmail")}
              </a>
            </div>
          </div>
        ) : null}

        <p className="mt-5 text-center text-sm text-slate-500">
          {t("passwordReset.remembered")}{" "}
          <Link className="font-bold text-brand-700 hover:text-brand-800" to="/login">
            {t("auth.submit")}
          </Link>
        </p>
      </section>
    </main>
  );
}
