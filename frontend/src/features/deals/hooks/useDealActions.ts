import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dealsApi, type DealCreatePayload, type DealUpdatePayload } from "../../../api/deals";
import { tasksApi, type TaskCreatePayload } from "../../../api/tasks";
import { useActionFeedback } from "../../../components/actions/useActionFeedback";
import type { Deal, Id, PipelineStage, Task } from "../../../types";
import type { DealActionFlow, DealCreateForm, Translate } from "../types";
import { nextOpenTask, toDateTimeLocal } from "../utils/dealHelpers";

export function useDealActions({
  businessId,
  activeStages,
  tasksByDeal,
  onSelect,
  t,
}: {
  businessId?: Id;
  activeStages: PipelineStage[];
  tasksByDeal: Map<Id, Task[]>;
  onSelect: (dealId: Id) => void;
  t: Translate;
}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useActionFeedback();
  const [createOpen, setCreateOpen] = useState(false);
  const [actionFlow, setActionFlow] = useState<DealActionFlow>(null);
  const [actionDraft, setActionDraft] = useState({ amount: "", lost_reason: "" });
  const [stageGuard, setStageGuard] = useState("");
  const [nextActionDeal, setNextActionDeal] = useState<Deal | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState({
    title: t("deals.defaultNextAction"),
    due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    assignee: "",
    priority: "normal" as Task["priority"],
  });
  const [form, setForm] = useState<DealCreateForm>({ title: "", client: "", pipeline: "", stage: "", amount: "0", source: "manual" });

  const createMutation = useMutation({
    mutationFn: (payload: DealCreatePayload) => dealsApi.create(payload),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setCreateOpen(false);
      onSelect(deal.id);
      setForm({ title: "", client: "", pipeline: "", stage: "", amount: "0", source: "manual" });
      notifySuccess(t("deals.actionDone"));
    },
    onError: (error) => notifyError(error),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage, lost_reason }: { id: Id; stage: Id; lost_reason?: string }) => dealsApi.moveStage({ id, stage, lost_reason }),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      onSelect(deal.id);
      notifySuccess(t("deals.actionDone"));
    },
    onError: (error) => notifyError(error),
  });

  const quickActionMutation = useMutation({
    mutationFn: ({ id, action, lost_reason, amount }: { id: Id; action: "won" | "lost" | "reopen"; lost_reason?: string; amount?: string | number }) => {
      if (action === "won") return dealsApi.markWon({ id, amount });
      if (action === "lost") return dealsApi.markLost({ id, lost_reason: lost_reason || "" });
      return dealsApi.reopen({ id });
    },
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["activity-events"] });
      onSelect(deal.id);
      setActionFlow(null);
      setActionDraft({ amount: "", lost_reason: "" });
      notifySuccess(t("deals.actionDone"));
    },
    onError: (error) => notifyError(error),
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setNextActionDeal(null);
      setStageGuard("");
      notifySuccess(t("deals.actionDone"));
    },
    onError: (error) => notifyError(error),
  });

  const updateDealMutation = useMutation({
    mutationFn: ({ id, payload }: { id: Id; payload: DealUpdatePayload }) => dealsApi.update({ id, payload }),
    onSuccess: (deal) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      onSelect(deal.id);
      notifySuccess(t("common.saved"));
    },
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
      }),
  });

  function openNextActionModal(deal: Deal) {
    setNextActionDeal(deal);
    setNextActionDraft({
      title: t("deals.defaultNextAction"),
      due_at: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      assignee: deal.owner ? String(deal.owner) : "",
      priority: "normal",
    });
  }

  function createNextAction(deal: Deal) {
    if (!businessId) return;
    createTaskMutation.mutate({
      business: businessId,
      title: nextActionDraft.title,
      description: "",
      client: deal.client,
      lead: deal.lead,
      deal: deal.id,
      appointment: null,
      parent_task: null,
      assignee: nextActionDraft.assignee ? Number(nextActionDraft.assignee) : deal.owner || null,
      due_at: new Date(nextActionDraft.due_at).toISOString(),
      reminder_at: null,
      priority: nextActionDraft.priority,
    });
  }

  function handleStageChange(deal: Deal, stageId: Id) {
    const targetStage = activeStages.find((stage) => stage.id === stageId);
    const currentStage = activeStages.find((stage) => stage.id === deal.stage);
    if (!targetStage) return;
    if (targetStage.is_won) {
      setActionFlow({ type: "won", deal });
      setActionDraft({ amount: deal.amount || "0", lost_reason: "" });
      return;
    }
    if (targetStage.is_lost) {
      setActionFlow({ type: "lost", deal });
      setActionDraft({ amount: "", lost_reason: deal.lost_reason || "" });
      return;
    }
    const isAdvancing = currentStage ? targetStage.order > currentStage.order : true;
    const hasNextAction = Boolean(nextOpenTask(tasksByDeal.get(deal.id) || []) || deal.next_action_at);
    if (deal.status === "open" && isAdvancing && !hasNextAction) {
      setStageGuard(t("deals.stageGuard"));
      openNextActionModal(deal);
      return;
    }
    setStageGuard("");
    moveMutation.mutate({ id: deal.id, stage: stageId });
  }

  return {
    createOpen,
    setCreateOpen,
    form,
    setForm,
    actionFlow,
    setActionFlow,
    actionDraft,
    setActionDraft,
    stageGuard,
    nextActionDeal,
    setNextActionDeal,
    nextActionDraft,
    setNextActionDraft,
    createMutation,
    moveMutation,
    quickActionMutation,
    createTaskMutation,
    updateDealMutation,
    createNextAction,
    openNextActionModal,
    handleStageChange,
  };
}
