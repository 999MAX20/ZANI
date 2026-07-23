import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";

import { getApiErrorMessage } from "../../../api/client";
import { importExportApi, type ImportEntity } from "../../../api/importExport";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { ErrorState } from "../../../components/ui/StateViews";
import { cn } from "../../../lib/cn";
import { useI18n } from "../../../lib/i18n";
import type { Id, ImportJob } from "../../../types";

type Translate = ReturnType<typeof useI18n>["t"];

function importStatusLabel(status: string | undefined, t: Translate) {
  const labels: Record<string, string> = {
    uploaded: "integrations.import.status.uploaded",
    previewed: "integrations.import.status.previewed",
    imported: "integrations.import.status.imported",
    failed: "integrations.import.status.failed",
  };
  return status ? t(labels[status] || status) : t("integrations.import.status.none");
}

function ImportMetric({ label, value, tone = "default" }: { label: string; value?: number | string; tone?: "default" | "danger" | "success" }) {
  return (
    <div className={cn(
      "rounded-control px-3 py-2",
      tone === "danger" ? "bg-[var(--zani-danger-soft)] text-zani-danger" : tone === "success" ? "bg-[var(--zani-success-soft)] text-zani-success" : "bg-surface-card text-zani-subtle",
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zani-faint">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value ?? 0}</p>
    </div>
  );
}

export function ImportPanel({ businessId }: { businessId: Id }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [entity, setEntity] = useState<ImportEntity>("clients");
  const [file, setFile] = useState<File | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["import-jobs", businessId],
    queryFn: () => importExportApi.importJobs(businessId),
  });

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t("integrations.import.chooseFile"));
      return importExportApi.upload({ business: businessId, entity, file });
    },
    onSuccess: (job) => {
      setActiveJob(job);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
  });

  const confirm = useMutation({
    mutationFn: (jobId: Id) => importExportApi.confirm(jobId),
    onSuccess: (job) => {
      setActiveJob(job);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["connector-sync-runs"] });
    },
  });

  const template = useMutation({
    mutationFn: importExportApi.downloadTemplate,
  });

  const jobs = jobsQuery.data || [];
  const selected = activeJob || jobs[0];
  const errors = selected?.errors_json?.rows || [];
  const duplicates = selected?.duplicates_json?.rows || [];
  const previewRows = selected?.preview_json?.rows || [];
  const summary = selected?.summary_json || selected?.preview_json?.import_summary;
  const importError = jobsQuery.error || upload.error || confirm.error || template.error;
  const entityOptions = [
    { value: "clients", label: t("integrations.import.clients") },
    { value: "leads", label: t("integrations.import.leads") },
    { value: "deals", label: t("integrations.import.deals") },
    { value: "sales", label: t("integrations.import.sales") },
    { value: "catalog", label: t("integrations.import.catalogShort") },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
        <p className="text-sm font-semibold text-zani-ink">Excel / CSV</p>
        <p className="mt-1 text-sm font-medium leading-6 text-zani-muted">
          {t("integrations.import.panelDescription")}
        </p>
      </div>

      {importError ? <ErrorState message={getApiErrorMessage(importError)} /> : null}

      <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[180px_1fr_auto_auto]">
          <Select value={entity} onChange={(event) => setEntity(event.target.value as ImportEntity)} options={entityOptions} />
          <Input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <Button type="button" variant="secondary" isLoading={template.isPending} onClick={() => template.mutate(entity)}>
            <FileSpreadsheet size={16} /> {t("integrations.import.template")}
          </Button>
          <Button type="button" disabled={!file} isLoading={upload.isPending} onClick={() => upload.mutate()}>
            <Upload size={16} /> {t("integrations.import.checkFile")}
          </Button>
        </div>
      </div>

      <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-zani-ink">{selected?.original_filename || t("integrations.import.noFileSelected")}</p>
            <p className="mt-1 text-sm text-zani-muted">
              {selected
                ? t("integrations.import.fileMeta", {
                    entity: selected.entity_type,
                    rows: selected.total_rows,
                    status: importStatusLabel(selected.status, t),
                  })
                : t("integrations.import.noFileSelectedText")}
            </p>
          </div>
          {selected?.status === "previewed" && !errors.length ? (
            <Button type="button" isLoading={confirm.isPending} onClick={() => confirm.mutate(selected.id)}>
              <CheckCircle2 size={16} /> {t("integrations.import.import")}
            </Button>
          ) : null}
        </div>

        {selected ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <ImportMetric label={t("integrations.import.summaryRows")} value={summary?.total_rows ?? selected.total_rows} />
            <ImportMetric label={t("integrations.import.summaryErrors")} value={summary?.errors ?? errors.length} tone={errors.length ? "danger" : "default"} />
            <ImportMetric label={t("integrations.import.summaryDuplicates")} value={summary?.duplicates ?? duplicates.length} />
            <ImportMetric label={t("integrations.import.summaryImported")} value={summary?.imported ?? selected.imported_count} tone={selected.status === "imported" ? "success" : "default"} />
          </div>
        ) : null}

        {errors.length ? (
          <div className="mt-4 rounded-card border border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] p-3">
            <p className="text-sm font-semibold text-zani-danger">{t("integrations.import.fixFileShort")}</p>
            {errors.slice(0, 5).map((item, index) => (
              <p key={`${item.row}-${item.field}-${index}`} className="mt-1 text-xs font-semibold text-zani-danger">
                {t("integrations.import.rowError", { row: item.row, field: item.field, message: item.message })}
              </p>
            ))}
          </div>
        ) : null}

        {duplicates.length ? (
          <div className="mt-4 rounded-card border border-[rgba(151,90,22,0.24)] bg-[var(--zani-warning-soft)] p-3">
            <p className="text-sm font-semibold text-zani-warning">{t("integrations.import.duplicatesFound")}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-zani-warning">
              {t("integrations.import.duplicatesDescription")}
            </p>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-card border border-zani-border bg-surface-card">
          {previewRows.slice(0, 5).map((row, index) => (
            <div key={index} className="border-b border-zani-border px-3 py-2 text-xs text-zani-subtle last:border-b-0">
              {Object.entries(row).slice(0, 6).map(([key, value]) => `${key}: ${value || "-"}`).join(" · ")}
            </div>
          ))}
          {!previewRows.length ? <p className="px-3 py-4 text-sm text-zani-muted">{t("integrations.import.previewAfterCheck")}</p> : null}
        </div>
      </div>

      <div className="rounded-card border border-zani-border bg-surface-card p-4 shadow-sm">
        <p className="font-semibold text-zani-ink">{t("integrations.import.history")}</p>
        <div className="mt-3 space-y-2">
          {jobs.slice(0, 8).map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setActiveJob(job)}
              className="w-full rounded-control bg-surface-muted px-3 py-2 text-left text-sm transition hover:bg-surface-warm"
            >
              <span className="font-semibold text-zani-ink">#{job.id} {job.entity_type}</span>
              <span className="ml-2 text-zani-muted">{importStatusLabel(job.status, t)} · {job.imported_count}/{job.total_rows}</span>
            </button>
          ))}
          {!jobsQuery.isLoading && !jobs.length ? <p className="text-sm text-zani-muted">{t("integrations.import.noImports")}</p> : null}
        </div>
      </div>
    </div>
  );
}
