import type { Deal, PipelineStage, Task } from "../../../types";
import type { Translate } from "../types";

export function money(value: string | number, currency = "KZT") {
  return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
}

const stageTranslationKeys: Record<string, string> = {
  new: "deals.stageNew",
  qualification: "deals.stageQualification",
  proposal: "deals.stageProposal",
  negotiation: "deals.stageNegotiation",
  won: "deals.stageWon",
  lost: "deals.stageLost",
};

export function dealStageLabel(
  stage:
    | (Pick<PipelineStage, "name"> & { template_key?: string })
    | undefined,
  t: Translate,
) {
  const translationKey = stageTranslationKeys[stage?.template_key || ""];
  return translationKey ? t(translationKey) : stage?.name || t("deals.noStage");
}

export function initials(name?: string) {
  return (name || "D")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function sourceLabel(source: string | undefined, t: Translate) {
  const labels: Record<string, string> = {
    website: "deals.sourceWebsite",
    landing: "deals.sourceLanding",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    manual: "deals.sourceManual",
    onboarding: "deals.sourceOnboarding",
    parser: "deals.sourceParser",
    other: "deals.sourceOther",
  };
  const label = labels[source || ""];
  return label ? t(label) : source || t("deals.sourceManual");
}

export function nextOpenTask(tasks: Task[]) {
  return tasks
    .filter((task) => !["done", "cancelled"].includes(task.status))
    .sort((a, b) => String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")))[0];
}

export function toDateTimeLocal(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function isPastDate(value?: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

export function dealRisk(deal: Deal, tasks: Task[]) {
  if (deal.sla_overdue) return { riskLevel: "high" as const, riskPercent: 86 };
  if (isPastDate(deal.expected_close_at)) return { riskLevel: "high" as const, riskPercent: 78 };
  if (!nextOpenTask(tasks) && !deal.next_action_at && deal.status === "open") return { riskLevel: "medium" as const, riskPercent: 62 };
  return { riskLevel: "low" as const, riskPercent: deal.status === "open" ? 24 : 12 };
}

export function stageProbability(deal: Deal, stage?: PipelineStage) {
  return deal.probability || stage?.probability || 0;
}
