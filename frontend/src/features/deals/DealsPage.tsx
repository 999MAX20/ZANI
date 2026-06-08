import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";

import { dealsApi } from "../../api/deals";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { WorkQueueDetailPane, WorkQueueLayout, WorkQueueListPane } from "../../components/layout/WorkQueueLayout";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import type { Deal, Id } from "../../types";
import { DealsAIPriority } from "./components/DealsAIPriority";
import { DealDetailPanel } from "./components/DealDetailPanel";
import { DealsFilters } from "./components/DealsFilters";
import { DealsHeader } from "./components/DealsHeader";
import { DealsList } from "./components/DealsList";
import { DealsMetrics } from "./components/DealsMetrics";
import { DealActionModal, CreateDealModal, NextActionModal } from "./components/DealModals";
import { DealsToolbar } from "./components/DealsToolbar";
import { useDealActions } from "./hooks/useDealActions";
import { useDealFilters } from "./hooks/useDealFilters";
import { useDealMetrics } from "./hooks/useDealMetrics";
import { useDealSelection } from "./hooks/useDealSelection";
import { useDeals } from "./hooks/useDeals";
import type { DealSortKey, DealViewMode } from "./types";

export function DealsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business, data, isLoading } = useDeals();
  const { filters, updateFilters, resetFilters, activeFilterCount } = useDealFilters();
  const { activePipeline, activeStages, rows, metrics } = useDealMetrics(data, filters);
  const [viewMode, setViewMode] = useState<DealViewMode>("list");
  const [sortKey, setSortKey] = useState<DealSortKey>("priority");
  const [sortAsc, setSortAsc] = useState(false);
  const sortedRows = useMemo(() => {
    const getValue = (deal: Deal) => (sortKey === "amount" ? Number(deal.amount || 0) : sortKey === "priority" ? "riskPercent" in deal ? deal.riskPercent : 0 : new Date(deal.updated_at).getTime());
    return [...rows].sort((a, b) => (Number(getValue(a)) - Number(getValue(b))) * (sortAsc ? 1 : -1));
  }, [rows, sortAsc, sortKey]);
  const selection = useDealSelection(sortedRows);
  const actions = useDealActions({ businessId: business?.id, activeStages, tasksByDeal: data.tasksByDeal, onSelect: selection.openDeal, t });
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);

  const selectedTasks = selection.selectedDeal ? data.tasksByDeal.get(selection.selectedDeal.id) || [] : [];
  const selectedConversations = selection.selectedDeal
    ? data.conversations.filter((conversation) => conversation.deal === selection.selectedDeal?.id || conversation.client === selection.selectedDeal?.client)
    : [];
  const selectedTimeline = selection.selectedDeal
    ? data.activityEvents.filter((event) => event.entity_type === "Deal" && event.entity_id === String(selection.selectedDeal?.id)).slice(0, 12)
    : [];
  const defaultPipeline = data.pipelines.find((pipeline) => pipeline.id === activePipeline) || data.pipelines[0];
  const stagesForForm = data.stages.filter((stage) => stage.pipeline === Number(actions.form.pipeline || defaultPipeline?.id));

  const deleteMutation = useMutation({
    mutationFn: async (ids: Id[]) => Promise.all(ids.map((id) => dealsApi.remove(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      selection.setSelectedIds([]);
    },
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const index = sortedRows.findIndex((deal) => deal.id === selection.selectedDealId);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        actions.setCreateOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder^="Сделка"], input[placeholder^="Мәміле"], input[placeholder^="Deal"]')?.focus();
      }
      if (event.key === "Escape") selection.setMobileDetailOpen(false);
      if (event.key === "Enter" && selection.selectedDealId) selection.setMobileDetailOpen(true);
      if (event.key === "ArrowDown" && sortedRows[index + 1]) selection.openDeal(sortedRows[index + 1].id);
      if (event.key === "ArrowUp" && sortedRows[index - 1]) selection.openDeal(sortedRows[index - 1].id);
      if (event.key === "Delete" && selection.selectedIds.length && window.confirm("Удалить выбранные сделки?")) deleteMutation.mutate(selection.selectedIds);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, deleteMutation, selection, sortedRows]);

  async function exportExcel() {
    await writeXlsxFile(
      sortedRows.map((deal) => [
        { value: deal.title },
        { value: deal.clientEntity?.full_name || "" },
        { value: Number(deal.amount || 0) },
        { value: deal.stageEntity?.name || "" },
        { value: deal.status },
      ]),
    ).toFile("deals.xlsx");
  }

  if (!business) return <ErrorState message={t("deals.noBusiness")} />;
  if (isLoading) return <LoadingState />;

  return (
    <>
      <DealsHeader onCreate={() => actions.setCreateOpen(true)} t={t} />
      {actions.hasError || deleteMutation.error ? <div className="mb-4"><ErrorState message={t("deals.saveChangeError")} /></div> : null}
      {actions.stageGuard ? <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{actions.stageGuard}</div> : null}
      {!data.pipelines.length ? <ErrorState message={t("deals.noPipeline")} /> : (
        <>
          <DealsAIPriority deal={metrics.priorityDeal} onAction={(deal) => selection.openDeal(deal.id)} t={t} />
          <DealsMetrics metrics={metrics} />
          <DealsFilters filters={filters} metrics={metrics} pipelines={data.pipelines} teamMembers={data.teamMembers} activePipeline={activePipeline} activeFilterCount={activeFilterCount} onChange={updateFilters} onReset={resetFilters} onSave={() => localStorage.setItem("zani.deals.savedFilter", JSON.stringify(filters))} onExport={exportExcel} t={t} />
          <WorkQueueLayout className="lg:grid-cols-[minmax(0,1fr)_440px]">
            <WorkQueueListPane mobileDetailOpen={selection.mobileDetailOpen}>
              <DealsToolbar viewMode={viewMode} sortKey={sortKey} sortAsc={sortAsc} selectedCount={selection.selectedIds.length} onViewModeChange={setViewMode} onSortKeyChange={setSortKey} onSortDirectionToggle={() => setSortAsc((value) => !value)} onBulkClear={() => window.confirm("Удалить выбранные сделки?") && deleteMutation.mutate(selection.selectedIds)} />
              <DealsList rows={sortedRows} viewMode={viewMode} stages={activeStages} selectedDealId={selection.selectedDealId} selectedIds={selection.selectedIds} onOpen={(deal) => selection.openDeal(deal.id)} onCheck={(deal) => selection.toggleSelected(deal.id)} onSelectAll={selection.selectAll} onCreate={() => actions.setCreateOpen(true)} onTask={actions.openNextActionModal} onMore={(deal) => setDrawerEntity({ type: "deal", id: deal.id })} onStageChange={actions.handleStageChange} t={t} />
            </WorkQueueListPane>
            <WorkQueueDetailPane mobileDetailOpen={selection.mobileDetailOpen} closeLabel={t("common.close")} onMobileClose={() => selection.setMobileDetailOpen(false)}>
              <DealDetailPanel deal={selection.selectedDeal} leads={data.leads} stages={activeStages} tasks={selectedTasks} conversations={selectedConversations} timeline={selectedTimeline} teamMembers={data.teamMembers} onMarkWon={(deal) => { actions.setActionFlow({ type: "won", deal }); actions.setActionDraft({ amount: deal.amount || "0", lost_reason: "" }); }} onMarkLost={(deal) => { actions.setActionFlow({ type: "lost", deal }); actions.setActionDraft({ amount: "", lost_reason: "" }); }} onReopen={(deal) => actions.quickActionMutation.mutate({ id: deal.id, action: "reopen" })} onFullCard={(deal) => setDrawerEntity({ type: "deal", id: deal.id })} onClientCard={(id) => setDrawerEntity({ type: "client", id })} onStageChange={actions.handleStageChange} onOwnerChange={(deal, owner) => actions.updateDealMutation.mutate({ id: deal.id, payload: { owner } })} onAddTask={actions.openNextActionModal} t={t} />
            </WorkQueueDetailPane>
          </WorkQueueLayout>
        </>
      )}
      <CreateDealModal open={actions.createOpen} form={actions.form} clients={data.clients} pipelines={data.pipelines} defaultPipeline={defaultPipeline} stages={stagesForForm} isPending={actions.createMutation.isPending} onClose={() => actions.setCreateOpen(false)} onFormChange={actions.setForm} onSubmit={() => actions.createMutation.mutate({ business: business.id, title: actions.form.title, client: Number(actions.form.client), pipeline: Number(actions.form.pipeline || defaultPipeline?.id), stage: Number(actions.form.stage || stagesForForm[0]?.id), amount: actions.form.amount, currency: "KZT", source: actions.form.source })} t={t} />
      <DealActionModal actionFlow={actions.actionFlow} draft={actions.actionDraft} isPending={actions.quickActionMutation.isPending} onClose={() => actions.setActionFlow(null)} onDraftChange={actions.setActionDraft} onSubmit={() => actions.actionFlow && actions.quickActionMutation.mutate({ id: actions.actionFlow.deal.id, action: actions.actionFlow.type, amount: actions.actionDraft.amount, lost_reason: actions.actionDraft.lost_reason })} t={t} />
      <NextActionModal deal={actions.nextActionDeal} draft={actions.nextActionDraft} teamMembers={data.teamMembers} isPending={actions.createTaskMutation.isPending} onClose={() => actions.setNextActionDeal(null)} onDraftChange={actions.setNextActionDraft} onSubmit={() => actions.nextActionDeal && actions.createNextAction(actions.nextActionDeal)} t={t} />
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
