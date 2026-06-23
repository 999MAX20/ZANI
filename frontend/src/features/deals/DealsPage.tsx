import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { dealsApi } from "../../api/deals";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import {
  CrmDataTable,
  CrmTableSurface,
  CrmWorkspacePage,
  CRM_TABLE_CONTENT_CLASS,
  CRM_TABLE_EMBEDDED_CLASS,
} from "../../components/crm";
import { usePageHeader } from "../../components/layout/PageHeaderContext";
import { useNotification } from "../../components/notifications/NotificationProvider";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import type { Deal, Id } from "../../types";
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
  const showNotification = useNotification();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters } = useDealFilters();
  const { business, data, isLoading } = useDeals(filters);
  const { activePipeline, activeStages, rows } = useDealMetrics(data, filters);
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [rows]);
  const selection = useDealSelection(sortedRows);
  const actions = useDealActions({ businessId: business?.id, activeStages, tasksByDeal: data.tasksByDeal, onSelect: selection.openDeal, t });
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");

  const defaultPipeline = data.pipelines.find((pipeline) => pipeline.id === activePipeline) || data.pipelines[0];
  const stagesForForm = data.stages.filter((stage) => stage.pipeline === Number(actions.form.pipeline || defaultPipeline?.id));

  const archiveMutation = useMutation({
    mutationFn: async ({ ids, reason }: { ids: Id[]; reason: string }) => Promise.all(ids.map((id) => dealsApi.archive({ id, reason }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      selection.setSelectedIds([]);
      setArchiveOpen(false);
      setArchiveReason("");
    },
  });

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
      if (event.key === "Delete" && selection.selectedIds.length) setArchiveOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, selection, sortedRows]);

  useEffect(() => {
    const dealId = Number(searchParams.get("deal"));
    if (!Number.isFinite(dealId) || dealId <= 0) return;
    setDrawerEntity({ type: "deal", id: dealId });
  }, [searchParams]);

  function openDealDrawer(deal: Deal) {
    selection.openDeal(deal.id);
    setDrawerEntity({ type: "deal", id: deal.id });
    const next = new URLSearchParams(searchParams);
    next.set("deal", String(deal.id));
    setSearchParams(next, { replace: true });
  }

  function closeDrawer() {
    setDrawerEntity(null);
    const next = new URLSearchParams(searchParams);
    next.delete("deal");
    setSearchParams(next, { replace: true });
  }

  const actionErrorMessage = actions.hasError || archiveMutation.error ? t("deals.saveChangeError") : "";

  useEffect(() => {
    if (!actionErrorMessage) return;
    showNotification({ message: actionErrorMessage, tone: "danger" });
  }, [actionErrorMessage, showNotification]);

  useEffect(() => {
    if (!actions.stageGuard) return;
    showNotification({ message: actions.stageGuard, tone: "warning" });
  }, [actions.stageGuard, showNotification]);

  if (!business) return <ErrorState message={t("deals.noBusiness")} />;
  if (isLoading) return <LoadingState />;

  return (
    <>
      <CrmWorkspacePage contentClassName="gap-0">
        {!data.pipelines.length ? <ErrorState message={t("deals.noPipeline")} /> : (
          <CrmTableSurface>
            <CrmDataTable className={CRM_TABLE_EMBEDDED_CLASS} contentClassName={CRM_TABLE_CONTENT_CLASS}>
              <DealsList
                rows={sortedRows}
                viewMode="kanban"
                stages={activeStages}
                selectedDealId={selection.selectedDealId}
                selectedIds={selection.selectedIds}
                onOpen={openDealDrawer}
                onCheck={(deal) => selection.toggleSelected(deal.id)}
                onSelectAll={selection.selectAll}
                onCreate={() => actions.setCreateOpen(true)}
                onMore={openDealDrawer}
                onStageChange={actions.handleStageChange}
                t={t}
              />
            </CrmDataTable>
          </CrmTableSurface>
        )}
      </CrmWorkspacePage>
      <CreateDealModal open={actions.createOpen} form={actions.form} clients={data.clients} pipelines={data.pipelines} defaultPipeline={defaultPipeline} stages={stagesForForm} isPending={actions.createMutation.isPending} onClose={() => actions.setCreateOpen(false)} onFormChange={actions.setForm} onSubmit={() => actions.createMutation.mutate({ business: business.id, title: actions.form.title, client: Number(actions.form.client), pipeline: Number(actions.form.pipeline || defaultPipeline?.id), stage: Number(actions.form.stage || stagesForForm[0]?.id), amount: actions.form.amount, currency: "KZT", source: actions.form.source })} t={t} />
      <DealActionModal actionFlow={actions.actionFlow} draft={actions.actionDraft} isPending={actions.quickActionMutation.isPending} onClose={() => actions.setActionFlow(null)} onDraftChange={actions.setActionDraft} onSubmit={() => actions.actionFlow && actions.quickActionMutation.mutate({ id: actions.actionFlow.deal.id, action: actions.actionFlow.type, amount: actions.actionDraft.amount, lost_reason: actions.actionDraft.lost_reason })} t={t} />
      <NextActionModal deal={actions.nextActionDeal} draft={actions.nextActionDraft} teamMembers={data.teamMembers} isPending={actions.createTaskMutation.isPending} onClose={() => actions.setNextActionDeal(null)} onDraftChange={actions.setNextActionDraft} onSubmit={() => actions.nextActionDeal && actions.createNextAction(actions.nextActionDeal)} t={t} />
      <Modal title={t("deals.archiveSelectedTitle")} open={archiveOpen} onClose={() => { setArchiveOpen(false); setArchiveReason(""); }}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selection.selectedIds.length) return;
            archiveMutation.mutate({ ids: selection.selectedIds, reason: archiveReason.trim() || t("deals.archiveReasonDefault") });
          }}
        >
          <p className="text-sm leading-6 text-slate-600">{t("deals.archiveSelectedText", { count: selection.selectedIds.length })}</p>
          <Input label={t("deals.archiveReason")} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder={t("deals.archiveReasonPlaceholder")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setArchiveOpen(false); setArchiveReason(""); }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="danger" isLoading={archiveMutation.isPending}>
              {t("deals.archive")}
            </Button>
          </div>
        </form>
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={closeDrawer} />
    </>
  );
}
