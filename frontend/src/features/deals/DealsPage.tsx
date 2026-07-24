import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { dealsApi } from "../../api/deals";
import {
  CrmEntityDrawer,
  type CrmDrawerEntity,
} from "../../components/crm/CrmEntityDrawer";
import {
  CrmDataTable,
  CrmTableSurface,
  CrmWorkspaceGrid,
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
import { DealQuickInspector } from "./components/DealQuickInspector";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, updateFilters, resetFilters, activeFilterCount } =
    useDealFilters();
  const {
    business,
    data,
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
      showNotification({
        message: t("deals.noticeArchived", { count: variables.ids.length }),
        tone: "success",
      });
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
      variant: "danger",
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

  useEffect(() => {
    const dealId = Number(searchParams.get("deal"));
    if (!Number.isFinite(dealId) || dealId <= 0) return;
    setDrawerEntity(null);
    navigate(`/app/deals/${dealId}`, { replace: true });
  }, [navigate, searchParams]);

  function openDealDrawer(deal: Deal) {
    selection.openDeal(deal.id);
    setDrawerEntity({ type: "deal", id: deal.id });
    const next = new URLSearchParams(searchParams);
    next.set("deal", String(deal.id));
    setSearchParams(next, { replace: true });
  }

  function openDealWorkspace(deal: Deal) {
    setDrawerEntity(null);
    navigate(`/app/deals/${deal.id}`);
  }

  function closeDrawer() {
    setDrawerEntity(null);
    const next = new URLSearchParams(searchParams);
    next.delete("deal");
    setSearchParams(next, { replace: true });
  }

  const selectedDealTaskCount = selection.selectedDeal
    ? data.tasksByDeal.get(selection.selectedDeal.id)?.length || 0
    : 0;
  const selectedDealConversationCount = selection.selectedDeal
    ? data.conversations.filter(
        (conversation) =>
          conversation.deal === selection.selectedDeal?.id ||
          conversation.client === selection.selectedDeal?.client,
      ).length
    : 0;

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

  return (
    <>
      <CrmWorkspacePage contentClassName="gap-0">
        {!data.pipelines.length ? (
          <ErrorState message={t("deals.noPipeline")} />
        ) : (
          <CrmWorkspaceGrid inspectorOpen={Boolean(selection.selectedDeal)}>
            <CrmTableSurface
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
                  onSelect={(deal) => selection.openDeal(deal.id)}
                  onOpen={openDealWorkspace}
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

            <DealQuickInspector
              deal={selection.selectedDeal}
              taskCount={selectedDealTaskCount}
              conversationCount={selectedDealConversationCount}
              t={t}
              onOpen={openDealWorkspace}
              onCreateTask={actions.setNextActionDeal}
            />
          </CrmWorkspaceGrid>
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
