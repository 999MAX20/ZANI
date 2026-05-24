import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Plus, UsersRound } from "lucide-react";
import { useState } from "react";

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

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const presetOptions: Array<{ value: WorkingHoursPreset; label: string; description: string }> = [
  { value: "weekdays_9_18", label: "Пн-Пт 09:00-18:00", description: "Сб-Вс выходной" },
  { value: "daily_9_20", label: "Ежедневно 09:00-20:00", description: "Работает каждый день" },
  { value: "mon_sat_9_18", label: "Пн-Сб 09:00-18:00", description: "Вс выходной" },
];

export function WorkingHoursPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { workingHours, resources } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<number | null>(null);
  const [preset, setPreset] = useState<WorkingHoursPreset>("weekdays_9_18");
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (payloads: Array<Partial<WorkingHours>>) => {
      const existingRows = workingHours.data || [];
      const result = [];
      for (const payload of payloads) {
        const existing = existingRows.find(
          (item) => item.weekday === payload.weekday && (item.resource || null) === (payload.resource || null),
        );
        if (existing) {
          result.push(await workingHoursApi.update({ id: existing.id, payload }));
        } else {
          result.push(await workingHoursApi.create(payload));
        }
      }
      return result;
    },
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

  return (
    <>
      <PageHeader title={t("workingHours.title")} description={t("workingHours.description")} actions={<Button onClick={() => setOpen(true)}><Plus size={18} />{t("workingHours.setupWeek")}</Button>} />
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
              options={presetOptions.map((item) => ({ value: item.value, label: `${item.label} · ${item.description}` }))}
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
      <DataTable
        rows={rows}
        emptyTitle={t("workingHours.emptyTitle")}
        emptyDescription={t("workingHours.emptyText")}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("workingHours.setupWeek")}</Button>}
        columns={[
          { header: t("workingHours.day"), cell: (item) => weekdays[item.weekday] },
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
