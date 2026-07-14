import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarClock, Plus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../../api/client";
import { resourcesApi } from "../../api/resources";
import { teamApi } from "../../api/team";
import { ResourceForm } from "../../components/forms/ResourceForm";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { MetricCard } from "../../components/ui/MetricCard";
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

export function ResourcesPage() {
  const { t } = useI18n();
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { resources, appointments, workingHours } = useEntityData({ resources: true, appointments: true, workingHours: true });
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | undefined>();
  const [draft, setDraft] = useState<Partial<Resource> | undefined>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<Resource>) =>
      editing ? resourcesApi.update({ id: editing.id, payload }) : resourcesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setOpen(false);
      setEditing(undefined);
      setDraft(undefined);
    },
  });
  const actionErrorMessage = mutation.error ? getApiErrorMessage(mutation.error) : "";

  useEffect(() => {
    if (!actionErrorMessage) return;
    showNotification({ message: actionErrorMessage, tone: "danger" });
  }, [actionErrorMessage, showNotification]);

  if (!business) return <ErrorState message={t("resources.noBusiness")} />;
  if (resources.isLoading || appointments.isLoading || workingHours.isLoading || teamMembers.isLoading) return <LoadingState />;

  const resourceList = resources.data || [];
  const activeTeamMembers = (teamMembers.data || []).filter((member) => member.is_active);
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
      <PageHeader
        title={t("resources.title")}
        description={t("resources.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/settings#operations-setup">
              <Button type="button" variant="secondary">{t("settings.schedulingCenter")}</Button>
            </Link>
            <Button onClick={() => openCreate()}><Plus size={18} />{t("resources.add")}</Button>
          </div>
        }
      />
      <section className="mb-5 grid gap-3 lg:grid-cols-3">
        <MetricCard label={t("resources.active")} value={activeResources.length} hint={t("resources.activeHint")} icon={UsersRound} />
        <MetricCard label={t("resources.staff")} value={staffCount} hint={t("resources.staffHint")} icon={BriefcaseBusiness} />
        <MetricCard label={t("resources.withSchedule")} value={`${scheduledResources}/${activeResources.length}`} hint={t("resources.withScheduleHint")} icon={CalendarClock} />
      </section>
      <div className="mb-5 rounded-card border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-card">
        <span className="font-black text-midnight">{t("resources.logicTitle")}</span> {t("resources.logicText")}
      </div>
      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {resourceTemplates.map((template) => (
          <button
            key={template.label}
            type="button"
            onClick={() => openCreate(template.draft)}
            className="rounded-card border border-slate-200 bg-white p-4 text-left shadow-card transition hover:bg-slate-50"
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
          { header: t("resources.linkedUser"), cell: (resource) => resource.linked_user_name || t("resources.noLinkedUser") },
          { header: t("resources.bookings"), cell: (resource) => resourceUsage(resource) },
          { header: t("appointment.status"), cell: (resource) => <StatusBadge status={resource.is_active ? "active" : "inactive"} /> },
          { header: t("appointments.actions"), cell: (resource) => <Button variant="ghost" onClick={() => { setDraft(undefined); setEditing(resource); setOpen(true); }}>{t("appointments.edit")}</Button> },
        ]}
      />
      <Modal title={editing ? t("resources.editTitle") : t("resources.add")} open={open} onClose={() => { setOpen(false); setEditing(undefined); setDraft(undefined); }}>
        <ResourceForm businessId={business.id} initial={editing || draft} teamMembers={activeTeamMembers} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
    </>
  );
}
