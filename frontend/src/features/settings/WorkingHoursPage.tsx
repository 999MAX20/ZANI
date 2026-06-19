import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Plus, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi, type WorkingHoursPreset } from "../../api/workingHours";
import { WeeklyWorkingHoursForm } from "../../components/forms/WorkingHoursForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { WorkingHours } from "../../types";

const weekdays = ["weekday.monShort", "weekday.tueShort", "weekday.wedShort", "weekday.thuShort", "weekday.friShort", "weekday.satShort", "weekday.sunShort"];
const presetOptions: Array<{ value: WorkingHoursPreset; labelKey: string; descriptionKey: string }> = [
  { value: "weekdays_9_18", labelKey: "workingHours.preset.weekdays", descriptionKey: "workingHours.preset.weekendsOff" },
  { value: "daily_9_20", labelKey: "workingHours.preset.daily", descriptionKey: "workingHours.preset.everyDay" },
  { value: "mon_sat_9_18", labelKey: "workingHours.preset.monSat", descriptionKey: "workingHours.preset.sunOff" },
];

export function WorkingHoursPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { workingHours, resources } = useEntityData({ workingHours: true, resources: true });
  const [open, setOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<number | null>(null);
  const [preset, setPreset] = useState<WorkingHoursPreset>("weekdays_9_18");
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (payloads: Array<Partial<WorkingHours>>) =>
      workingHoursApi.bulkUpsertWeek({
        business: business!.id,
        resource: payloads[0]?.resource || null,
        days: payloads.map((payload) => ({
          weekday: Number(payload.weekday),
          start_time: String(payload.start_time || "09:00"),
          end_time: String(payload.end_time || "18:00"),
          is_day_off: Boolean(payload.is_day_off),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["available-slots"] });
      setOpen(false);
      setEditingResource(null);
      setNotice(t("workingHours.savedNotice"));
    },
  });
  const presetMutation = useMutation({
    mutationFn: () => workingHoursApi.applyPreset({ business: business!.id, preset }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["available-slots"] });
      setNotice(t("workingHours.presetNotice").replace("{count}", String(data.count)));
    },
  });

  if (!business) return <ErrorState message={t("workingHours.noBusiness")} />;
  if (workingHours.isLoading || resources.isLoading) return <LoadingState />;
  const rows = workingHours.data || [];
  const activeResources = (resources.data || []).filter((resource) => resource.is_active);
  const businessDays = rows.filter((row) => !row.resource && !row.is_day_off).length;
  const resourceSchedules = new Set(rows.map((row) => row.resource).filter(Boolean)).size;
  const dayOffRows = rows.filter((row) => row.is_day_off).length;
  const businessWeek = weekdays.map((key, index) => rows.find((row) => !row.resource && row.weekday === index) || null);
  const resourceSummary = activeResources.map((resource) => {
    const resourceRows = rows.filter((row) => row.resource === resource.id);
    return {
      resource,
      workingDays: resourceRows.filter((row) => !row.is_day_off).length,
      configuredDays: resourceRows.length,
    };
  });

  function formatHours(row: WorkingHours | null) {
    if (!row) return t("workingHours.notConfigured");
    if (row.is_day_off) return t("workingHours.dayOff");
    return `${row.start_time.slice(0, 5)} - ${row.end_time.slice(0, 5)}`;
  }

  return (
    <>
      <PageHeader
        title={t("workingHours.title")}
        description={t("workingHours.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/settings#operations-setup">
              <Button type="button" variant="secondary">{t("settings.schedulingCenter")}</Button>
            </Link>
            <Button onClick={() => setOpen(true)}><Plus size={18} />{t("workingHours.setupWeek")}</Button>
          </div>
        }
      />
      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-soft">
          <CalendarDays className="text-brand-600" size={24} />
          <p className="mt-4 text-sm font-bold text-slate-500">{t("workingHours.businessDays")}</p>
          <p className="mt-2 text-3xl font-black text-midnight">{businessDays}/7</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-soft">
          <UsersRound className="text-brand-600" size={24} />
          <p className="mt-4 text-sm font-bold text-slate-500">{t("workingHours.resourceSchedules")}</p>
          <p className="mt-2 text-3xl font-black text-midnight">{resourceSchedules}/{activeResources.length}</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-soft">
          <Clock3 className="text-brand-600" size={24} />
          <p className="mt-4 text-sm font-bold text-slate-500">{t("workingHours.daysOff")}</p>
          <p className="mt-2 text-3xl font-black text-midnight">{dayOffRows}</p>
        </div>
      </section>
      <div className="mb-5 rounded-3xl border border-brand-100 bg-white/80 p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-600">{t("workingHours.quickSetup")}</p>
            <h2 className="mt-1 text-xl font-bold text-midnight">{t("workingHours.quickTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("workingHours.quickText")}
            </p>
          </div>
          <div className="grid gap-3">
            <Select
              value={preset}
              onChange={(event) => setPreset(event.target.value as WorkingHoursPreset)}
              options={presetOptions.map((item) => ({ value: item.value, label: `${t(item.labelKey)} · ${t(item.descriptionKey)}` }))}
            />
            <Button type="button" isLoading={presetMutation.isPending} onClick={() => presetMutation.mutate()}>
              {t("workingHours.applyPreset")}
            </Button>
          </div>
        </div>
      </div>
      {notice ? (
        <div className="mb-4 rounded-3xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          {notice}
        </div>
      ) : null}
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      {presetMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(presetMutation.error)} /></div> : null}
      <section className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">{t("workingHours.wholeBusinessSchedule")}</p>
              <h2 className="mt-1 text-xl font-black text-midnight">{t("workingHours.weekOverview")}</h2>
            </div>
            <Button variant="secondary" onClick={() => { setEditingResource(null); setOpen(true); }}>
              {t("workingHours.editWeek")}
            </Button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {businessWeek.map((row, index) => (
              <div key={weekdays[index]} className={`rounded-2xl border p-3 ${row && !row.is_day_off ? "border-brand-100 bg-brand-50/70" : "border-slate-100 bg-slate-50"}`}>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t(weekdays[index])}</p>
                <p className={`mt-2 text-sm font-black ${row && !row.is_day_off ? "text-brand-800" : "text-slate-500"}`}>{formatHours(row)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">{t("workingHours.resourceSchedules")}</p>
              <h2 className="mt-1 text-xl font-black text-midnight">{t("workingHours.staffOverview")}</h2>
            </div>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              {t("workingHours.setupWeek")}
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {resourceSummary.length ? resourceSummary.map((item) => (
              <button
                key={item.resource.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:bg-brand-50"
                onClick={() => { setEditingResource(item.resource.id); setOpen(true); }}
              >
                <span className="font-bold text-midnight">{item.resource.name}</span>
                <span className="text-sm font-bold text-slate-500">
                  {item.configuredDays ? t("workingHours.configuredDays").replace("{count}", String(item.workingDays)) : t("workingHours.usesBusinessSchedule")}
                </span>
              </button>
            )) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">{t("workingHours.noResourcesText")}</p>
            )}
          </div>
        </div>
      </section>
      <DataTable
        rows={rows}
        emptyTitle={t("workingHours.emptyTitle")}
        emptyDescription={t("workingHours.emptyText")}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("workingHours.setupWeek")}</Button>}
        columns={[
          { header: t("workingHours.day"), cell: (item) => t(weekdays[item.weekday] || "weekday.monShort") },
          { header: t("workingHours.target"), cell: (item) => resources.data?.find((resource) => resource.id === item.resource)?.name || t("workingHours.wholeBusiness") },
          { header: t("workingHours.time"), cell: (item) => item.is_day_off ? t("workingHours.dayOff") : `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` },
          { header: t("appointments.actions"), cell: (item) => <Button variant="ghost" onClick={() => { setEditingResource(item.resource || null); setOpen(true); }}>{t("workingHours.editWeek")}</Button> },
        ]}
      />
      <Modal title={t("workingHours.weekTitle")} open={open} onClose={() => { setOpen(false); setEditingResource(null); }}>
        <WeeklyWorkingHoursForm
          businessId={business.id}
          resources={(resources.data || []).filter((resource) => resource.is_active)}
          existingHours={workingHours.data || []}
          initialResource={editingResource}
          onSubmit={(payloads) => mutation.mutateAsync(payloads)}
        />
      </Modal>
    </>
  );
}
