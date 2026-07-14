import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { confirmPasswordReset } from "../../api/auth";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useI18n } from "../../lib/i18n";

type FormValues = {
  password: string;
  password_confirm: string;
};

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { uid = "", token = "" } = useParams();
  const { t } = useI18n();
  const schema = z.object({
    password: z.string().min(8, t("validation.passwordMin")),
    password_confirm: z.string().min(8, t("passwordReset.repeatPasswordRequired")),
  }).refine((values) => values.password === values.password_confirm, {
    path: ["password_confirm"],
    message: t("passwordReset.passwordMismatch"),
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await confirmPasswordReset({ uid, token, password: values.password });
      setDone(true);
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-soft-mesh px-4 py-8">
      <section className="glass-panel w-full max-w-lg rounded-[2rem] p-6 sm:p-8">
        <div className="mb-7">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
            {done ? <CheckCircle2 size={25} /> : <KeyRound size={25} />}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-midnight">
            {done ? t("passwordReset.doneTitle") : t("passwordReset.newTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {done ? t("passwordReset.doneText") : t("passwordReset.newText")}
          </p>
        </div>

        {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {!done ? (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input label={t("invite.newPassword")} type="password" error={errors.password?.message} {...register("password")} />
            <Input label={t("passwordReset.repeatPassword")} type="password" error={errors.password_confirm?.message} {...register("password_confirm")} />
            <Button variant="ai" className="w-full" type="submit" isLoading={isSubmitting}>
              {t("passwordReset.savePassword")}
            </Button>
          </form>
        ) : null}

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link className="font-bold text-brand-700 hover:text-brand-800" to="/login">
            {t("passwordReset.backToLogin")}
          </Link>
        </p>
      </section>
    </main>
  );
}
