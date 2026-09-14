import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { paymentsApi, type PaymentOption, type PaymentOptionKind } from "../../api/payments";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { formatDateTime } from "../../lib/format";

export function PaymentEntityPicker({ businessId, kind, clientId, value, onChange, error }: {
  businessId: number; kind: PaymentOptionKind; clientId?: number;
  value: PaymentOption | null; onChange: (value: PaymentOption) => void; error?: string;
}) {
  const { t } = useI18n();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const options = useQuery({
    queryKey: ["payment-options", businessId, kind, clientId, query, page],
    queryFn: () => paymentsApi.options({ business: businessId, kind, client: clientId, q: query, page }),
    enabled: open,
  });
  const label = t(`payments.${kind}`);
  return <div className="space-y-2">
    <Button ref={trigger} type="button" variant="secondary" aria-expanded={open}
      aria-label={`${label}: ${value?.label || t("common.select")}`} className="w-full justify-start whitespace-normal text-left"
      onClick={() => setOpen(!open)}>
      {label}: {value?.label || t("common.select")}
    </Button>
    {error && <p role="alert" className="text-sm text-zani-danger">{error}</p>}
    {open && <div className="space-y-2 rounded-control border border-zani-border p-3"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
      <Input autoFocus label={`${t("common.search")}: ${label}`} value={search} maxLength={200} onChange={(e) => setSearch(e.target.value)} />
      {options.isLoading && <LoadingState />}
      {options.error && <ErrorState message={getApiErrorMessage(options.error)} action={<Button type="button" variant="secondary" onClick={() => void options.refetch()}>{t("common.retry")}</Button>} />}
      {!options.isFetching && options.data?.count === 0 && <p role="status">{t("payments.noMatches")}</p>}
      <ul aria-label={label} className="space-y-1">
        {options.data?.results.map((option) => <li key={option.id}>
          <Button type="button" variant="ghost" className="w-full justify-start whitespace-normal text-left"
            onClick={() => { onChange(option); setOpen(false); trigger.current?.focus(); }}>
            {option.label} · #{option.id}{option.occurred_at ? ` · ${formatDateTime(option.occurred_at)}` : ""}
          </Button>
        </li>)}
      </ul>
      {options.data && options.data.count > 5 && <div className="flex justify-between gap-2">
        <Button type="button" variant="secondary" disabled={!options.data.previous || options.isFetching} onClick={() => setPage(page - 1)}>{t("common.back")}</Button>
        <Button type="button" variant="secondary" disabled={!options.data.next || options.isFetching} onClick={() => setPage(page + 1)}>{t("payments.next")}</Button>
      </div>}
    </div>}
  </div>;
}
