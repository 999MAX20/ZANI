import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router";

import { dealsApi } from "../../api/deals";
import {
  CrmEntityDrawer,
  type CrmDrawerEntity,
} from "../../components/crm/CrmEntityDrawer";
import {
  CrmDataTable,
  CrmTableSurface,
  CrmWorkspacePage,
  CRM_TABLE_CONTENT_CLASS,
  CRM_TABLE_EMBEDDED_CLASS,
} from "../../components/crm";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { useActionFeedback } from "../../components/actions/useActionFeedback";
import { useUndoToast } from "../../components/actions/UndoToastProvider";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import type { Deal, Id } from "../../types";
import { DealsList } from "./components/DealsList";
import { DealsFilters } from "./components/DealsFilters";
import {
  DealActionModal,
  CreateDealModal,
  NextActionModal,
} from "./components/DealModals";
import { useDealActions } from "./hooks/useDealActions";
import { useDealFilters } from "./hooks/useDealFilters";
import { useDealMetrics } from "./hooks/useDealMetrics";
import { useDealSelection } from "./hooks/useDealSelection";
import { useDeals } from "./hooks/useDeals";

export function DealsPage() {
  const { t } = useI18n();
  const { setPageHeader } = usePageHeader();
  const confirmAction = useActionConfirm();
  const showUndoToast = useUndoToast();
  const showNotification = useNotification();
  const { notifyError } = useActionFeedback();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, updateFilters, resetFilters, activeFilterCount } =
    useDealFilters();
  const {
    business,
    data,
    queries,
    deals,
    board,
    teamMembers,
    isLoading,
    summary,
    boardHasMoreByStage,
    boardIsFetchingMore,
    loadMoreBoardDeals,
  } = useDeals(filters);
  const { activePipeline, activeStages, rows } = useDealMetrics(
    data,
    filters,
    t,
  );
  const sortedRows = useMemo(() => {
    return [...rows].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [rows]);
  const quickCounts = useMemo(
    () => ({
      all: data.deals.length,
      mine: summary.data?.mine ?? 0,
      hot:
        summary.data?.hot ??
        rows.filter((deal) => deal.riskPercent >= 60).length,
      overdue:
        summary.data?.overdue ?? rows.filter((deal) => deal.sla_overdue).length,
      no_tasks:
        summary.data?.no_tasks ??
        rows.filter(
          (deal) =>
            deal.status === "open" && !deal.nextTask && !deal.next_action_at,
        ).length,
    }),
    [
      data.deals.length,
      rows,
      summary.data?.hot,
      summary.data?.mine,
      summary.data?.no_tasks,
      summary.data?.overdue,
    ],
  );
  const selection = useDealSelection(sortedRows);
  const actions = useDealActions({
    businessId: business?.id,
    activeStages,
    tasksByDeal: data.tasksByDeal,
    onSelect: selection.openDeal,
    t,
  });
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(
    null,
  );

  const defaultPipeline =
    data.pipelines.find((pipeline) => pipeline.id === activePipeline) ||
    data.pipelines[0];
  const stagesForForm = data.stages.filter(
    (stage) =>
      stage.pipeline === Number(actions.form.pipeline || defaultPipeline?.id),
  );

  const archiveMutation = useMutation({
    mutationFn: async ({ ids, reason }: { ids: Id[]; reason: string }) =>
      Promise.all(ids.map((id) => dealsApi.archive({ id, reason }))),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      selection.setSelectedIds([]);
      showUndoToast({
        message: t("deals.noticeArchived", { count: variables.ids.length }),
        onUndo: async () => {
          await Promise.all(variables.ids.map((id) => dealsApi.restore(id)));
          await queryClient.invalidateQueries({ queryKey: ["deals"] });
          showNotification({
            message: t("deals.noticeRestored", { count: variables.ids.length }),
            tone: "success",
          });
        },
      });
    },
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
      }),
  });

  async function requestArchiveSelectedDeals() {
    if (!selection.selectedIds.length) return;
    const result = await confirmAction({
      title: t("deals.archiveSelectedTitle"),
      description: t("deals.archiveSelectedText", {
        count: selection.selectedIds.length,
      }),
      confirmLabel: t("deals.archive"),
      tone: "warning",
      reason: {
        label: t("deals.archiveReason"),
        placeholder: t("deals.archiveReasonPlaceholder"),
        required: true,
        minLength: 3,
      },
    });
    if (!result.confirmed || !result.reason) return;
    archiveMutation.mutate({
      ids: selection.selectedIds,
      reason: result.reason,
    });
  }

  useEffect(() => {
    setPageHeader({
      title: t("nav.deals"),
      primaryAction: {
        label: t("deals.create"),
        icon: Plus,
        onClick: () => actions.setCreateOpen(true),
      },
    });
    return () => setPageHeader(null);
  }, [actions.setCreateOpen, setPageHeader, t]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const index = sortedRows.findIndex(
        (deal) => deal.id === selection.selectedDealId,
      );
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        actions.setCreateOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(
            'input[placeholder^="Сделка"], input[placeholder^="Мәміле"], input[placeholder^="Deal"]',
          )
          ?.focus();
      }
      if (event.key === "Escape") selection.setMobileDetailOpen(false);
      if (event.key === "Enter" && selection.selectedDealId)
        selection.setMobileDetailOpen(true);
      if (event.key === "ArrowDown" && sortedRows[index + 1])
        selection.openDeal(sortedRows[index + 1].id);
      if (event.key === "ArrowUp" && sortedRows[index - 1])
        selection.openDeal(sortedRows[index - 1].id);
      if (event.key === "Delete" && selection.selectedIds.length)
        void requestArchiveSelectedDeals();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, selection, sortedRows]);

  function openDealDrawer(deal: Deal) {
    selection.openDeal(deal.id);
    setDrawerEntity({ type: "deal", id: deal.id });
  }

  function closeDrawer() {
    setDrawerEntity(null);
    const next = new URLSearchParams(searchParams);
    next.delete("deal");
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    if (!actions.stageGuard) return;
    showNotification({ message: actions.stageGuard, tone: "warning" });
  }, [actions.stageGuard, showNotification]);

  const legacyDealId = Number(searchParams.get("deal") || "");
  if (Number.isFinite(legacyDealId) && legacyDealId > 0) {
    return <Navigate to={`/app/deals/${legacyDealId}`} replace />;
  }

  if (!business) return <ErrorState message={t("deals.noBusiness")} />;
  if (isLoading) return <LoadingState />;

  const dealWorkspaceError =
    queries.clients.error ||
    queries.pipelines.error ||
    queries.pipelineStages.error ||
    deals.error ||
    board.error ||
    summary.error ||
    teamMembers.error;
  const dealWorkspaceReady =
    data.pipelines.length > 0 &&
    !dealWorkspaceError &&
    !summary.isLoading &&
    !teamMembers.isLoading;

  return (
    <>
      <CrmWorkspacePage
        className="px-0 py-2 sm:px-0"
        contentClassName="gap-0"
        maxWidthClassName="max-w-none"
        testId={dealWorkspaceReady ? "deals-workspace-ready" : undefined}
      >
        {!data.pipelines.length ? (
          <ErrorState message={t("deals.noPipeline")} />
        ) : (
          <CrmTableSurface
            filtersClassName="border-b-0 p-0"
            filters={
                <DealsFilters
                  filters={filters}
                  stages={activeStages}
                  teamMembers={data.teamMembers}
                  quickCounts={quickCounts}
                  onChange={updateFilters}
                  onReset={resetFilters}
                  t={t}
                />
            }
          >
              <CrmDataTable
                className={CRM_TABLE_EMBEDDED_CLASS}
                contentClassName={CRM_TABLE_CONTENT_CLASS}
              >
                <DealsList
                  rows={sortedRows}
                  viewMode="kanban"
                  stages={activeStages}
                  selectedDealId={selection.selectedDealId}
                  selectedIds={selection.selectedIds}
                  onSelect={openDealDrawer}
                  onOpen={openDealDrawer}
                  onCheck={(deal) => selection.toggleSelected(deal.id)}
                  onSelectAll={selection.selectAll}
                  onCreate={() => actions.setCreateOpen(true)}
                  hasFilters={activeFilterCount > 0}
                  onResetFilters={resetFilters}
                  onMore={openDealDrawer}
                  onStageChange={actions.handleStageChange}
                  hasMoreByStage={boardHasMoreByStage}
                  onLoadMoreStage={loadMoreBoardDeals}
                  isLoadingMore={boardIsFetchingMore}
                  t={t}
                />
              </CrmDataTable>
          </CrmTableSurface>
        )}
      </CrmWorkspacePage>
      <CreateDealModal
        open={actions.createOpen}
        form={actions.form}
        clients={data.clients}
        pipelines={data.pipelines}
        defaultPipeline={defaultPipeline}
        stages={stagesForForm}
        isPending={actions.createMutation.isPending}
        onClose={() => actions.setCreateOpen(false)}
        onFormChange={actions.setForm}
        onSubmit={() =>
          actions.createMutation.mutate({
            business: business.id,
            title: actions.form.title,
            client: Number(actions.form.client),
            pipeline: Number(actions.form.pipeline || defaultPipeline?.id),
            stage: Number(actions.form.stage || stagesForForm[0]?.id),
            amount: actions.form.amount,
            currency: "KZT",
            source: actions.form.source,
          })
        }
        t={t}
      />
      <DealActionModal
        actionFlow={actions.actionFlow}
        draft={actions.actionDraft}
        isPending={actions.quickActionMutation.isPending}
        onClose={() => actions.setActionFlow(null)}
        onDraftChange={actions.setActionDraft}
        onSubmit={() =>
          actions.actionFlow &&
          actions.quickActionMutation.mutate({
            id: actions.actionFlow.deal.id,
            action: actions.actionFlow.type,
            amount: actions.actionDraft.amount,
            lost_reason: actions.actionDraft.lost_reason,
          })
        }
        t={t}
      />
      <NextActionModal
        deal={actions.nextActionDeal}
        draft={actions.nextActionDraft}
        teamMembers={data.teamMembers}
        isPending={actions.createTaskMutation.isPending}
        onClose={() => actions.setNextActionDeal(null)}
        onDraftChange={actions.setNextActionDraft}
        onSubmit={() =>
          actions.nextActionDeal &&
          actions.createNextAction(actions.nextActionDeal)
        }
        t={t}
      />
      <CrmEntityDrawer entity={drawerEntity} onClose={closeDrawer} />
    </>
  );
}
