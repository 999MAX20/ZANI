import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { paymentsApi, type Payment, type PaymentOption } from "../../api/payments";
import { getApiErrorMessage } from "../../api/client";
import { Drawer } from "../../components/ui/Overlay";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import { hasPermission } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { formatDateTime } from "../../lib/format";
import { PaymentForm } from "./PaymentForm";

export function PaymentsJournal({ client, onClose }: { client?: PaymentOption; onClose: () => void }) {
  const { t } = useI18n();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const titleId = useId();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<"receipt" | Payment | null>(null);
  const [saved, setSaved] = useState(false);
  const canView = hasPermission(user, business?.id, "payments") && hasPermission(user, business?.id, "clients");
  const canCreate = canView && hasPermission(user, business?.id, "payments", "create");
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const payments = useQuery({
    queryKey: ["client-payments", business?.id, client?.id, query, kind, page],
    queryFn: () => paymentsApi.list({ business: business!.id, client: client?.id, q: query, kind, page }),
    enabled: canView,
  });
  return <>
    <Drawer open onClose={form ? () => undefined : onClose} titleId={titleId} size="complex" testId="payments-journal" closeOnBackdrop={false}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zani-border p-4 sm:p-5">
        <div className="min-w-0"><h2 id={titleId} className="text-xl font-semibold">{t("payments.title")}</h2>{client && <p className="break-words text-sm text-zani-muted">{client.label}</p>}</div>
        <div className="flex flex-wrap justify-end gap-2">
          {canCreate && <Button type="button" onClick={() => { setForm("receipt"); setSaved(false); }} data-testid="payment-add"><Plus aria-hidden size={18} />{t("payments.add")}</Button>}
          <Button type="button" variant="ghost" aria-label={t("common.close")} onClick={onClose}><X size={20} /></Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {!canView ? <ForbiddenState /> : <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t("payments.search")} value={search} maxLength={200} onChange={(e) => setSearch(e.target.value)} />
            <Select label={t("payments.kind")} value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} options={[
              { value: "", label: t("payments.all") }, { value: "receipt", label: t("payments.receipt") }, { value: "refund", label: t("payments.refundKind") },
            ]} />
          </div>
          {saved && <p role="status" className="text-sm text-zani-success">{t("payments.saved")}</p>}
          {payments.isLoading && <LoadingState />}
          {payments.error && <ErrorState message={getApiErrorMessage(payments.error)} action={<Button variant="secondary" onClick={() => void payments.refetch()}>{t("common.retry")}</Button>} />}
          {!payments.isFetching && !payments.error && payments.data?.count === 0 && <EmptyState title={t("payments.empty")} description={t("payments.emptyText")} />}
          {!payments.error && <ul className="space-y-3" aria-label={t("payments.title")}>
            {payments.data?.results.map((payment) => <li key={payment.id} className="space-y-3 rounded-card border border-zani-border bg-surface-card p-4" data-testid={`payment-row-${payment.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="break-words font-semibold">{payment.client_name}</p><p className="text-sm text-zani-muted">#{payment.id} · {t(payment.kind === "refund" ? "payments.refundKind" : "payments.receipt")}{payment.original ? ` · #${payment.original}` : ""}</p></div>
                <strong className="break-all text-lg tabular-nums">{payment.kind === "refund" ? "−" : "+"}{payment.amount} {payment.currency}</strong>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-zani-muted">{t("payments.date")}</dt><dd>{formatDateTime(payment.occurred_at)}</dd></div>
                <div><dt className="text-zani-muted">{t("payments.method")}</dt><dd>{t(`payments.method.${payment.method}`)}</dd></div>
                <div><dt className="text-zani-muted">{t("payments.source")}</dt><dd>{t(payment.source === "manual" ? "payments.manual" : "payments.integration")}</dd></div>
                <div><dt className="text-zani-muted">{t("payments.actor")}</dt><dd className="break-words">{payment.actor_name || "—"} · {formatDateTime(payment.created_at)}</dd></div>
                {payment.link && <div><dt className="text-zani-muted">{t("payments.link")}</dt><dd>{t(`payments.${payment.link.kind}`)} #{payment.link.id}</dd></div>}
                {Number(payment.refunded_amount) > 0 && <div><dt className="text-zani-muted">{t("payments.refunded")}</dt><dd>{payment.refunded_amount} {payment.currency}</dd></div>}
              </dl>
              {(payment.note || payment.reason) && <p className="whitespace-pre-wrap break-words text-sm">{payment.reason || payment.note}</p>}
              {payment.can_refund && <Button type="button" variant="secondary" onClick={() => { setForm(payment); setSaved(false); }}>{t("payments.refund")}</Button>}
            </li>)}
          </ul>}
        </>}
      </div>
      {canView && payments.data && !payments.error && <nav aria-label={t("payments.pagination")} className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zani-border p-4">
        <span className="text-sm" aria-live="polite">{t("payments.count", { count: payments.data.count })} · {page}/{Math.max(1, Math.ceil(payments.data.count / 20))}</span>
        <div className="flex gap-2"><Button variant="secondary" disabled={!payments.data.previous || payments.isFetching} onClick={() => setPage(page - 1)}>{t("common.back")}</Button><Button variant="secondary" disabled={!payments.data.next || payments.isFetching} onClick={() => setPage(page + 1)}>{t("payments.next")}</Button></div>
      </nav>}
    </Drawer>
    {form && business && <PaymentForm businessId={business.id} currency={business.currency} initialClient={client}
      original={form === "receipt" ? undefined : form} canLinkDeal={hasPermission(user, business.id, "deals")}
      canLinkAppointment={hasPermission(user, business.id, "appointments")} onClose={() => setForm(null)}
      onSaved={() => { setForm(null); setPage(1); setSaved(true); }} />}
  </>;
}
