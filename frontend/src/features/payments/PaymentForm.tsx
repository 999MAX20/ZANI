import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { paymentsApi, type Payment, type PaymentDraft, type PaymentMethod, type PaymentOption } from "../../api/payments";
import { getApiErrorMessage } from "../../api/client";
import { normalizeAppError } from "../../api/appError";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Modal } from "../../components/ui/Modal";
import { ErrorState } from "../../components/ui/StateViews";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { useI18n } from "../../lib/i18n";
import { PaymentEntityPicker } from "./PaymentEntityPicker";
import { usePaymentDraftGuard } from "./usePaymentDraftGuard";

function localNow() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function submissionId() {
  // getRandomValues also works on the user's non-HTTPS LAN dev server.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function PaymentForm({ businessId, currency, initialClient, original, canLinkDeal, canLinkAppointment, onClose, onSaved }: {
  businessId: number; currency: string; initialClient?: PaymentOption; original?: Payment;
  canLinkDeal: boolean; canLinkAppointment: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const confirm = useActionConfirm();
  const cache = useQueryClient();
  const [client, setClient] = useState<PaymentOption | null>(initialClient || null);
  const [linkKind, setLinkKind] = useState("");
  const [link, setLink] = useState<PaymentOption | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localNow);
  const [method, setMethod] = useState<PaymentMethod>(original?.method || "cash");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<PaymentDraft | null>(null);
  const submitting = useRef(false);
  const [dirty, setDirty] = useState(false);
  const mutation = useMutation({
    mutationFn: paymentsApi.create,
    onSettled: () => { submitting.current = false; },
    onSuccess: async () => {
      await Promise.all([cache.invalidateQueries({ queryKey: ["client-payments"] }), cache.invalidateQueries({ queryKey: ["crm-card"] })]);
      onSaved();
    },
    onError: (error) => {
      const status = (error as { response?: { status?: number } }).response?.status;
      // Transport/server failures may have committed: freeze this exact command
      // and retry with its existing identity. Validation errors are editable.
      setUncertain(!status || status >= 500 || status === 409);
      if (status && status < 500 && status !== 409) attempt.current = null;
      if (status === 400) {
        const fields = normalizeAppError(error).fieldErrors;
        const names: Record<string, string> = { occurred_at: "date", deal: "link", appointment: "link" };
        setFieldErrors({ form: t("payments.checkFields"), ...Object.fromEntries(Object.keys(fields).map((key) => [names[key] || key, t("payments.checkFields")])) });
      }
    },
  });
  async function close() {
    if (mutation.isPending) return;
    if (dirty || uncertain) {
      const result = await confirm({ title: t("payments.discardTitle"), description: t(uncertain ? "payments.uncertainClose" : "payments.discardText"), confirmLabel: t("payments.discard"), tone: "warning" });
      if (!result.confirmed) return;
    }
    onClose();
  }
  usePaymentDraftGuard(dirty, mutation.isPending, uncertain);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (uncertain && attempt.current) { submitting.current = true; mutation.mutate(attempt.current); return; }
    const errors: Record<string, string> = {};
    if (!original && !client) errors.client = t("payments.required");
    if (linkKind && !link) errors.link = t("payments.required");
    if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(amount) || Number(amount.replace(",", ".")) <= 0) errors.amount = t("payments.amountInvalid");
    if (original && Number(amount.replace(",", ".")) > Number(original.remaining_amount)) errors.amount = t("payments.refundLimit", { amount: original.remaining_amount, currency: original.currency });
    if (!date || !Number.isFinite(new Date(date).getTime()) || new Date(date).getTime() > Date.now()) errors.date = t("payments.dateInvalid");
    if (original && new Date(date).getTime() < new Date(original.occurred_at).getTime()) errors.date = t("payments.refundDateInvalid");
    if (original && !reason.trim()) errors.reason = t("payments.required");
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const payload: PaymentDraft = {
      business: businessId, submission_id: submissionId(), amount: amount.replace(",", "."),
      occurred_at: new Date(date).toISOString(), method, note,
      ...(original ? { original: original.id, reason } : { client: client!.id, currency,
        ...(linkKind === "deal" && link ? { deal: link.id } : {}),
        ...(linkKind === "appointment" && link ? { appointment: link.id } : {}) }),
    };
    attempt.current = payload;
    submitting.current = true;
    mutation.mutate(payload);
  }
  return <Modal open title={t(original ? "payments.refund" : "payments.add")} onClose={() => void close()} size="md" closeOnBackdrop={false} testId="payment-form">
    <form onSubmit={submit} className="space-y-4" onChange={() => setDirty(true)} onKeyDown={(event) => {
      if (event.key === "Escape" && event.target instanceof Element && event.target.closest('[role="listbox"], [role="combobox"][aria-expanded="true"]')) event.stopPropagation();
    }}>
      {mutation.error && <ErrorState message={getApiErrorMessage(mutation.error)} />}
      {fieldErrors.form && <p role="alert" className="text-zani-danger">{fieldErrors.form}</p>}
      {uncertain && <p role="alert">{t("payments.uncertain")}</p>}
      <fieldset disabled={mutation.isPending || uncertain} className="space-y-4">
        {original ? <p>{original.client_name} · #{original.id} · {t("payments.refundLimit", { amount: original.remaining_amount, currency: original.currency })}</p>
          : initialClient ? <Input label={t("payments.client")} readOnly value={initialClient.label} />
          : <PaymentEntityPicker businessId={businessId} kind="client" value={client} error={fieldErrors.client} onChange={(value) => { setClient(value); setLink(null); setDirty(true); }} />}
        {!original && <>
          <Select label={t("payments.link")} value={linkKind} onChange={(e) => { setLinkKind(e.target.value); setLink(null); setDirty(true); }} options={[
            { value: "", label: t("payments.standalone") },
            ...(canLinkDeal ? [{ value: "deal", label: t("payments.deal") }] : []),
            ...(canLinkAppointment ? [{ value: "appointment", label: t("payments.appointment") }] : []),
          ]} />
          {client && (linkKind === "deal" || linkKind === "appointment") && <PaymentEntityPicker key={`${client.id}-${linkKind}`} businessId={businessId} kind={linkKind} clientId={client.id} value={link} error={fieldErrors.link} onChange={(value) => { setLink(value); setDirty(true); }} />}
        </>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={`${t("payments.amount")} (${original?.currency || currency})`} value={amount} inputMode="decimal" maxLength={16} error={fieldErrors.amount} onChange={(e) => setAmount(e.target.value)} required />
          <Input label={`${t("payments.date")} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} type="datetime-local" value={date} max={localNow()} error={fieldErrors.date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <Select label={t("payments.method")} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={(["cash", "card", "transfer", "other"] as const).map((value) => ({ value, label: t(`payments.method.${value}`) }))} />
        {original && <Textarea label={t("payments.reason")} value={reason} maxLength={500} required error={fieldErrors.reason} onChange={(e) => setReason(e.target.value)} />}
        <Textarea label={t("payments.note")} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        <p className="text-sm text-zani-muted">{t("payments.manualNotice")}</p>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => void close()}>{t("common.cancel")}</Button>
        <Button type="submit" variant={original ? "warning" : "primary"} isLoading={mutation.isPending}>{t(uncertain ? "common.retry" : original ? "payments.recordRefund" : "payments.record")}</Button>
      </div>
    </form>
  </Modal>;
}
