import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { Client, Deal, Pipeline, PipelineStage, Task, TeamMember } from "../../../types";
import type { DealActionFlow, DealCreateForm, Translate } from "../types";
import { money } from "../utils/dealHelpers";

export function CreateDealModal({
  open,
  form,
  clients,
  pipelines,
  defaultPipeline,
  stages,
  isPending,
  onClose,
  onFormChange,
  onSubmit,
  t,
}: {
  open: boolean;
  form: DealCreateForm;
  clients: Client[];
  pipelines: Pipeline[];
  defaultPipeline?: Pipeline;
  stages: PipelineStage[];
  isPending: boolean;
  onClose: () => void;
  onFormChange: (form: DealCreateForm) => void;
  onSubmit: () => void;
  t: Translate;
}) {
  return (
    <Modal title={t("deals.createModalTitle")} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {!clients.length ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-900">{t("deals.needClientFirst")}</div> : null}
        <Input placeholder={t("deals.titlePlaceholder")} value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} required />
        <Select value={form.client} onChange={(event) => onFormChange({ ...form, client: event.target.value })} options={[{ value: "", label: t("deals.selectClient") }, ...clients.map((client) => ({ value: String(client.id), label: client.full_name }))]} />
        <Select value={form.pipeline || String(defaultPipeline?.id || "")} onChange={(event) => onFormChange({ ...form, pipeline: event.target.value, stage: "" })} options={pipelines.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))} />
        <Select value={form.stage} onChange={(event) => onFormChange({ ...form, stage: event.target.value })} options={[{ value: "", label: t("deals.firstStage") }, ...stages.map((stage) => ({ value: String(stage.id), label: stage.name }))]} />
        <Select
          value={form.source}
          onChange={(event) => onFormChange({ ...form, source: event.target.value })}
          options={[
            { value: "manual", label: t("deals.sourceManual") },
            { value: "website", label: t("deals.sourceWebsite") },
            { value: "telegram", label: "Telegram" },
            { value: "whatsapp", label: "WhatsApp" },
            { value: "instagram", label: "Instagram" },
          ]}
        />
        <Input type="number" placeholder={t("deals.amountPlaceholder")} value={form.amount} onChange={(event) => onFormChange({ ...form, amount: event.target.value })} />
        <Button type="submit" isLoading={isPending} disabled={!clients.length || !stages.length}>{t("common.save")}</Button>
      </form>
    </Modal>
  );
}

export function DealActionModal({
  actionFlow,
  draft,
  isPending,
  onClose,
  onDraftChange,
  onSubmit,
  t,
}: {
  actionFlow: DealActionFlow;
  draft: { amount: string; lost_reason: string };
  isPending: boolean;
  onClose: () => void;
  onDraftChange: (draft: { amount: string; lost_reason: string }) => void;
  onSubmit: () => void;
  t: Translate;
}) {
  return (
    <Modal title={actionFlow?.type === "won" ? t("deals.closeAsWon") : t("deals.closeAsLost")} open={Boolean(actionFlow)} onClose={onClose}>
      {actionFlow ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-black text-midnight">{actionFlow.deal.title}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{money(actionFlow.deal.amount, actionFlow.deal.currency)}</p>
          </div>
          {actionFlow.type === "won" ? (
            <Input label={t("deals.finalAmount")} type="number" value={draft.amount} onChange={(event) => onDraftChange({ ...draft, amount: event.target.value })} />
          ) : (
            <Input label={t("deals.lossReason")} value={draft.lost_reason} onChange={(event) => onDraftChange({ ...draft, lost_reason: event.target.value })} required />
          )}
          <Button type="submit" variant={actionFlow.type === "won" ? "primary" : "danger"} isLoading={isPending}>
            {actionFlow.type === "won" ? t("deals.confirmWon") : t("deals.confirmLost")}
          </Button>
        </form>
      ) : null}
    </Modal>
  );
}

export function NextActionModal({
  deal,
  draft,
  teamMembers,
  isPending,
  onClose,
  onDraftChange,
  onSubmit,
  t,
}: {
  deal: Deal | null;
  draft: { title: string; due_at: string; assignee: string; priority: Task["priority"] };
  teamMembers: TeamMember[];
  isPending: boolean;
  onClose: () => void;
  onDraftChange: (draft: { title: string; due_at: string; assignee: string; priority: Task["priority"] }) => void;
  onSubmit: () => void;
  t: Translate;
}) {
  return (
    <Modal title={t("deals.nextActionModal")} open={Boolean(deal)} onClose={onClose}>
      {deal ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="font-black text-midnight">{deal.title}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{money(deal.amount, deal.currency)}</p>
          </div>
          <Input label={t("deals.task")} value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} required />
          <Input label={t("deals.deadline")} type="datetime-local" value={draft.due_at} onChange={(event) => onDraftChange({ ...draft, due_at: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label={t("deals.responsible")} value={draft.assignee} onChange={(event) => onDraftChange({ ...draft, assignee: event.target.value })} options={[{ value: "", label: t("deals.dealResponsible") }, ...teamMembers.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email }))]} />
            <Select
              label={t("deals.priority")}
              value={draft.priority}
              onChange={(event) => onDraftChange({ ...draft, priority: event.target.value as Task["priority"] })}
              options={[
                { value: "low", label: t("deals.priorityLow") },
                { value: "normal", label: t("deals.priorityNormal") },
                { value: "high", label: t("deals.priorityHigh") },
                { value: "urgent", label: t("deals.priorityUrgent") },
              ]}
            />
          </div>
          <Button type="submit" isLoading={isPending}>{t("deals.createTask")}</Button>
        </form>
      ) : null}
    </Modal>
  );
}
