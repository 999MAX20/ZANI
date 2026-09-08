import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3, Plus, Search, Scissors, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { appointmentsApi } from "../../api/appointments";
import { getApiErrorMessage } from "../../api/client";
import { servicesApi } from "../../api/services";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { CrmPagination, CrmWorkspacePage } from "../../components/crm";
import { ServiceForm } from "../../components/forms/ServiceForm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { DataTable } from "../../components/tables/DataTable";
import type { DataTableRowInteraction } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { MetricCard } from "../../components/ui/MetricCard";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { formatMoney } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { hasPermission, permissionForbiddenMessage } from "../../lib/permissions";
import type { Id, Service } from "../../types";
import { useAuth } from "../auth/AuthProvider";
import { BusinessWorkspaceNav } from "../business/components/BusinessWorkspaceNav";
import { ServiceActionsMenu } from "./components/ServiceActionsMenu";
import { ServiceEditModal } from "./components/ServiceEditModal";
import { ServiceStatusBadge } from "./components/ServiceStatusBadge";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = new Set([10, 20, 30, 50, 100]);

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function ServicesPage() {
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
  const [inspectorDirty, setInspectorDirty] = useState(false);

  const search = searchParams.get("search") || "";
  const [searchDraft, setSearchDraft] = useState(search);
  const statusParam = searchParams.get("status");
  const status = statusParam === "active" || statusParam === "inactive" || (statusParam === "archived" && canManage)
    ? statusParam
    : "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const requestedPageSize = positiveInteger(searchParams.get("page_size"), DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZES.has(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const selectedServiceId = positiveInteger(searchParams.get("service"), 0) || null;

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
      updateSearchParams({ search: searchDraft.trim() || null, page: 1, service: null });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search, searchDraft, updateSearchParams]);

  const overviewQuery = useQuery({
    queryKey: ["services", "overview", business?.id],
    queryFn: () => servicesApi.listPage({ business: business!.id, page_size: 100 }),
    enabled: Boolean(business?.id),
  });
  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "services-workspace", business?.id],
    queryFn: () => appointmentsApi.list({ business: business!.id, page_size: 100 }),
    enabled: Boolean(business?.id),
  });
  const servicesQuery = useQuery({
    queryKey: ["services", "workspace", business?.id, search, status, page, pageSize],
    queryFn: () => servicesApi.listPage({
      business: business!.id,
      search: search || undefined,
      status,
      page,
      page_size: pageSize,
    }),
    enabled: Boolean(business?.id),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id?: Id; payload: Partial<Service> }) =>
      id ? servicesApi.update({ id, payload }) : servicesApi.create(payload),
    onSuccess: async (_service, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      setInspectorDirty(false);
      if (variables.id) {
        showNotification({ message: t("services.noticeSaved"), tone: "success" });
      } else {
        setCreateOpen(false);
        showNotification({ message: t("services.noticeCreated"), tone: "success" });
      }
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: async ({ service, action, reason }: {
      service: Service;
      action: "activate" | "deactivate" | "archive" | "restore";
      reason?: string;
    }) => {
      if (action === "activate") return servicesApi.activate(service.id);
      if (action === "deactivate") return servicesApi.deactivate(service.id);
      if (action === "restore") return servicesApi.restore(service.id);
      return servicesApi.archive({ id: service.id, reason: reason || "" });
    },
    onSuccess: async (updatedService, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["services"] }),
        queryClient.invalidateQueries({ queryKey: ["available-slots"] }),
      ]);
      const remainsVisible = status === "archived"
        ? updatedService.is_archived
        : status === "active"
          ? updatedService.is_active && !updatedService.is_archived
          : status === "inactive"
            ? !updatedService.is_active && !updatedService.is_archived
            : !updatedService.is_archived;
      if (selectedServiceId === updatedService.id && !remainsVisible) {
        setInspectorDirty(false);
        updateSearchParams({ service: null });
      }
      const noticeKey = {
        activate: "services.noticeActivated",
        deactivate: "services.noticeDeactivated",
        archive: "services.noticeArchived",
        restore: "services.noticeRestored",
      }[variables.action];
      showNotification({ message: t(noticeKey), tone: "success" });
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

  const serviceRows = servicesQuery.data?.results || [];
  const totalServices = servicesQuery.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalServices / pageSize));
  const selectedService = serviceRows.find((service) => service.id === selectedServiceId) || null;

  useEffect(() => {
    if (servicesQuery.isLoading || servicesQuery.isFetching) return;
    if (page > totalPages) {
      updateSearchParams({ page: totalPages, service: null });
      return;
    }
    if (selectedServiceId && !selectedService) {
      updateSearchParams({ service: null });
      return;
    }
  }, [page, selectedService, selectedServiceId, servicesQuery.isFetching, servicesQuery.isLoading, totalPages, updateSearchParams]);

  const overviewServices = overviewQuery.data?.results || [];
  const activeServices = overviewServices.filter((service) => service.is_active);
  const avgDuration = activeServices.length
    ? Math.round(activeServices.reduce((sum, service) => sum + service.duration_minutes, 0) / activeServices.length)
    : 0;
  const appointmentUsage = useMemo(() => {
    const usage = new Map<Id, number>();
    (appointmentsQuery.data || []).forEach((appointment) => {
      usage.set(appointment.service, (usage.get(appointment.service) || 0) + 1);
    });
    return usage;
  }, [appointmentsQuery.data]);
  const usedServiceIds = new Set(appointmentUsage.keys());
  const permissionMessage = permissionForbiddenMessage("settings", "update", t);

  useEffect(() => {
    setPageHeader({
      title: t("nav.services"),
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
        label: t("services.add"),
        icon: Plus,
        onClick: () => setCreateOpen(true),
        disabled: !canManage,
        title: !canManage ? permissionMessage : undefined,
      },
    });
    return () => setPageHeader(null);
  }, [canManage, canViewSettings, navigate, permissionMessage, setPageHeader, t]);

  const confirmDiscard = useCallback(async () => {
    if (!inspectorDirty) return true;
    const result = await confirmAction({
      title: t("services.discardChanges"),
      confirmLabel: t("actions.discardChanges"),
      tone: "warning",
    });
    return result.confirmed;
  }, [confirmAction, inspectorDirty, t]);

  const selectService = useCallback(async (service: Service) => {
    if (service.id === selectedServiceId) return;
    if (!await confirmDiscard()) return;
    setInspectorDirty(false);
    updateSearchParams({ service: service.id }, false);
  }, [confirmDiscard, selectedServiceId, updateSearchParams]);

  const closeInspector = useCallback(async () => {
    if (!await confirmDiscard()) return false;
    setInspectorDirty(false);
    updateSearchParams({ service: null }, false);
    return true;
  }, [confirmDiscard, updateSearchParams]);

  const handleServiceRowSelect = useCallback((service: Service, _index: number, _interaction: DataTableRowInteraction) => {
    void selectService(service);
  }, [selectService]);

  const activateService = useCallback((service: Service) => {
    lifecycleMutation.mutate({ service, action: "activate" });
  }, [lifecycleMutation]);

  const restoreService = useCallback((service: Service) => {
    lifecycleMutation.mutate({ service, action: "restore" });
  }, [lifecycleMutation]);

  const deactivateService = useCallback(async (service: Service) => {
    const result = await confirmAction({
      title: t("services.deactivateTitle"),
      description: t("services.deactivateDescription", { name: service.name }),
      confirmLabel: t("services.actionDeactivate"),
      tone: "warning",
    });
    if (result.confirmed) lifecycleMutation.mutate({ service, action: "deactivate" });
  }, [confirmAction, lifecycleMutation, t]);

  const archiveService = useCallback(async (service: Service) => {
    const result = await confirmAction({
      title: t("services.archiveTitle"),
      description: t("services.archiveDescription", { name: service.name }),
      confirmLabel: t("services.actionArchive"),
      tone: "warning",
      reason: {
        label: t("services.archiveReason"),
        placeholder: t("services.archiveReasonPlaceholder"),
      },
    });
    if (result.confirmed) {
      lifecycleMutation.mutate({ service, action: "archive", reason: result.reason });
    }
  }, [confirmAction, lifecycleMutation, t]);

  if (!business) return <ErrorState message={t("services.noBusiness")} />;
  if (overviewQuery.isLoading || appointmentsQuery.isLoading || servicesQuery.isLoading) return <LoadingState />;

  const pageError = overviewQuery.error || appointmentsQuery.error || servicesQuery.error;
  const hasFilters = Boolean(search || status);
  const pageFrom = totalServices === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageTo = Math.min(totalServices, page * pageSize);

  return (
    <>
      <CrmWorkspacePage maxWidthClassName="max-w-[1520px]" testId={pageError ? undefined : "services-workspace-ready"}>
        <BusinessWorkspaceNav />
        <section
          tabIndex={0}
          aria-label={t("services.metricsLabel")}
          className="zani-focus-ring mb-3 flex shrink-0 snap-x gap-3 overflow-x-auto rounded-card pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0"
        >
          <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("services.active")} value={activeServices.length} hint={t("services.activeHint")} icon={Scissors} />
          <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("services.avgDuration")} value={avgDuration ? `${avgDuration} ${t("appointment.minutes")}` : "-"} hint={t("services.avgDurationHint")} icon={Clock3} />
          <MetricCard compact className="min-w-[220px] snap-start lg:min-w-0" label={t("services.usedInBookings")} value={usedServiceIds.size} hint={t("services.usedInBookingsHint")} icon={WalletCards} />
        </section>

        {pageError ? (
          <div className="mb-3 shrink-0">
            <ErrorState
              message={getApiErrorMessage(pageError)}
              action={<Button type="button" variant="secondary" onClick={() => void Promise.all([overviewQuery.refetch(), appointmentsQuery.refetch(), servicesQuery.refetch()])}>{t("common.retry")}</Button>}
            />
          </div>
        ) : null}

        <div data-testid="services-operational-workspace" className="min-h-[420px] flex-1">
          <DataTable
              className="h-full"
              contentClassName="overscroll-contain"
              rows={serviceRows}
              rowKey={(service) => service.id}
              selectedRowKey={selectedService?.id}
              onRowSelect={handleServiceRowSelect}
              rowAriaLabel={(service) => t("services.selectService", { name: service.name })}
              rowFocusReturnId={(service) => `service-row-${service.id}`}
              rowTestId={() => "service-row"}
              rowClassName={(service) => service.is_archived ? "opacity-70" : undefined}
              tableLabel={t("services.tableLabel")}
              hideFooter
              emptyTitle={hasFilters ? t("services.noResultsTitle") : t("services.emptyTitle")}
              emptyDescription={hasFilters ? t("services.noResultsText") : t("services.emptyText")}
              emptyAction={
                hasFilters ? (
                  <Button type="button" variant="secondary" onClick={() => { setSearchDraft(""); updateSearchParams({ search: null, status: null, page: 1, service: null }); }}>{t("common.clearAll")}</Button>
                ) : (
                  <Button type="button" variant="secondary" disabled={!canManage} title={!canManage ? permissionMessage : undefined} onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden="true" size={16} />{t("services.add")}
                  </Button>
                )
              }
              toolbar={
                <div
                  data-testid="services-table-toolbar"
                  data-toolbar-layout="standard"
                  className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="w-full min-w-0 sm:w-80 xl:w-[22rem]">
                      <Input
                        data-testid="services-search"
                        value={searchDraft}
                        leftIcon={<Search aria-hidden="true" size={17} />}
                        aria-label={t("services.searchPlaceholder")}
                        placeholder={t("services.searchPlaceholder")}
                        onChange={(event) => setSearchDraft(event.target.value)}
                      />
                    </div>
                    <div className="w-full shrink-0 sm:w-48">
                      <Select
                        aria-label={t("services.statusFilter")}
                        value={status}
                        options={[
                          { value: "", label: t("services.allStatuses") },
                          { value: "active", label: t("services.activeOnly") },
                          { value: "inactive", label: t("services.inactiveOnly") },
                          ...(canManage ? [{ value: "archived", label: t("services.archivedOnly") }] : []),
                        ]}
                        onChange={(event) => updateSearchParams({ status: event.target.value || null, page: 1, service: null })}
                      />
                    </div>
                  </div>
                  <CrmPagination
                    variant="toolbar"
                    className="w-full border-t border-zani-border pt-3 xl:w-auto xl:border-t-0 xl:pt-0"
                    shown={serviceRows.length}
                    total={totalServices}
                    page={page}
                    pageSize={pageSize}
                    rangeLabel={t("pagination.range", { from: pageFrom, to: pageTo, total: totalServices })}
                    previousLabel={t("pagination.previous")}
                    nextLabel={t("pagination.next")}
                    pageSizeLabel={(size) => t("pagination.pageSize", { size })}
                    pageSizeAriaLabel={t("pagination.pageSizeAriaLabel")}
                    onPageChange={(nextPage) => updateSearchParams({ page: nextPage, service: null }, false)}
                    onPageSizeChange={(nextPageSize) => updateSearchParams({ page_size: nextPageSize, page: 1, service: null })}
                  />
                </div>
              }
              columns={[
                { header: t("services.name"), className: "max-w-[320px]", cell: (service) => <span data-testid="service-name" className="block truncate font-semibold text-zani-ink">{service.name}</span> },
                { header: t("services.duration"), cell: (service) => `${service.duration_minutes} ${t("appointment.minutes")}` },
                { header: t("services.priceFrom"), cell: (service) => formatMoney(service.price_from) },
                { header: t("services.bookings"), cell: (service) => appointmentUsage.get(service.id) || 0 },
                { header: t("appointment.status"), cell: (service) => <ServiceStatusBadge service={service} /> },
                {
                  header: t("appointments.actions"),
                  className: "w-16 text-right",
                  cell: (service) => (
                    <ServiceActionsMenu
                      service={service}
                      canManage={canManage}
                      isPending={lifecycleMutation.isPending}
                      onOpen={() => void selectService(service)}
                      onActivate={() => activateService(service)}
                      onDeactivate={() => void deactivateService(service)}
                      onArchive={() => void archiveService(service)}
                      onRestore={() => restoreService(service)}
                    />
                  ),
                },
              ]}
          />
        </div>
      </CrmWorkspacePage>

      <ServiceEditModal
        service={selectedService}
        businessId={business.id}
        appointmentCount={selectedService ? appointmentUsage.get(selectedService.id) || 0 : 0}
        canManage={canManage}
        isSaving={mutation.isPending || lifecycleMutation.isPending}
        errorMessage={mutation.error ? actionErrorMessage : undefined}
        onDirtyChange={setInspectorDirty}
        onClose={() => { void closeInspector(); }}
        onSubmit={(payload) => mutation.mutateAsync({ id: selectedService!.id, payload })}
      />

      <Modal title={t("services.add")} open={createOpen} onClose={() => { if (!mutation.isPending) setCreateOpen(false); }}>
        <ServiceForm businessId={business.id} disabled={!canManage} onSubmit={(payload) => mutation.mutateAsync({ payload })} />
      </Modal>
    </>
  );
}
