import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarDays, Clock3, SlidersHorizontal, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi, type WorkingHoursPreset } from "../../api/workingHours";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { CrmWorkspacePage } from "../../components/crm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { Button } from "../../components/ui/Button";
import { MetricCard } from "../../components/ui/MetricCard";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Tabs } from "../../components/ui/Tabs";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import { hasPermission, permissionForbiddenMessage } from "../../lib/permissions";
import type { Resource, WorkingHours } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { BusinessWorkspaceNav } from "../business/components/BusinessWorkspaceNav";
import { WorkingHoursBusinessView } from "./components/WorkingHoursBusinessView";
import { WorkingHoursEditModal } from "./components/WorkingHoursEditModal";
import { WorkingHoursResourcesView, type ResourceScheduleSummary } from "./components/WorkingHoursResourcesView";

const weekdayKeys = [
  "weekday.mon",
  "weekday.tue",
  "weekday.wed",
  "weekday.thu",
  "weekday.fri",
  "weekday.sat",
  "weekday.sun",
];

const presetOptions: Array<{ value: WorkingHoursPreset; labelKey: string; descriptionKey: string }> = [
  { value: "weekdays_9_18", labelKey: "workingHours.preset.weekdays", descriptionKey: "workingHours.preset.weekendsOff" },
  { value: "daily_9_20", labelKey: "workingHours.preset.daily", descriptionKey: "workingHours.preset.everyDay" },
  { value: "mon_sat_9_18", labelKey: "workingHours.preset.monSat", descriptionKey: "workingHours.preset.sunOff" },
];

type ScheduleMode = "" | "business" | "individual";
type WorkingHoursView = "business" | "resources";

function positiveInteger(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function WorkingHoursPage() {
  const { t } = useI18n();
  const showNotification = useNotification();
  const confirmAction = useActionConfirm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setPageHeader } = usePageHeader();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const { workingHours, resources } = useEntityData({ workingHours: true, resources: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [preset, setPreset] = useState<WorkingHoursPreset>("weekdays_9_18");
  const [resourceSearch, setResourceSearch] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("");
  const [resourcePage, setResourcePage] = useState(1);
  const [resourcePageSize, setResourcePageSize] = useState(20);
  const [modalDirty, setModalDirty] = useState(false);

  const canManage = hasPermission(user, business?.id, "settings", "update");
  const canViewSettings = hasPermission(user, business?.id, "settings", "view");
  const permissionMessage = permissionForbiddenMessage("settings", "update", t);
  const selectedResourceId = positiveInteger(searchParams.get("resource"));
  const businessSelected = searchParams.get("target") === "business";
  const activeView: WorkingHoursView = searchParams.get("view") === "resources" || selectedResourceId ? "resources" : "business";
  const rows = workingHours.data || [];
  const activeResources = useMemo(
    () => (resources.data || []).filter((resource) => resource.is_active),
    [resources.data],
  );
  const selectedResource = activeResources.find((resource) => resource.id === selectedResourceId) || null;
  const modalOpen = businessSelected || Boolean(selectedResource);

  const setView = useCallback((view: WorkingHoursView) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("view", view);
      next.delete("resource");
      next.delete("target");
      return next;
    }, { replace: false });
    setResourcePage(1);
  }, [setSearchParams]);

  const updateSelection = useCallback((resource: Resource | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (resource) {
        next.set("view", "resources");
        next.set("resource", String(resource.id));
        next.delete("target");
      } else {
        next.set("view", "business");
        next.delete("resource");
        next.set("target", "business");
      }
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const clearSelection = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("resource");
      next.delete("target");
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const mutation = useMutation({
    mutationFn: async (payloads: Array<Partial<WorkingHours>>) =>
      workingHoursApi.bulkUpsertWeek({
        business: business!.id,
        resource: payloads[0]?.resource ?? null,
        days: payloads.map((payload) => ({
          weekday: Number(payload.weekday),
          start_time: String(payload.start_time || "09:00"),
          end_time: String(payload.end_time || "18:00"),
          is_day_off: Boolean(payload.is_day_off),
        })),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["working-hours"] }),
        queryClient.invalidateQueries({ queryKey: ["available-slots"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      setModalDirty(false);
      showNotification({ message: t("workingHours.savedNotice"), tone: "success" });
    },
  });

  const presetMutation = useMutation({
    mutationFn: () => workingHoursApi.applyPreset({ business: business!.id, preset }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["working-hours"] }),
        queryClient.invalidateQueries({ queryKey: ["available-slots"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      showNotification({ message: t("workingHours.presetNotice").replace("{count}", String(data.count)), tone: "success" });
    },
    onError: (error) => showNotification({ message: getApiErrorMessage(error), tone: "danger" }),
  });

  useEffect(() => {
    setPageHeader({
      title: t("nav.workingHours"),
      secondaryActions: canViewSettings ? [{
        label: t("settings.schedulingCenter"),
        icon: CalendarClock,
        onClick: () => navigate("/app/settings#operations-setup"),
        presentation: "label",
        showOnMobile: true,
      }] : undefined,
      primaryAction: {
        label: t("workingHours.setupWeek"),
        icon: CalendarDays,
        onClick: () => updateSelection(null),
        disabled: !canManage,
        title: !canManage ? permissionMessage : undefined,
      },
    });
    return () => setPageHeader(null);
  }, [canManage, canViewSettings, navigate, permissionMessage, setPageHeader, t, updateSelection]);

  useEffect(() => {
    if (!selectedResourceId || resources.isLoading || selectedResource) return;
    clearSelection();
  }, [clearSelection, resources.isLoading, selectedResource, selectedResourceId]);

  const confirmDiscard = useCallback(async () => {
    if (!modalDirty) return true;
    const result = await confirmAction({
      title: t("workingHours.discardChanges"),
      confirmLabel: t("actions.discardChanges"),
      tone: "warning",
    });
    return result.confirmed;
  }, [confirmAction, modalDirty, t]);

  const closeModal = useCallback(async () => {
    if (!await confirmDiscard()) return;
    setModalDirty(false);
    clearSelection();
  }, [clearSelection, confirmDiscard]);

  async function applyPreset() {
    if (!canManage || presetMutation.isPending) return;
    const result = await confirmAction({
      title: t("workingHours.applyPresetTitle"),
      description: t("workingHours.applyPresetDescription"),
      confirmLabel: t("workingHours.applyPreset"),
    });
    if (result.confirmed) presetMutation.mutate();
  }

  if (!business) return <ErrorState message={t("workingHours.noBusiness")} />;
  if (workingHours.isLoading || resources.isLoading) return <LoadingState />;

  const pageError = workingHours.error || resources.error;
  const businessWeek = weekdayKeys.map((key, weekday) => ({
    key,
    schedule: rows.find((row) => !row.resource && row.weekday === weekday) || null,
  }));
  const businessDays = businessWeek.filter((day) => day.schedule && !day.schedule.is_day_off).length;
  const resourceSummaries: ResourceScheduleSummary[] = activeResources.map((resource) => {
    const ownRows = rows.filter((row) => row.resource === resource.id);
    const effectiveWeek = weekdayKeys.map((_, weekday) => ownRows.find((row) => row.weekday === weekday) || businessWeek[weekday]?.schedule || null);
    return {
      resource,
      individual: ownRows.length > 0,
      workingDays: effectiveWeek.filter((row) => row && !row.is_day_off).length,
    };
  });
  const normalizedSearch = resourceSearch.trim().toLocaleLowerCase();
  const filteredResources = resourceSummaries.filter((item) => {
    if (normalizedSearch && !item.resource.name.toLocaleLowerCase().includes(normalizedSearch)) return false;
    if (scheduleMode === "individual" && !item.individual) return false;
    if (scheduleMode === "business" && item.individual) return false;
    return true;
  });
  const resourceTotalPages = Math.max(1, Math.ceil(filteredResources.length / resourcePageSize));
  const safeResourcePage = Math.min(resourcePage, resourceTotalPages);
  const pagedResources = filteredResources.slice((safeResourcePage - 1) * resourcePageSize, safeResourcePage * resourcePageSize);
  const individualSchedules = resourceSummaries.filter((item) => item.individual).length;
  const dayOffRows = rows.filter((row) => row.is_day_off).length;

  return (
    <CrmWorkspacePage maxWidthClassName="max-w-[1520px]" testId={pageError ? undefined : "working-hours-workspace-ready"}>
      <BusinessWorkspaceNav />
      <section tabIndex={0} aria-label={t("workingHours.metricsLabel")} className="zani-focus-ring mb-3 flex shrink-0 snap-x gap-3 overflow-x-auto rounded-card pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
        <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("workingHours.businessDays")} value={`${businessDays}/7`} hint={t("workingHours.businessDaysHint")} icon={CalendarDays} />
        <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("workingHours.resourceSchedules")} value={`${individualSchedules}/${activeResources.length}`} hint={t("workingHours.resourceSchedulesHint")} icon={UsersRound} />
        <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("workingHours.daysOff")} value={dayOffRows} hint={t("workingHours.daysOffHint")} icon={Clock3} tone="slate" />
      </section>

      {pageError ? (
        <div className="mb-3 shrink-0">
          <ErrorState message={getApiErrorMessage(pageError)} action={<Button type="button" variant="secondary" onClick={() => void Promise.all([workingHours.refetch(), resources.refetch()])}>{t("common.retry")}</Button>} />
        </div>
      ) : null}

      <Tabs<WorkingHoursView>
        value={activeView}
        ariaLabel={t("workingHours.viewsLabel")}
        className="mb-3 shrink-0 self-start"
        options={[
          { value: "business", label: t("workingHours.weekOverview") },
          { value: "resources", label: t("workingHours.staffOverview"), count: activeResources.length },
        ]}
        onChange={setView}
      />

      {activeView === "business" ? (
        <>
          <section className="mb-3 flex shrink-0 flex-col gap-3 rounded-card border border-zani-border bg-surface-card p-3 shadow-card lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface-muted text-zani-subtle"><SlidersHorizontal aria-hidden="true" size={18} /></div>
              <div className="min-w-0"><h2 className="text-sm font-semibold text-zani-ink">{t("workingHours.quickSetup")}</h2><p className="truncate text-xs font-medium text-zani-subtle">{t("workingHours.quickToolbarHint")}</p></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(240px,360px)_auto]">
              <Select aria-label={t("workingHours.presetLabel")} value={preset} disabled={!canManage || presetMutation.isPending} onChange={(event) => setPreset(event.target.value as WorkingHoursPreset)} options={presetOptions.map((item) => ({ value: item.value, label: `${t(item.labelKey)} · ${t(item.descriptionKey)}` }))} />
              <Button type="button" disabled={!canManage} title={!canManage ? permissionMessage : undefined} isLoading={presetMutation.isPending} onClick={() => void applyPreset()}>{t("workingHours.applyPreset")}</Button>
            </div>
          </section>
          <WorkingHoursBusinessView days={businessWeek} onEdit={() => updateSelection(null)} />
        </>
      ) : (
        <WorkingHoursResourcesView
          rows={pagedResources}
          total={filteredResources.length}
          page={safeResourcePage}
          pageSize={resourcePageSize}
          search={resourceSearch}
          scheduleMode={scheduleMode}
          hasResources={activeResources.length > 0}
          onSearchChange={(value) => { setResourceSearch(value); setResourcePage(1); }}
          onScheduleModeChange={(value) => { setScheduleMode(value); setResourcePage(1); }}
          onPageChange={setResourcePage}
          onPageSizeChange={(value) => { setResourcePageSize(value); setResourcePage(1); }}
          onOpen={updateSelection}
        />
      )}

      <WorkingHoursEditModal
        business={business}
        resource={selectedResource}
        resources={activeResources}
        existingHours={rows}
        open={modalOpen}
        canManage={canManage}
        isSaving={mutation.isPending}
        errorMessage={mutation.error ? getApiErrorMessage(mutation.error) : undefined}
        onDirtyChange={setModalDirty}
        onClose={() => { void closeModal(); }}
        onSubmit={(payloads) => mutation.mutateAsync(payloads)}
      />
    </CrmWorkspacePage>
  );
}
