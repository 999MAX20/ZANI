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
import type { Id, ImportJob } from "../../../types";

function importStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    uploaded: "Загружен",
    previewed: "Проверен",
    imported: "Импортирован",
    failed: "Ошибка",
  };
  return status ? labels[status] || status : "Нет данных";
}

function ImportMetric({ label, value, tone = "default" }: { label: string; value?: number | string; tone?: "default" | "danger" | "success" }) {
  return (
    <div className={cn(
      "rounded-2xl px-3 py-2",
      tone === "danger" ? "bg-red-50 text-red-800" : tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-white text-slate-700",
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black">{value ?? 0}</p>
    </div>
  );
}

export function ImportPanel({ businessId }: { businessId: Id }) {
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
      if (!file) throw new Error("Выберите CSV или XLSX файл.");
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
      queryClient.invalidateQueries({ queryKey: ["services"] });
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
    { value: "clients", label: "Клиенты" },
    { value: "leads", label: "Заявки" },
    { value: "sales", label: "Продажи" },
    { value: "catalog", label: "Каталог" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-midnight">Excel / CSV</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
          Загрузите файл с клиентами, заявками, продажами или каталогом. ZANI сначала проверит файл и покажет preview.
        </p>
      </div>

      {importError ? <ErrorState message={getApiErrorMessage(importError)} /> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[180px_1fr_auto_auto]">
          <Select value={entity} onChange={(event) => setEntity(event.target.value as ImportEntity)} options={entityOptions} />
          <Input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <Button type="button" variant="secondary" isLoading={template.isPending} onClick={() => template.mutate(entity)}>
            <FileSpreadsheet size={16} /> Шаблон
          </Button>
          <Button type="button" disabled={!file} isLoading={upload.isPending} onClick={() => upload.mutate()}>
            <Upload size={16} /> Проверить файл
          </Button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-black text-midnight">{selected?.original_filename || "Файл еще не выбран"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {selected ? `${selected.entity_type} · ${selected.total_rows} строк · ${importStatusLabel(selected.status)}` : "Загрузите файл, чтобы увидеть preview и ошибки."}
            </p>
          </div>
          {selected?.status === "previewed" && !errors.length ? (
            <Button type="button" isLoading={confirm.isPending} onClick={() => confirm.mutate(selected.id)}>
              <CheckCircle2 size={16} /> Импортировать
            </Button>
          ) : null}
        </div>

        {selected ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <ImportMetric label="Строк" value={summary?.total_rows ?? selected.total_rows} />
            <ImportMetric label="Ошибок" value={summary?.errors ?? errors.length} tone={errors.length ? "danger" : "default"} />
            <ImportMetric label="Дублей" value={summary?.duplicates ?? duplicates.length} />
            <ImportMetric label="Импортировано" value={summary?.imported ?? selected.imported_count} tone={selected.status === "imported" ? "success" : "default"} />
          </div>
        ) : null}

        {errors.length ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3">
            <p className="text-sm font-black text-red-800">Нужно исправить файл</p>
            {errors.slice(0, 5).map((item, index) => (
              <p key={`${item.row}-${item.field}-${index}`} className="mt-1 text-xs font-semibold text-red-700">
                Строка {item.row}, {item.field}: {item.message}
              </p>
            ))}
          </div>
        ) : null}

        {duplicates.length ? (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-sm font-black text-amber-900">Найдены возможные дубли</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
              ZANI не создаст вторую карточку, если клиент уже найден по телефону или email.
            </p>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
          {previewRows.slice(0, 5).map((row, index) => (
            <div key={index} className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600 last:border-b-0">
              {Object.entries(row).slice(0, 6).map(([key, value]) => `${key}: ${value || "-"}`).join(" · ")}
            </div>
          ))}
          {!previewRows.length ? <p className="px-3 py-4 text-sm text-slate-500">Preview появится после проверки файла.</p> : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <p className="font-black text-midnight">История импортов</p>
        <div className="mt-3 space-y-2">
          {jobs.slice(0, 8).map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setActiveJob(job)}
              className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm transition hover:bg-slate-100"
            >
              <span className="font-bold text-midnight">#{job.id} {job.entity_type}</span>
              <span className="ml-2 text-slate-500">{importStatusLabel(job.status)} · {job.imported_count}/{job.total_rows}</span>
            </button>
          ))}
          {!jobsQuery.isLoading && !jobs.length ? <p className="text-sm text-slate-500">Импортов пока нет.</p> : null}
        </div>
      </div>
    </div>
  );
}
