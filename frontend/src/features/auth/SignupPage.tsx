import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { signupOwner } from "../../api/auth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useI18n } from "../../lib/i18n";

type FormValues = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  business_name: string;
  business_type: string;
  city?: string;
};

export function SignupPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const schema = z.object({
    full_name: z.string().min(2, t("validation.name")),
    email: z.string().email(t("validation.email")),
    phone: z.string().min(5, t("validation.phone")),
    password: z.string().min(8, t("validation.passwordMin")),
    business_name: z.string().min(2, t("validation.businessName")),
    business_type: z.string().min(1),
    city: z.string().optional(),
  });
  const businessTypeOptions = [
    { value: "beauty", label: t("businessType.beauty") },
    { value: "medical", label: t("businessType.medical") },
    { value: "dentistry", label: t("businessType.dentistry") },
    { value: "education", label: t("businessType.education") },
    { value: "autoservice", label: t("businessType.autoservice") },
    { value: "sauna", label: t("businessType.sauna") },
    { value: "other", label: t("businessType.other") },
  ];
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { business_type: "beauty" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await signupOwner(values);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <main className="min-h-screen bg-soft-mesh px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_520px]">
        <section className="hidden lg:block">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-bold text-ai-700 shadow-soft">
            <Sparkles size={16} />
            {t("signup.badge")}
          </div>
          <h1 className="max-w-3xl text-6xl font-semibold leading-[1.03] tracking-tight text-midnight">
            {t("signup.headline")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {t("signup.copy")}
          </p>
        </section>

        <section className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="mb-7">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-ai-gradient text-white shadow-glow">
              <Building2 size={25} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">{t("signup.eyebrow")}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-midnight">{t("signup.title")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {t("signup.text")}
            </p>
          </div>

          {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("signup.yourName")} error={errors.full_name?.message} {...register("full_name")} />
              <Input label={t("signup.phone")} error={errors.phone?.message} {...register("phone")} />
            </div>
            <Input label={t("signup.email")} type="email" error={errors.email?.message} {...register("email")} />
            <Input label={t("auth.password")} type="password" error={errors.password?.message} {...register("password")} />
            <Input label={t("signup.businessName")} error={errors.business_name?.message} {...register("business_name")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label={t("signup.businessType")} options={businessTypeOptions} error={errors.business_type?.message} {...register("business_type")} />
              <Input label={t("signup.city")} error={errors.city?.message} {...register("city")} />
            </div>
            <Button variant="ai" className="w-full" type="submit" isLoading={isSubmitting}>
              {t("signup.submit")}
              <ArrowRight size={18} />
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            {t("signup.hasAccess")}{" "}
            <Link className="font-bold text-brand-700 hover:text-brand-800" to="/login">
              {t("auth.submit")}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
