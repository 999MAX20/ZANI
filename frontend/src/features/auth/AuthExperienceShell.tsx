import { ArrowLeft, Cloud, Gift, MessageSquareText, ShieldCheck, ShoppingCart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { useI18n } from "../../lib/i18n";

type AuthExperienceShellProps = {
  children: React.ReactNode;
  mode: "signup" | "login";
};

const features = [
  {
    icon: Gift,
    titleKey: "auth.featureCrmTitle",
    textKey: "auth.featureCrmText",
  },
  {
    icon: Sparkles,
    titleKey: "auth.featureAiTitle",
    textKey: "auth.featureAiText",
  },
  {
    icon: MessageSquareText,
    titleKey: "auth.featureBotsTitle",
    textKey: "auth.featureBotsText",
  },
  {
    icon: ShoppingCart,
    titleKey: "auth.featureIntegrationsTitle",
    textKey: "auth.featureIntegrationsText",
  },
];

export function AuthExperienceShell({ children, mode }: AuthExperienceShellProps) {
  const { t } = useI18n();
  const isSignup = mode === "signup";

  return (
    <main className={`zani-auth-experience ${isSignup ? "is-signup" : "is-login"}`}>
      <div className="zani-auth-noise" />
      <header className="zani-auth-topbar">
        <Link className="zani-auth-back" to="/">
          <ArrowLeft size={18} />
          {t("auth.backToSite")}
        </Link>
        <Link className="zani-auth-brand" to="/">
          <span>ZANI</span>
          <i />
          <em>{t("auth.brandTagline")}</em>
        </Link>
        <div className="zani-auth-switch">
          <span>{isSignup ? t("auth.alreadyHaveAccount") : t("auth.noAccount")}</span>
          <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? t("auth.submit") : t("auth.create")}</Link>
          <LanguageSelector className="zani-auth-language" />
        </div>
      </header>

      <div className="zani-auth-grid">
        <section className="zani-auth-hero" aria-label={t("auth.heroAria")}>
          <h1>
            {isSignup ? (
              <>{t("auth.signupHeroPrefix")} <strong>{t("auth.signupHeroTime")}</strong></>
            ) : (
              <>{t("auth.loginHeroPrefix")} <strong>{t("auth.loginHeroTime")}</strong></>
            )}
          </h1>
          <p className="zani-auth-lead">
            {isSignup ? t("auth.signupHeroText") : t("auth.loginHeroText")}
          </p>

          <div className="zani-auth-feature-list">
            {features.map((feature) => (
              <article key={feature.titleKey} className="zani-auth-feature">
                <span>
                  <feature.icon size={22} />
                </span>
                <div>
                  <h2>{t(feature.titleKey)}</h2>
                  <p>{t(feature.textKey)}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="zani-auth-proof">
            <div className="zani-auth-avatars" aria-hidden="true">
              {["A", "M", "D", "S"].map((item) => (
                <span key={item}>{item}</span>
              ))}
              <b>+2K</b>
            </div>
            <p>{t("auth.proofText")}</p>
          </div>

          <div className="zani-auth-trust">
            <span>
              <ShieldCheck size={18} />
              {t("auth.trustSecurity")}
            </span>
            <span>
              <Cloud size={18} />
              {t("auth.trustServers")}
            </span>
          </div>

        </section>

        <section className="zani-auth-card-wrap">{children}</section>
      </div>
    </main>
  );
}
