import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, BriefcaseBusiness, UsersRound, Zap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

import { getApiErrorMessage } from "../../api/client";
import { isMfaPendingResponse } from "../../api/auth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "./AuthProvider";
import { PasswordVisibilityToggle } from "./PasswordVisibilityToggle";
import "./authLoginSerenity.css";

type FormValues = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
  business_name: string;
  business_type: string;
};

export function SignupPage() {
  const navigate = useNavigate();
  const { signupOwner } = useAuth();
  const { t } = useI18n();
  const schema = z.object({
    full_name: z.string().min(2, t("validation.name")),
    email: z.string().email(t("validation.email")),
    phone: z.string().min(5, t("validation.phone")),
    password: z.string()
      .min(8, t("signup.passwordMinCheck"))
      .regex(/^(?=.*\p{L})(?=.*\d).+$/u, t("signup.passwordLettersNumbersCheck"))
      .refine((value) => !/\s/.test(value), t("signup.passwordNoSpacesCheck")),
    password_confirm: z.string().min(1, t("passwordReset.repeatPasswordRequired")),
    business_name: z.string().min(2, t("validation.businessName")),
    business_type: z.string().min(1),
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
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isPasswordConfirmVisible, setPasswordConfirmVisible] = useState(false);
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
      const response = await signupOwner({
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        business_name: values.business_name,
        business_type: values.business_type,
      });
      if (isMfaPendingResponse(response)) {
        sessionStorage.setItem("zani_mfa_pending", JSON.stringify(response));
        navigate("/mfa", { replace: true });
        return;
      }
      navigate("/app");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <main className="serenity-login serenity-login--signup">
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
          <span>{t("auth.alreadyHaveAccount")}</span>
          <Link className="serenity-login__signup-link" to="/login">
            {t("auth.submit")}
          </Link>
          <LanguageSelector className="serenity-login__language" />
        </div>
      </header>

      <div className="serenity-login__layout">
        <section className="serenity-login__story" aria-label={t("auth.heroAria")}>
          <h1>{t("signup.headline")}</h1>

          <div className="serenity-login__benefits">
            <article>
              <span aria-hidden="true"><BriefcaseBusiness size={19} /></span>
              <div>
                <h2>{t("signup.businessSection")}</h2>
                <p>{t("signup.createCompanyText")}</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true"><UsersRound size={19} /></span>
              <div>
                <h2>{t("signup.accountSection")}</h2>
                <p>{t("signup.afterSignInHelper")}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="serenity-login__form-area" aria-label={t("auth.create")}>
          <div className="serenity-login__card serenity-login__card--signup">
            <h2>{t("signup.createCompanyTitle")}</h2>
            <p className="serenity-login__card-copy">{t("signup.createCompanyText")}</p>

            {error ? (
              <div className="serenity-login__error" role="alert" aria-live="polite">
                {error}
              </div>
            ) : null}

            <form className="serenity-login__form serenity-login__form--signup" noValidate onSubmit={handleSubmit(onSubmit)}>
              <div className="serenity-login__field-grid">
                <Input label={t("signup.yourName")} autoComplete="name" placeholder={t("signup.namePlaceholder")} error={errors.full_name?.message} {...register("full_name")} />
                <Input label={t("signup.phone")} autoComplete="tel" placeholder="+7 777 000 00 00" error={errors.phone?.message} {...register("phone")} />
              </div>
              <div className="serenity-login__field-grid">
                <Input label={t("auth.email")} type="email" autoComplete="email" placeholder={t("auth.emailPlaceholder")} error={errors.email?.message} {...register("email")} />
                <Input label={t("signup.businessName")} autoComplete="organization" placeholder={t("signup.businessNamePlaceholder")} error={errors.business_name?.message} {...register("business_name")} />
              </div>
              <div className="serenity-login__field-grid">
                <Input
                  label={t("auth.password")}
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("signup.passwordPlaceholder")}
                  error={errors.password?.message}
                  rightIcon={
                    <PasswordVisibilityToggle
                      visible={isPasswordVisible}
                      onToggle={() => setPasswordVisible((visible) => !visible)}
                    />
                  }
                  {...register("password")}
                />
                <Input
                  label={t("signup.passwordConfirm")}
                  type={isPasswordConfirmVisible ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("passwordReset.repeatPassword")}
                  error={errors.password_confirm?.message}
                  rightIcon={
                    <PasswordVisibilityToggle
                      visible={isPasswordConfirmVisible}
                      onToggle={() => setPasswordConfirmVisible((visible) => !visible)}
                    />
                  }
                  {...register("password_confirm")}
                />
              </div>
              <Select label={t("signup.businessType")} placement="top" options={businessTypeOptions} error={errors.business_type?.message} {...register("business_type")} />
              <Button className="serenity-login__primary" type="submit" isLoading={isSubmitting}>
                {t("signup.freeSubmit")}
                <ArrowRight size={18} />
              </Button>
            </form>

            <p className="serenity-login__terms">{t("signup.terms")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
