import { ArrowRight, Copy, KeyRound, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  confirmMfaEnrollment,
  isMfaPendingResponse,
  startMfaEnrollment,
  verifyMfaLogin,
  type MfaEnrollment,
  type MfaPendingResponse,
} from "../../api/auth";
import { getApiErrorMessage } from "../../api/client";
import { LanguageSelector } from "../../components/layout/LanguageSelector";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState } from "../../components/ui/StateViews";
import { StatusNotice } from "../../components/ui/StatusNotice";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "./AuthProvider";
import "./authLoginSerenity.css";

function readPending(): MfaPendingResponse | null {
  try {
    const value = JSON.parse(sessionStorage.getItem("zani_mfa_pending") || "null");
    return isMfaPendingResponse(value) ? value : null;
  } catch {
    return null;
  }
}

export function MfaPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { completeMfaSession } = useAuth();
  const pending = useMemo(readPending, []);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pending || pending.code !== "mfa_enrollment_required") return;
    let active = true;
    setLoading(true);
    startMfaEnrollment(pending.challenge_token)
      .then((result) => {
        if (active) setEnrollment(result);
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pending]);

  async function finishSession() {
    const user = await completeMfaSession();
    sessionStorage.removeItem("zani_mfa_pending");
    navigate(user.is_platform_user ? "/platform" : "/app", { replace: true });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    setError(null);
    setLoading(true);
    try {
      if (pending.code === "mfa_enrollment_required") {
        const result = await confirmMfaEnrollment(pending.challenge_token, code);
        setRecoveryCodes(result.recovery_codes || []);
        setCode("");
      } else {
        await verifyMfaLogin(pending.challenge_token, code);
        await finishSession();
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!pending) {
    return (
      <main className="serenity-login">
        <div className="serenity-login__layout">
          <section className="serenity-login__form-area">
            <div className="serenity-login__card">
              <h2>{t("mfa.sessionExpiredTitle")}</h2>
              <p className="serenity-login__card-copy">{t("mfa.sessionExpiredText")}</p>
              <Link className="serenity-login__signup-link" to="/login">{t("mfa.backToLogin")}</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="serenity-login">
      <div className="serenity-login__ambient" aria-hidden="true"><span /><span /><span /></div>
      <header className="serenity-login__header">
        <Link className="serenity-login__brand" to="/login">
          <span className="serenity-login__brand-mark" aria-hidden="true"><Zap size={20} /></span>
          <span className="serenity-login__brand-copy"><strong>ZANI</strong><small>{t("auth.brandTagline")}</small></span>
        </Link>
        <LanguageSelector className="serenity-login__language" />
      </header>

      <div className="serenity-login__layout">
        <section className="serenity-login__story" aria-label={t("mfa.title")}>
          <h1>{t("mfa.hero")}</h1>
        </section>
        <section className="serenity-login__form-area">
          <div className="serenity-login__card">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck size={22} /></span>
              <div><h2>{t("mfa.title")}</h2><p className="serenity-login__card-copy">{t("mfa.text")}</p></div>
            </div>

            {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}

            {recoveryCodes.length ? (
              <div className="grid gap-4">
                <StatusNotice tone="warning" title={t("mfa.recoveryWarning")} />
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-4 font-mono text-sm text-white">
                  {recoveryCodes.map((recoveryCode) => <span key={recoveryCode}>{recoveryCode}</span>)}
                </div>
                <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}>
                  <Copy size={17} />{t("mfa.copyCodes")}
                </Button>
                <Button type="button" onClick={() => void finishSession()}>{t("mfa.continue")}<ArrowRight size={18} /></Button>
              </div>
            ) : (
              <form className="serenity-login__form" onSubmit={submit}>
                {pending.code === "mfa_enrollment_required" ? (
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 font-black text-midnight"><Smartphone size={18} />{t("mfa.addAuthenticator")}</div>
                    <p className="text-sm font-semibold leading-6 text-slate-600">{t("mfa.addAuthenticatorText")}</p>
                    {enrollment ? (
                      <>
                        <code className="break-all rounded-xl bg-white px-3 py-2 text-sm font-black text-midnight">{enrollment.manual_key}</code>
                        <a className="text-sm font-black text-brand-700" href={enrollment.otpauth_uri}>{t("mfa.openAuthenticator")}</a>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <Input
                  label={t("mfa.codeLabel")}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder={t("mfa.codePlaceholder")}
                  leftIcon={<KeyRound size={18} />}
                  required
                />
                <p className="text-xs font-semibold leading-5 text-slate-500">{t("mfa.recoveryHint")}</p>
                <Button type="submit" isLoading={loading} disabled={pending.code === "mfa_enrollment_required" && !enrollment}>
                  {pending.code === "mfa_enrollment_required" ? t("mfa.enable") : t("mfa.verify")}
                  <ArrowRight size={18} />
                </Button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
