import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarClock, Plus, UsersRound } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { resourcesApi } from "../../api/resources";
import { ResourceForm } from "../../components/forms/ResourceForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { Resource } from "../../types";

const resourceTypeLabelKeys: Record<Resource["resource_type"], string> = {
  staff: "resources.typeStaff",
  room: "resources.typeRoom",
  hall: "resources.typeHall",
  box: "resources.typeBox",
  equipment: "resources.typeEquipment",
  other: "resources.typeOther",
};

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: typeof UsersRound }) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-midnight">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

export function ResourcesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { resources, appointments, workingHours } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | undefined>();
  const [draft, setDraft] = useState<Partial<Resource> | undefined>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<Resource>) =>
      editing ? resourcesApi.update({ id: editing.id, payload }) : resourcesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setOpen(false);
      setEditing(undefined);
      setDraft(undefined);
    },
  });

  if (!business) return <ErrorState message={t("resources.noBusiness")} />;
  if (resources.isLoading || appointments.isLoading || workingHours.isLoading) return <LoadingState />;

  const resourceList = resources.data || [];
  const activeResources = resourceList.filter((resource) => resource.is_active);
  const staffCount = activeResources.filter((resource) => resource.resource_type === "staff").length;
  const scheduledResources = new Set((workingHours.data || []).map((item) => item.resource).filter(Boolean)).size;
  const resourceUsage = (resource: Resource) => (appointments.data || []).filter((appointment) => appointment.resource === resource.id).length;
  const resourceTemplates: { label: string; text: string; draft: Partial<Resource> }[] = [
    { label: t("resources.templateMaster"), text: t("resources.templateMasterText"), draft: { name: t("resources.templateMasterName"), resource_type: "staff", is_active: true } },
    { label: t("resources.templateChair"), text: t("resources.templateChairText"), draft: { name: t("resources.templateChairName"), resource_type: "equipment", is_active: true } },
    { label: t("resources.templateRoom"), text: t("resources.templateRoomText"), draft: { name: t("resources.templateRoomName"), resource_type: "room", is_active: true } },
    { label: t("resources.templateBox"), text: t("resources.templateBoxText"), draft: { name: t("resources.templateBoxName"), resource_type: "box", is_active: true } },
  ];

  function openCreate(template?: Partial<Resource>) {
    setEditing(undefined);
    setDraft(template);
    setOpen(true);
  }

  return (
    <>
      <PageHeader title={t("resources.title")} description={t("resources.description")} actions={<Button onClick={() => openCreate()}><Plus size={18} />{t("resources.add")}</Button>} />
      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <StatCard label={t("resources.active")} value={activeResources.length} hint={t("resources.activeHint")} icon={UsersRound} />
        <StatCard label={t("resources.staff")} value={staffCount} hint={t("resources.staffHint")} icon={BriefcaseBusiness} />
        <StatCard label={t("resources.withSchedule")} value={`${scheduledResources}/${activeResources.length}`} hint={t("resources.withScheduleHint")} icon={CalendarClock} />
      </section>
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <div className="mb-5 rounded-3xl border border-white/80 bg-white/75 p-4 text-sm text-slate-600 shadow-sm">
        <span className="font-black text-midnight">{t("resources.logicTitle")}</span> {t("resources.logicText")}
      </div>
      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {resourceTemplates.map((template) => (
          <button
            key={template.label}
            type="button"
            onClick={() => openCreate(template.draft)}
            className="rounded-3xl border border-white/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <p className="font-black text-midnight">{template.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">{template.text}</p>
          </button>
        ))}
      </section>
      <DataTable
        rows={resourceList}
        emptyTitle={t("resources.emptyTitle")}
        emptyDescription={t("resources.emptyText")}
        emptyAction={<Button variant="secondary" onClick={() => openCreate()}><Plus size={16} />{t("resources.add")}</Button>}
        columns={[
          { header: t("resources.name"), cell: (resource) => <span className="font-medium text-ink">{resource.name}</span> },
          { header: t("resources.type"), cell: (resource) => t(resourceTypeLabelKeys[resource.resource_type] || "resources.typeOther") },
          { header: t("resources.bookings"), cell: (resource) => resourceUsage(resource) },
          { header: t("appointment.status"), cell: (resource) => <StatusBadge status={resource.is_active ? "active" : "inactive"} /> },
          { header: t("appointments.actions"), cell: (resource) => <Button variant="ghost" onClick={() => { setDraft(undefined); setEditing(resource); setOpen(true); }}>{t("appointments.edit")}</Button> },
        ]}
      />
      <Modal title={editing ? t("resources.editTitle") : t("resources.add")} open={open} onClose={() => { setOpen(false); setEditing(undefined); setDraft(undefined); }}>
        <ResourceForm businessId={business.id} initial={editing || draft} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
    </>
  );
}
