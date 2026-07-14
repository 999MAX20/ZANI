import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CrmWorkspacePage } from "../../components/crm";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { ErrorState, PageSkeleton } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import type { Id, Lead, Task } from "../../types";
import { LeadsActionOverlays } from "./components/LeadsActionOverlays";
import { LeadsModals } from "./components/LeadsModals";
import { LeadsWorkspaceTable } from "./components/LeadsWorkspaceTable";
import { leadTitle } from "./utils/leadFormat";
import { useLeadActions } from "./hooks/useLeadActions";
import { useLeadActionHistory } from "./hooks/useLeadActionHistory";
import { useLeadBulkActions } from "./hooks/useLeadBulkActions";
import { useLeadInteractions } from "./hooks/useLeadInteractions";
import { useLeadsPageHeader } from "./hooks/useLeadsPageHeader";
import { useLeadsTableState } from "./hooks/useLeadsTableState";
import { useLeadsWorkspaceData } from "./hooks/useLeadsWorkspaceData";
import { toDateTimeLocal } from "./utils/leadStorage";

export function LeadsPage() {
  const { t } = useI18n();
  const showNotification = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(searchParams.get("lead")) || null);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "1");
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Id[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lead: Lead } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [nextActionOpen, setNextActionOpen] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: t("leads.nextActionContactClient"),
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });
  const openCreateLead = useCallback(() => setCreateOpen(true), []);
  const setNotice = useCallback((message: string | null, tone: "success" | "info" | "warning" | "danger" = "info") => {
    if (!message) return;
    showNotification({ message, tone });
  }, [showNotification]);
  const { filter, setFilter, source, setSource, search, setSearch, sortByAi, setSortByAi, page, setPage, pageSize, setPageSize, filterPresets, presetName, setPresetName, savedFiltersOpen, setSavedFiltersOpen, moreMenuOpen, setMoreMenuOpen, visibleColumns, setVisibleColumns, columnOrder, savePreset, applyPreset, shareView } = useLeadsTableState({ searchParams, t, onNotice: setNotice });
  const toggleSavedFilters = useCallback(() => setSavedFiltersOpen((value) => !value), [setSavedFiltersOpen]);
  const { pushHistory } = useLeadActionHistory({ t, onNotice: setNotice });

  useLeadsPageHeader({
    t,
    onCreateLead: openCreateLead,
    onToggleFilters: toggleSavedFilters,
  });

  const { business, clients, services, tasks, pageError, pageErrorMessage, isPageLoading, allLeads, rows, pageRows, totalLeadCount, pageCount, safePage, offlineQueue, enqueueOfflineAction, clientList, serviceList, resourceList, teamList, aiInsights, selected, selectedClient, selectedService, selectedNextTask, selectedDeals, selectedAppointments, selectedConversations, selectedAiInsight, filters, pageStart, pageEnd, visiblePages } = useLeadsWorkspaceData({
    filter,
    source,
    search,
    sortByAi,
    page,
    pageSize,
    selectedId,
    t,
    setNotice,
    showWarning: (message) => showNotification({ message, tone: "warning", durationMs: 8_000 }),
  });
  const {
    leadMutation,
    actionMutation,
    bulkContactMutation,
    mergeClientMutation,
    noteMutation,
    nextActionMutation,
    appointmentMutation,
    requestArchiveLeads,
  } = useLeadActions({
    businessId: business?.id,
    selected,
    nextActionDraft,
    t,
    enqueueOfflineAction,
    pushHistory,
    setNotice,
    setSelectedId,
    setCreateOpen,
    setSelectedLeadIds,
    setContextMenu,
    setNextActionOpen,
    setAppointmentOpen,
  });
  const { assignSelected, contactSelected, archiveSelected, resetSelection } = useLeadBulkActions({
    allLeads,
    selectedLeadIds,
    actionMutation,
    bulkContactMutation,
    requestArchiveLeads,
    setSelectedLeadIds,
  });
  const {
    openLead,
    closeDrawer,
    callLead,
    whatsAppLead,
    toggleBulkLead,
    toggleAllPageRows,
    exportRows,
    closeCreateModal,
  } = useLeadInteractions({
    searchParams,
    setSearchParams,
    rows,
    pageRows,
    selected,
    selectedLeadIds,
    clientList,
    serviceList,
    teamList,
    t,
    openCreateLead,
    setCreateOpen,
    setSelectedId,
    setDrawerEntity,
    setContextMenu,
    setShortcutsOpen,
    setSelectedLeadIds,
  });

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (!business) return <ErrorState message={t("leads.noBusiness")} />;
  if (isPageLoading) return <PageSkeleton />;
  if (pageError) return <ErrorState message={pageErrorMessage} />;

  return (
    <CrmWorkspacePage className="h-auto min-h-[calc(100vh-5.5rem)] overflow-visible" contentClassName="flex-none gap-3" maxWidthClassName="max-w-[1520px]">
      <LeadsWorkspaceTable
        filters={filters}
        filter={filter}
        search={search}
        source={source}
        savedFiltersOpen={savedFiltersOpen}
        filterPresets={filterPresets}
        presetName={presetName}
        moreMenuOpen={moreMenuOpen}
        columnOrder={columnOrder}
        visibleColumns={visibleColumns}
        rows={rows}
        pageRows={pageRows}
        selected={selected}
        selectedLeadIds={selectedLeadIds}
        clientList={clientList}
        serviceList={serviceList}
        teamList={teamList}
        aiInsights={aiInsights}
        allLeads={allLeads}
        safePage={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        visiblePages={visiblePages}
        pageStart={pageStart}
        pageEnd={pageEnd}
        totalLeadCount={totalLeadCount}
        t={t}
        onFilterChange={(nextFilter) => {
          setFilter(nextFilter);
          setPage(1);
        }}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onSourceChange={(value) => {
          setSource(value);
          setPage(1);
        }}
        onToggleSavedFilters={toggleSavedFilters}
        onApplyPreset={(preset) => {
          applyPreset(preset);
          setSavedFiltersOpen(false);
        }}
        onPresetNameChange={setPresetName}
        onSavePreset={savePreset}
        onToggleMoreMenu={() => setMoreMenuOpen((value) => !value)}
        onToggleColumn={(column) => setVisibleColumns((value) => ({ ...value, [column]: !value[column] }))}
        onToggleSortByAi={() => setSortByAi((value) => !value)}
        onExportCsv={() => exportRows("csv")}
        onExportExcel={() => exportRows("excel")}
        onShareView={shareView}
        onOpenImport={() => { window.location.href = "/app/integrations"; }}
        onOpenCreate={openCreateLead}
        onOpenLead={openLead}
        onToggleBulkLead={toggleBulkLead}
        onToggleAllPageRows={toggleAllPageRows}
        onAssignLead={(lead, userId) => actionMutation.mutate({ action: "assign", lead, user_id: userId })}
        onCallLead={callLead}
        onWhatsAppLead={whatsAppLead}
        onOpenContextMenu={(event, lead) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY, lead });
        }}
        onArchiveLead={(lead) => void requestArchiveLeads([lead])}
        onTakeLead={(lead) => actionMutation.mutate({ action: "take", lead })}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />

      <LeadsActionOverlays
        contextMenu={contextMenu}
        selectedLeadIds={selectedLeadIds}
        teamList={teamList}
        t={t}
        onCloseContextMenu={() => setContextMenu(null)}
        onOpenLead={openLead}
        onCallLead={callLead}
        onWhatsAppLead={whatsAppLead}
        onTakeLead={(lead) => actionMutation.mutate({ action: "take", lead })}
        onArchiveLead={(lead) => void requestArchiveLeads([lead])}
        onAssignSelected={assignSelected}
        onContactSelected={contactSelected}
        onArchiveSelected={archiveSelected}
        onResetSelection={resetSelection}
      />

      <LeadsModals
        businessId={business.id}
        shortcutsOpen={shortcutsOpen}
        createOpen={createOpen}
        appointmentOpen={appointmentOpen}
        nextActionOpen={nextActionOpen}
        lostLead={lostLead}
        lostReason={lostReason}
        selected={selected}
        nextActionDraft={nextActionDraft}
        clientList={clientList}
        serviceList={serviceList}
        resourceList={resourceList}
        teamList={teamList}
        allLeads={allLeads}
        nextActionPending={nextActionMutation.isPending}
        lostPending={actionMutation.isPending}
        t={t}
        onCloseShortcuts={() => setShortcutsOpen(false)}
        onCloseCreate={closeCreateModal}
        onCreateLead={(payload) => leadMutation.mutateAsync(payload)}
        onOpenClient={(id) => {
          setCreateOpen(false);
          setDrawerEntity({ type: "client", id });
        }}
        onCloseAppointment={() => setAppointmentOpen(false)}
        onCreateAppointment={(payload) => appointmentMutation.mutateAsync(payload)}
        onCloseNextAction={() => setNextActionOpen(false)}
        onNextActionDraftChange={setNextActionDraft}
        onCreateNextAction={() => selected && nextActionMutation.mutate(selected)}
        onCloseLost={() => setLostLead(null)}
        onLostReasonChange={setLostReason}
        onSubmitLost={() => {
          if (!lostLead) return;
          actionMutation.mutate({ action: "lost", lead: lostLead, lost_reason: lostReason });
          setLostLead(null);
          setLostReason("");
        }}
      />

      <CrmEntityDrawer entity={drawerEntity} onClose={closeDrawer} />
    </CrmWorkspacePage>
  );
}

