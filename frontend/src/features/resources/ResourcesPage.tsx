import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarClock, Plus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { getApiErrorMessage } from "../../api/client";
import { resourcesApi } from "../../api/resources";
import { teamApi } from "../../api/team";
import { workingHoursApi } from "../../api/workingHours";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { CrmWorkspacePage } from "../../components/crm";
import { ResourceForm } from "../../components/forms/ResourceForm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { DataTable } from "../../components/tables/DataTable";
import type { DataTableRowInteraction } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { MetricCard } from "../../components/ui/MetricCard";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useI18n } from "../../lib/i18n";
import { hasPermission, permissionForbiddenMessage } from "../../lib/permissions";
import type { Id, Resource } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { BusinessWorkspaceNav } from "../business/components/BusinessWorkspaceNav";
import { ResourceActionsMenu } from "./components/ResourceActionsMenu";
import { ResourceEditModal } from "./components/ResourceEditModal";
import { ResourceStatusBadge } from "./components/ResourceStatusBadge";
import { ResourcesToolbar, resourceTypeLabelKeys } from "./components/ResourcesToolbar";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = new Set([10, 20, 30, 50, 100]);
const RESOURCE_TYPES = new Set<Resource["resource_type"]>(["staff", "room", "hall", "box", "equipment", "other"]);

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validResourceType(value: string | null): Resource["resource_type"] | "" {
  return value && RESOURCE_TYPES.has(value as Resource["resource_type"])
    ? value as Resource["resource_type"]
    : "";
}

export function ResourcesPage() {
  const { t } = useI18n();
  const showNotification = useNotification();
  const confirmAction = useActionConfirm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setPageHeader } = usePageHeader();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const canManage = hasPermission(user, business?.id, "settings", "update");
  const canViewSettings = hasPermission(user, business?.id, "settings", "view");
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<Partial<Resource> | undefined>();
  const [selectedTemplate, setSelectedTemplate] = useState("staff");
  const [inspectorDirty, setInspectorDirty] = useState(false);

  const search = searchParams.get("search") || "";
  const [searchDraft, setSearchDraft] = useState(search);
  const resourceType = validResourceType(searchParams.get("type"));
  const statusParam = searchParams.get("status");
  const status = statusParam === "active" || statusParam === "inactive" ? statusParam : "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const requestedPageSize = positiveInteger(searchParams.get("page_size"), DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const selectedResourceId = positiveInteger(searchParams.get("resource"), 0) || null;

  const updateSearchParams = useCallback((updates: Record<string, string | number | null>, replace = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    if (searchDraft === search) return undefined;
    const timeoutId = window.setTimeout(() => {
      updateSearchParams({ search: searchDraft.trim() || null, page: 1, resource: null });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search, searchDraft, updateSearchParams]);

  const resourcesQuery = useQuery({
    queryKey: ["resources", "workspace", business?.id, search, resourceType, status, page, pageSize],
    queryFn: () => resourcesApi.listPage({
      business: business!.id,
      search: search || undefined,
      resource_type: resourceType,
      status,
      page,
      page_size: pageSize,
    }),
    enabled: Boolean(business?.id),
    placeholderData: keepPreviousData,
  });
  const teamMembersQuery = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: () => teamApi.members(business!.id),
    enabled: Boolean(business?.id),
  });

  const resourceRows = resourcesQuery.data?.results || [];
  const totalResources = resourcesQuery.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalResources / pageSize));
  const selectedResource = resourceRows.find((resource) => resource.id === selectedResourceId) || null;
  const activeTeamMembers = (teamMembersQuery.data || []).filter((member) => member.is_active);

  const workingHoursQuery = useQuery({
    queryKey: ["working-hours", "resource-modal", business?.id, selectedResourceId],
    queryFn: () => workingHoursApi.list({ business: business!.id, resource: selectedResourceId! }),
    enabled: Boolean(business?.id && selectedResourceId),
  });

  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id?: Id; payload: Partial<Resource> }) =>
      id ? resourcesApi.update({ id, payload }) : resourcesApi.create(payload),
    onSuccess: async (_resource, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      setInspectorDirty(false);
      if (variables.id) {
        showNotification({ message: t("resources.noticeSaved"), tone: "success" });
      } else {
        setCreateOpen(false);
        setCreateDraft(undefined);
        showNotification({ message: t("resources.noticeCreated"), tone: "success" });
      }
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ resource, isActive }: { resource: Resource; isActive: boolean }) =>
      resourcesApi.update({ id: resource.id, payload: { is_active: isActive } }),
    onSuccess: async (_resource, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      showNotification({
        message: t(variables.isActive ? "resources.noticeActivated" : "resources.noticeDeactivated"),
        tone: "success",
      });
    },
    onError: (error) => {
      showNotification({ message: getApiErrorMessage(error), tone: "danger" });
    },
  });
  const actionErrorMessage = mutation.error ? getApiErrorMessage(mutation.error) : "";

  useEffect(() => {
    if (!actionErrorMessage) return;
    showNotification({ message: actionErrorMessage, tone: "danger" });
  }, [actionErrorMessage, showNotification]);

  useEffect(() => {
    if (resourcesQuery.isLoading || resourcesQuery.isFetching) return;
    if (page > totalPages) {
      updateSearchParams({ page: totalPages, resource: null });
      return;
    }
    if (selectedResourceId && !selectedResource) {
      updateSearchParams({ resource: null });
      return;
    }
  }, [page, resourcesQuery.isFetching, resourcesQuery.isLoading, selectedResource, selectedResourceId, totalPages, updateSearchParams]);

  const permissionMessage = permissionForbiddenMessage("settings", "update", t);

  useEffect(() => {
    setPageHeader({
      title: t("nav.resources"),
      secondaryActions: canViewSettings
        ? [
            {
              label: t("settings.schedulingCenter"),
              icon: CalendarClock,
              onClick: () => navigate("/app/settings#operations-setup"),
              presentation: "label",
              showOnMobile: true,
            },
          ]
        : undefined,
      primaryAction: {
        label: t("resources.add"),
        icon: Plus,
        onClick: () => {
          setCreateDraft(undefined);
          setCreateOpen(true);
        },
        disabled: !canManage,
        title: !canManage ? permissionMessage : undefined,
      },
    });
    return () => setPageHeader(null);
  }, [canManage, canViewSettings, navigate, permissionMessage, setPageHeader, t]);

  const confirmDiscard = useCallback(async () => {
    if (!inspectorDirty) return true;
    const result = await confirmAction({
      title: t("resources.discardChanges"),
      confirmLabel: t("actions.discardChanges"),
      tone: "warning",
    });
    return result.confirmed;
  }, [confirmAction, inspectorDirty, t]);

  const selectResource = useCallback(async (resource: Resource) => {
    if (resource.id === selectedResourceId) return;
    if (!await confirmDiscard()) return;
    setInspectorDirty(false);
    updateSearchParams({ resource: resource.id }, false);
  }, [confirmDiscard, selectedResourceId, updateSearchParams]);

  const closeInspector = useCallback(async () => {
    if (!await confirmDiscard()) return false;
    setInspectorDirty(false);
    updateSearchParams({ resource: null }, false);
    return true;
  }, [confirmDiscard, updateSearchParams]);

  const openSelectedResourceSchedule = useCallback(async () => {
    if (!selectedResource || !await confirmDiscard()) return;
    setInspectorDirty(false);
    navigate(`/app/business/working-hours?view=resources&resource=${selectedResource.id}`);
  }, [confirmDiscard, navigate, selectedResource]);

  const handleResourceRowSelect = useCallback((resource: Resource, _index: number, _interaction: DataTableRowInteraction) => {
    void selectResource(resource);
  }, [selectResource]);

  const deactivateResource = useCallback(async (resource: Resource) => {
    const result = await confirmAction({
      title: t("resources.deactivateTitle"),
      description: t("resources.deactivateDescription", { name: resource.name }),
      confirmLabel: t("resources.actionDeactivate"),
      tone: "warning",
    });
    if (result.confirmed) statusMutation.mutate({ resource, isActive: false });
  }, [confirmAction, statusMutation, t]);

  const templates: Record<string, Partial<Resource>> = {
    staff: { name: t("resources.templateMasterName"), resource_type: "staff", is_active: true },
    equipment: { name: t("resources.templateChairName"), resource_type: "equipment", is_active: true },
    room: { name: t("resources.templateRoomName"), resource_type: "room", is_active: true },
    box: { name: t("resources.templateBoxName"), resource_type: "box", is_active: true },
  };

  function openTemplate() {
    if (!canManage) return;
    setCreateDraft(templates[selectedTemplate] || templates.staff);
    setCreateOpen(true);
  }

  if (!business) return <ErrorState message={t("resources.noBusiness")} />;
  if (resourcesQuery.isLoading || teamMembersQuery.isLoading) return <LoadingState />;

  const pageError = resourcesQuery.error || teamMembersQuery.error;
  const hasFilters = Boolean(search || resourceType || status);
  const pageFrom = totalResources === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageTo = Math.min(totalResources, page * pageSize);
  const summary = resourcesQuery.data?.summary || {
    active: resourceRows.filter((resource) => resource.is_active).length,
    staff: resourceRows.filter((resource) => resource.is_active && resource.resource_type === "staff").length,
    with_individual_schedule: resourceRows.filter((resource) => resource.is_active && resource.has_individual_schedule).length,
  };

  return (
    <>
      <CrmWorkspacePage maxWidthClassName="max-w-[1520px]" testId={pageError ? undefined : "resources-workspace-ready"}>
        <BusinessWorkspaceNav />
        <section
          tabIndex={0}
          aria-label={t("resources.metricsLabel")}
          className="zani-focus-ring mb-3 flex shrink-0 snap-x gap-3 overflow-x-auto rounded-card pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0"
        >
          <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("resources.active")} value={summary.active} hint={t("resources.activeHint")} icon={UsersRound} />
          <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("resources.staff")} value={summary.staff} hint={t("resources.staffHint")} icon={BriefcaseBusiness} />
          <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("resources.withSchedule")} value={`${summary.with_individual_schedule}/${summary.active}`} hint={t("resources.withScheduleHint")} icon={CalendarClock} />
        </section>

        {pageError ? (
          <div className="mb-3 shrink-0">
            <ErrorState
              message={getApiErrorMessage(pageError)}
              action={<Button type="button" variant="secondary" onClick={() => void Promise.all([resourcesQuery.refetch(), teamMembersQuery.refetch()])}>{t("common.retry")}</Button>}
            />
          </div>
        ) : null}

        <div data-testid="resources-operational-workspace" className="min-h-[420px] flex-1">
            <DataTable
              className="h-full"
              contentClassName="overscroll-contain"
              rows={resourceRows}
              rowKey={(resource) => resource.id}
              selectedRowKey={selectedResource?.id}
              onRowSelect={handleResourceRowSelect}
              rowAriaLabel={(resource) => t("resources.selectResource", { name: resource.name })}
              rowFocusReturnId={(resource) => `resource-row-${resource.id}`}
              rowTestId={() => "resource-row"}
              tableLabel={t("resources.tableLabel")}
              hideFooter
              emptyTitle={hasFilters ? t("resources.noResultsTitle") : t("resources.emptyTitle")}
              emptyDescription={hasFilters ? t("resources.noResultsText") : t("resources.emptyText")}
              emptyAction={
                hasFilters ? (
                  <Button type="button" variant="secondary" onClick={() => { setSearchDraft(""); updateSearchParams({ search: null, type: null, status: null, page: 1, resource: null }); }}>{t("common.clearAll")}</Button>
                ) : (
                  <Button type="button" variant="secondary" disabled={!canManage} title={!canManage ? permissionMessage : undefined} onClick={() => { setCreateDraft(undefined); setCreateOpen(true); }}>
                    <Plus aria-hidden="true" size={16} />{t("resources.add")}
                  </Button>
                )
              }
              toolbar={
                <ResourcesToolbar
                  searchDraft={searchDraft}
                  resourceType={resourceType}
                  status={status}
                  template={selectedTemplate}
                  canManage={canManage}
                  permissionMessage={permissionMessage}
                  isSplitWorkspace={false}
                  shown={resourceRows.length}
                  total={totalResources}
                  page={page}
                  pageSize={pageSize}
                  rangeLabel={t("pagination.range", { from: pageFrom, to: pageTo, total: totalResources })}
                  onSearchChange={setSearchDraft}
                  onResourceTypeChange={(value) => updateSearchParams({ type: value || null, page: 1, resource: null })}
                  onStatusChange={(value) => updateSearchParams({ status: value || null, page: 1, resource: null })}
                  onTemplateChange={setSelectedTemplate}
                  onUseTemplate={openTemplate}
                  onPageChange={(nextPage) => updateSearchParams({ page: nextPage, resource: null }, false)}
                  onPageSizeChange={(nextPageSize) => updateSearchParams({ page_size: nextPageSize, page: 1, resource: null })}
                />
              }
              columns={[
                { header: t("resources.name"), className: "max-w-[300px]", cell: (resource) => <span data-testid="resource-name" className="block truncate font-semibold text-zani-ink">{resource.name}</span> },
                { header: t("resources.type"), cell: (resource) => t(resourceTypeLabelKeys[resource.resource_type]) },
                { header: t("resources.linkedUser"), className: "max-w-[220px]", cell: (resource) => <span className="block truncate">{resource.linked_user_name || resource.linked_user_email || t("resources.noLinkedUser")}</span> },
                { header: t("resources.bookings"), cell: (resource) => resource.appointment_count || 0 },
                { header: t("resources.scheduleState"), cell: (resource) => t(resource.has_individual_schedule ? "resources.individualSchedule" : "resources.businessSchedule") },
                { header: t("appointment.status"), cell: (resource) => <ResourceStatusBadge resource={resource} /> },
                {
                  header: t("appointments.actions"),
                  className: "w-16 text-right",
                  cell: (resource) => (
                    <ResourceActionsMenu
                      resource={resource}
                      canManage={canManage}
                      isPending={statusMutation.isPending}
                      onOpen={() => void selectResource(resource)}
                      onActivate={() => statusMutation.mutate({ resource, isActive: true })}
                      onDeactivate={() => void deactivateResource(resource)}
                    />
                  ),
                },
              ]}
            />
        </div>
      </CrmWorkspacePage>

      <ResourceEditModal
        resource={selectedResource}
        businessId={business.id}
        teamMembers={activeTeamMembers}
        workingHours={workingHoursQuery.data || []}
        scheduleLoading={workingHoursQuery.isLoading}
        scheduleError={workingHoursQuery.error ? getApiErrorMessage(workingHoursQuery.error) : undefined}
        canManage={canManage}
        isSaving={mutation.isPending || statusMutation.isPending}
        errorMessage={mutation.error ? actionErrorMessage : undefined}
        onDirtyChange={setInspectorDirty}
        onClose={() => { void closeInspector(); }}
        onOpenSchedule={() => { void openSelectedResourceSchedule(); }}
        onSubmit={(payload) => mutation.mutateAsync({ id: selectedResource!.id, payload })}
      />

      <Modal
        title={t("resources.add")}
        open={createOpen}
        onClose={() => {
          if (mutation.isPending) return;
          setCreateOpen(false);
          setCreateDraft(undefined);
        }}
      >
        <ResourceForm
          businessId={business.id}
          initial={createDraft}
          teamMembers={activeTeamMembers}
          disabled={!canManage}
          onSubmit={(payload) => mutation.mutateAsync({ payload })}
        />
      </Modal>
    </>
  );
}
