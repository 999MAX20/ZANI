import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useI18n } from "../../lib/i18n";
import { AuthExperienceShell } from "./AuthExperienceShell";
import { useAuth } from "./AuthProvider";
import "./authExperience.css";
import "./authExperienceMobileFix.css";

type FormValues = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
  business_name: string;
  business_type: string;
  city?: string;
};

export function SignupPage() {
  const navigate = useNavigate();
  const { signupOwner } = useAuth();
  const { t } = useI18n();
  const signupEmail = (() => {
    try {
      return window.sessionStorage.getItem("zani_signup_email") || "";
    } catch {
      return "";
    }
  })();
  const schema = z.object({
    full_name: z.string().min(2, t("validation.name")),
    email: z.string().email(t("validation.email")),
    phone: z.string().min(5, t("validation.phone")),
    password: z.string().min(8, t("validation.passwordMin")),
    password_confirm: z.string().min(1, t("passwordReset.repeatPasswordRequired")),
    business_name: z.string().min(2, t("validation.businessName")),
    business_type: z.string().min(1),
    city: z.string().optional(),
  }).refine((values) => values.password === values.password_confirm, {
    message: t("passwordReset.passwordMismatch"),
    path: ["password_confirm"],
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
  const [step, setStep] = useState<1 | 2>(1);
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { business_type: "beauty", email: signupEmail },
  });
  const passwordValue = watch("password") || "";
  const passwordChecks = [
    { label: t("signup.passwordMinCheck"), active: passwordValue.length >= 8 },
    { label: t("signup.passwordLettersNumbersCheck"), active: /[A-Za-zА-Яа-я]/.test(passwordValue) && /\d/.test(passwordValue) },
    { label: t("signup.passwordNoSpacesCheck"), active: passwordValue.length > 0 && !/\s/.test(passwordValue) },
  ];

  async function continueToBusiness() {
    const accountValid = await trigger(["full_name", "phone", "email", "password", "password_confirm"]);
    if (accountValid) setStep(2);
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await signupOwner({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        business_name: values.business_name,
        business_type: values.business_type,
        city: values.city,
      });
      navigate("/app");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <AuthExperienceShell mode="signup">
      <section className="zani-auth-card">
        <div className="zani-auth-card-icon">
          <Building2 size={31} />
        </div>
        <h2>{t("signup.createCompanyTitle")}</h2>
        <p>{t("signup.createCompanyText")}</p>

        {error ? <div className="zani-auth-error">{error}</div> : null}

        <div className="zani-signup-progress" aria-label={t("signup.progressAria")}>
          <span className="is-active"><i>1</i>{t("signup.accountStep")}</span>
          <span className={step === 2 ? "is-active" : undefined}><i>2</i>{t("signup.businessStep")}</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 1 ? (
            <>
              <div className="zani-auth-field-grid">
                <Input label={t("signup.yourName")} placeholder={t("signup.namePlaceholder")} error={errors.full_name?.message} {...register("full_name")} />
                <Input label={t("signup.phone")} placeholder="+7 777 000 00 00" error={errors.phone?.message} {...register("phone")} />
              </div>
              <Input label={t("auth.email")} type="email" placeholder={t("auth.emailPlaceholder")} error={errors.email?.message} {...register("email")} />
              <div className="zani-auth-field-grid">
                <Input label={t("auth.password")} type="password" placeholder={t("signup.passwordPlaceholder")} error={errors.password?.message} {...register("password")} />
                <Input label={t("signup.passwordConfirm")} type="password" placeholder={t("passwordReset.repeatPassword")} error={errors.password_confirm?.message} {...register("password_confirm")} />
              </div>
              <div className="zani-auth-password-checks">
                {passwordChecks.map((check) => (
                  <span key={check.label} data-active={check.active}>
                    <CheckCircle2 size={14} />
                    {check.label}
                  </span>
                ))}
              </div>
              <Button className="zani-auth-primary" type="button" onClick={continueToBusiness}>
                {t("signup.continue")}
                <ArrowRight size={18} />
              </Button>
            </>
          ) : (
            <>
              <Input label={t("signup.businessName")} placeholder={t("signup.businessNamePlaceholder")} error={errors.business_name?.message} {...register("business_name")} />
              <div className="zani-auth-field-grid">
                <Select label={t("signup.businessType")} options={businessTypeOptions} error={errors.business_type?.message} {...register("business_type")} />
                <Input label={t("signup.cityOptional")} placeholder={t("signup.cityPlaceholder")} error={errors.city?.message} {...register("city")} />
              </div>
              <p className="zani-auth-helper">{t("signup.afterSignInHelper")}</p>
              <div className="zani-signup-actions">
                <button className="zani-auth-step-back" type="button" onClick={() => setStep(1)}><ArrowLeft size={17} />{t("signup.back")}</button>
                <Button className="zani-auth-primary" type="submit" isLoading={isSubmitting}>
                  {t("signup.freeSubmit")}
                  <ArrowRight size={18} />
                </Button>
              </div>
            </>
          )}
        </form>

        {step === 2 ? <p className="zani-auth-terms">{t("signup.terms")}</p> : null}
        <p className="zani-auth-links">
          <span>{t("signup.hasAccess")}</span>
          <Link to="/login">{t("auth.submit")}</Link>
        </p>
      </section>
    </AuthExperienceShell>
  );
}
