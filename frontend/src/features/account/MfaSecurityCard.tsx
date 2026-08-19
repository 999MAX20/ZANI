import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";

import {
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  isMfaPendingResponse,
  regenerateMfaRecoveryCodes,
  revokeMfaSessions,
  startMfaEnrollment,
  type MfaEnrollment,
} from "../../api/auth";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ErrorState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";

type Mode = "setup" | "recovery" | "disable" | "sessions" | null;

export function MfaSecurityCard() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["mfa-status"], queryFn: getMfaStatus });
  const [mode, setMode] = useState<Mode>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const startMutation = useMutation({
    mutationFn: () => startMfaEnrollment(),
    onSuccess: (data) => {
      setEnrollment(data);
      setMode("setup");
    },
  });
  const actionMutation = useMutation({
    mutationFn: async () => {
      if (mode === "setup" && enrollment) {
        const result = await confirmMfaEnrollment(enrollment.challenge_token, code);
        return { recovery_codes: result.recovery_codes || [] };
      }
      if (mode === "recovery") return regenerateMfaRecoveryCodes(code);
      if (mode === "disable") {
        const result = await disableMfa({ password, code, reason });
        if (isMfaPendingResponse(result)) {
          sessionStorage.setItem("zani_mfa_pending", JSON.stringify(result));
          window.location.assign("/mfa");
        }
        return { recovery_codes: [] };
      }
      if (mode === "sessions") {
        await revokeMfaSessions(code);
        return { recovery_codes: [] };
      }
      return { recovery_codes: [] };
    },
    onSuccess: async (data) => {
      setRecoveryCodes(data.recovery_codes || []);
      await queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      if (!data.recovery_codes?.length) closeModal();
    },
  });

  const mfa = statusQuery.data;
  if (!statusQuery.isLoading && mfa && !mfa.available) return null;

  function openMode(nextMode: Mode) {
    setCode("");
    setPassword("");
    setReason("");
    setRecoveryCodes([]);
    setEnrollment(null);
    setMode(nextMode);
  }

  function closeModal() {
    if (actionMutation.isPending) return;
    setMode(null);
    setEnrollment(null);
    setCode("");
    setPassword("");
    setReason("");
    setRecoveryCodes([]);
  }

  return (
    <>
      <Card id="security" className="scroll-mt-24">
        <CardBody>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck size={21} /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("mfa.accountEyebrow")}</p>
                <h2 className="mt-1 text-xl font-black text-midnight">{t("mfa.accountTitle")}</h2>
                <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{t("mfa.accountText")}</p>
              </div>
            </div>
            <span className={mfa?.enabled ? "rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800"}>
              {mfa?.enabled ? t("mfa.enabled") : mfa?.required ? t("mfa.required") : t("mfa.notEnabled")}
            </span>
          </div>

          {statusQuery.error || startMutation.error || actionMutation.error ? (
            <div className="mt-4"><ErrorState message={getApiErrorMessage(statusQuery.error || startMutation.error || actionMutation.error)} /></div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("mfa.method")}</p><p className="mt-1 font-black text-midnight">{mfa?.enabled ? "TOTP" : "—"}</p></div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("mfa.recoveryRemaining")}</p><p className="mt-1 font-black text-midnight">{mfa?.recovery_codes_remaining ?? "—"}</p></div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("mfa.activeSessions")}</p><p className="mt-1 font-black text-midnight">{mfa?.active_sessions ?? "—"}</p></div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!mfa?.enabled ? (
              <Button type="button" isLoading={startMutation.isPending} onClick={() => startMutation.mutate()}><ShieldCheck size={17} />{t("mfa.setup")}</Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={() => openMode("recovery")}><KeyRound size={17} />{t("mfa.newRecoveryCodes")}</Button>
                <Button type="button" variant="secondary" onClick={() => openMode("sessions")}><LogOut size={17} />{t("mfa.revokeSessions")}</Button>
                <Button type="button" variant="secondary" onClick={() => openMode("disable")}><ShieldOff size={17} />{t("mfa.disable")}</Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Modal title={modalTitle(mode, t)} open={Boolean(mode)} onClose={closeModal}>
        <div className="grid gap-4 rounded-3xl bg-white p-4 sm:p-5">
          {recoveryCodes.length ? (
            <>
              <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">{t("mfa.recoveryWarning")}</p>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-4 font-mono text-sm text-white">{recoveryCodes.map((item) => <span key={item}>{item}</span>)}</div>
              <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy size={17} />{t("mfa.copyCodes")}</Button>
              <Button type="button" onClick={closeModal}>{t("common.close")}</Button>
            </>
          ) : (
            <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); actionMutation.mutate(); }}>
              {mode === "setup" && enrollment ? (
                <div className="grid gap-2 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold leading-6 text-slate-600">{t("mfa.addAuthenticatorText")}</p>
                  <code className="break-all rounded-xl bg-white px-3 py-2 text-sm font-black text-midnight">{enrollment.manual_key}</code>
                  <a className="text-sm font-black text-brand-700" href={enrollment.otpauth_uri}>{t("mfa.openAuthenticator")}</a>
                </div>
              ) : null}
              {mode === "disable" ? (
                <>
                  <Input label={t("account.currentPassword")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <Input label={t("mfa.disableReason")} value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} required />
                </>
              ) : null}
              <Input label={t("mfa.codeLabel")} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" placeholder={t("mfa.codePlaceholder")} required={mode !== "sessions" || Boolean(mfa?.enabled)} />
              <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeModal}>{t("common.cancel")}</Button><Button type="submit" isLoading={actionMutation.isPending}>{t("common.save")}</Button></div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}

function modalTitle(mode: Mode, t: (key: string) => string) {
  if (mode === "setup") return t("mfa.setup");
  if (mode === "recovery") return t("mfa.newRecoveryCodes");
  if (mode === "sessions") return t("mfa.revokeSessions");
  if (mode === "disable") return t("mfa.disable");
  return t("mfa.accountTitle");
}
