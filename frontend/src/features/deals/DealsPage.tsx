import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";

import { dealsApi } from "../../api/deals";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import type { Deal, Id } from "../../types";
import { DealsBusinessWidgets } from "./components/DealsBusinessWidgets";
import { DealsFilters } from "./components/DealsFilters";
import { DealsList } from "./components/DealsList";
import { DealActionModal, CreateDealModal, NextActionModal } from "./components/DealModals";
import { useDealActions } from "./hooks/useDealActions";
import { useDealFilters } from "./hooks/useDealFilters";
import { useDealMetrics } from "./hooks/useDealMetrics";
import { useDealSelection } from "./hooks/useDealSelection";
import { useDeals } from "./hooks/useDeals";

export function DealsPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const queryClient = useQueryClient();
  const { filters, updateFilters, resetFilters, activeFilterCount } = useDealFilters();
  const { business, data, isLoading } = useDeals(filters);
  const { activePipeline, activeStages, rows, metrics } = useDealMetrics(data, filters);
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [rows]);
  const selection = useDealSelection(sortedRows);
  const actions = useDealActions({ businessId: business?.id, activeStages, tasksByDeal: data.tasksByDeal, onSelect: selection.openDeal, t });
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);

  const selectedTimeline = selection.selectedDeal
    ? data.activityEvents.filter((event) => event.entity_type === "Deal" && event.entity_id === String(selection.selectedDeal?.id)).slice(0, 12)
    : [];
  const widgetTimeline = selectedTimeline.length ? selectedTimeline : data.activityEvents.slice(0, 4);
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
    setPageHeader({
      title: t("nav.deals"),
      secondaryActions: [
        {
          label: t("deals.configurePipeline"),
          icon: Settings2,
          onClick: () => updateFilters({ expanded: !filters.expanded }),
        },
      ],
      primaryAction: {
        label: t("deals.create"),
        icon: Plus,
        onClick: () => actions.setCreateOpen(true),
      },
    });
    return () => setPageHeader(null);
  }, [filters.expanded, setPageHeader, t]);

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
      if (event.key === "Delete" && selection.selectedIds.length && window.confirm(t("deals.confirmDeleteSelected"))) deleteMutation.mutate(selection.selectedIds);
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
      <div className="-mx-4 -mt-4 min-h-[calc(100vh-5rem)] bg-[#fbfcff] px-4 pb-6 pt-4 sm:-mx-6 sm:px-6 lg:-mx-6 lg:px-6">
      {actions.hasError || deleteMutation.error ? <div className="mb-4"><ErrorState message={t("deals.saveChangeError")} /></div> : null}
      {actions.stageGuard ? <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{actions.stageGuard}</div> : null}
      {!data.pipelines.length ? <ErrorState message={t("deals.noPipeline")} /> : (
        <>
          <DealsFilters filters={filters} pipelines={data.pipelines} teamMembers={data.teamMembers} activePipeline={activePipeline} activeFilterCount={activeFilterCount} onChange={updateFilters} onReset={resetFilters} onExport={exportExcel} onCreate={() => actions.setCreateOpen(true)} onConfigure={() => updateFilters({ expanded: !filters.expanded })} t={t} />
          <section className="-mx-1 overflow-hidden rounded-lg border border-slate-100 bg-white/70 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <DealsList rows={sortedRows} viewMode="kanban" stages={activeStages} selectedDealId={selection.selectedDealId} selectedIds={selection.selectedIds} onOpen={(deal) => selection.openDeal(deal.id)} onCheck={(deal) => selection.toggleSelected(deal.id)} onSelectAll={selection.selectAll} onCreate={() => actions.setCreateOpen(true)} onTask={actions.openNextActionModal} onMore={(deal) => setDrawerEntity({ type: "deal", id: deal.id })} onStageChange={actions.handleStageChange} t={t} />
          </section>
          <DealsBusinessWidgets
            metrics={metrics}
            timeline={widgetTimeline}
            onOpenDeal={(deal) => {
              selection.openDeal(deal.id);
              setDrawerEntity({ type: "deal", id: deal.id });
            }}
            t={t}
          />
        </>
      )}
      </div>
      <CreateDealModal open={actions.createOpen} form={actions.form} clients={data.clients} pipelines={data.pipelines} defaultPipeline={defaultPipeline} stages={stagesForForm} isPending={actions.createMutation.isPending} onClose={() => actions.setCreateOpen(false)} onFormChange={actions.setForm} onSubmit={() => actions.createMutation.mutate({ business: business.id, title: actions.form.title, client: Number(actions.form.client), pipeline: Number(actions.form.pipeline || defaultPipeline?.id), stage: Number(actions.form.stage || stagesForForm[0]?.id), amount: actions.form.amount, currency: "KZT", source: actions.form.source })} t={t} />
      <DealActionModal actionFlow={actions.actionFlow} draft={actions.actionDraft} isPending={actions.quickActionMutation.isPending} onClose={() => actions.setActionFlow(null)} onDraftChange={actions.setActionDraft} onSubmit={() => actions.actionFlow && actions.quickActionMutation.mutate({ id: actions.actionFlow.deal.id, action: actions.actionFlow.type, amount: actions.actionDraft.amount, lost_reason: actions.actionDraft.lost_reason })} t={t} />
      <NextActionModal deal={actions.nextActionDeal} draft={actions.nextActionDraft} teamMembers={data.teamMembers} isPending={actions.createTaskMutation.isPending} onClose={() => actions.setNextActionDeal(null)} onDraftChange={actions.setNextActionDraft} onSubmit={() => actions.nextActionDeal && actions.createNextAction(actions.nextActionDeal)} t={t} />
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
