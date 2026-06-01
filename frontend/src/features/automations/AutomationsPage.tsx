import { ClipboardCheck, Play, Plus, RotateCcw, Settings2, Trash2, Workflow } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { automationRulesApi, automationRunsApi } from "../../api/automations";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import type { AutomationActionDraft, AutomationConditionDraft, AutomationPreview, AutomationRule, ManualAutomationRulePayload } from "../../types";

const triggerKeys = [
  { value: "lead_created", labelKey: "automations.trigger.leadCreated" },
  { value: "deal_created", labelKey: "automations.trigger.dealCreated" },
  { value: "stage_changed", labelKey: "automations.trigger.stageChanged" },
  { value: "message_received", labelKey: "automations.trigger.messageReceived" },
  { value: "appointment_created", labelKey: "automations.trigger.appointmentCreated" },
  { value: "task_overdue", labelKey: "automations.trigger.taskOverdue" },
];

const conditionOperators = [
  { value: "eq", label: "=" },
  { value: "contains", label: "contains" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "in", label: "in" },
];

const actionOptionKeys = [
  { value: "create_task", labelKey: "automations.action.createTask" },
  { value: "create_notification", labelKey: "automations.action.createNotification" },
  { value: "wait", labelKey: "automations.action.wait" },
];

const localeByLanguage = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};

function defaultActions(t: (key: string) => string) {
  const title = t("automations.defaultTaskTitle");
  return [
    {
      action_type: "create_task",
      config: { title },
      configText: JSON.stringify({ title }),
      delay_seconds: 0,
    },
  ] as Array<AutomationActionDraft & { configText: string }>;
}

function valueJson(value: string) {
  return { value };
}

function parseConfig(configText: string) {
  if (!configText.trim()) return {};
  return JSON.parse(configText) as Record<string, unknown>;
}

export function AutomationsPage() {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { automationRules } = useEntityData({ automationRules: true });
  const templates = useQuery({ queryKey: ["automation-templates"], queryFn: automationRulesApi.templates });
  const runs = useQuery({ queryKey: ["automation-runs"], queryFn: automationRunsApi.list });
  const [createOpen, setCreateOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "lead_created", description: "" });
  const [advancedForm, setAdvancedForm] = useState({
    name: "",
    trigger_type: "lead_created",
    description: "",
    is_active: false,
    priority: 100,
  });
  const [conditions, setConditions] = useState<Array<AutomationConditionDraft & { rawValue: string }>>([]);
  const [actions, setActions] = useState<Array<AutomationActionDraft & { configText: string }>>(() => defaultActions(t));
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const triggers = triggerKeys.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const actionOptions = actionOptionKeys.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const locale = localeByLanguage[language];

  const mutation = useMutation({
    mutationFn: (payload: Partial<AutomationRule>) => automationRulesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setCreateOpen(false);
      setForm({ name: "", trigger_type: "lead_created", description: "" });
    },
  });
  const applyTemplateMutation = useMutation({
    mutationFn: ({ templateKey, isActive }: { templateKey: string; isActive: boolean }) => {
      if (!business) throw new Error("Business is required.");
      return automationRulesApi.applyTemplate({ business: business.id, template_key: templateKey, is_active: isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ rule, isActive }: { rule: AutomationRule; isActive: boolean }) =>
      automationRulesApi.update({ id: rule.id, payload: { is_active: isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });
  const previewMutation = useMutation({
    mutationFn: () => automationRulesApi.previewManual(buildManualPayload()),
    onSuccess: (data) => {
      setPreview(data);
      setAdvancedError(null);
    },
    onError: (error) => {
      setPreview(null);
      setAdvancedError(error instanceof Error ? error.message : t("automations.previewFailed"));
    },
  });
  const createManualMutation = useMutation({
    mutationFn: () => automationRulesApi.createManual(buildManualPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setAdvancedOpen(false);
      setPreview(null);
      setAdvancedError(null);
      setAdvancedForm({ name: "", trigger_type: "lead_created", description: "", is_active: false, priority: 100 });
      setConditions([]);
      setActions(defaultActions(t));
    },
    onError: (error) => setAdvancedError(error instanceof Error ? error.message : t("automations.ruleNotSaved")),
  });
  const retryRunMutation = useMutation({
    mutationFn: (runId: number) => automationRunsApi.retry(runId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-runs"] }),
  });

  function buildManualPayload(): ManualAutomationRulePayload {
    if (!business) throw new Error("Business is required.");
    return {
      business: business.id,
      name: advancedForm.name,
      trigger_type: advancedForm.trigger_type,
      description: advancedForm.description,
      is_active: advancedForm.is_active,
      priority: advancedForm.priority,
      conditions: conditions.map((condition) => ({
        field: condition.field,
        operator: condition.operator,
        value: valueJson(condition.rawValue),
      })),
      actions: actions.map((action) => ({
        action_type: action.action_type,
        config: parseConfig(action.configText),
        delay_seconds: Number(action.delay_seconds || 0),
      })),
    };
  }

  if (!business) return <ErrorState message={t("automations.noBusiness")} />;
  if (automationRules.isLoading || templates.isLoading || runs.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title={t("automations.title")}
        description={t("automations.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard/settings#automations">
              <Button type="button" variant="secondary">{t("automations.backToSettings")}</Button>
            </Link>
            <Button onClick={() => setCreateOpen(true)}><Plus size={18} />{t("automations.createRule")}</Button>
          </div>
        }
      />
      {applyTemplateMutation.error || toggleMutation.error || mutation.error || createManualMutation.error ? (
        <div className="mb-4"><ErrorState message={t("automations.saveError")} /></div>
      ) : null}

      <details className="mb-6 rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-soft">
        <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.16em] text-slate-500">
          {t("automations.advancedTitle")}
        </summary>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-slate-500">{t("automations.advancedText")}</p>
          <Button type="button" variant="secondary" onClick={() => setAdvancedOpen(true)}>
            <Settings2 size={18} />
            {t("automations.advancedBuilder")}
          </Button>
        </div>
      </details>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-brand-700" />
          <h2 className="text-xl font-bold text-midnight">{t("automations.templatesTitle")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(templates.data || []).map((template) => (
            <Card key={template.key}>
              <CardBody>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                    {triggers.find((item) => item.value === template.trigger_type)?.label || template.trigger_type}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{t("automations.actionCount", { count: template.actions.length })}</span>
                </div>
                <h3 className="text-lg font-bold text-midnight">{template.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => applyTemplateMutation.mutate({ templateKey: template.key, isActive: false })}
                    isLoading={applyTemplateMutation.isPending}
                  >
                    {t("automations.addDraft")}
                  </Button>
                  <Button
                    onClick={() => applyTemplateMutation.mutate({ templateKey: template.key, isActive: true })}
                    isLoading={applyTemplateMutation.isPending}
                  >
                    <Play size={16} /> {t("automations.enable")}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Workflow size={20} className="text-brand-700" />
        <h2 className="text-xl font-bold text-midnight">{t("automations.rulesTitle")}</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(automationRules.data || []).map((rule) => (
          <Card key={rule.id}>
            <CardBody>
              <div className="mb-5 flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-midnight">
                  <Workflow size={22} />
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${rule.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {rule.is_active ? t("status.active") : t("status.draft")}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-midnight">{rule.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{triggers.find((item) => item.value === rule.trigger_type)?.label || rule.trigger_type}</p>
              {rule.description ? <p className="mt-3 text-sm leading-6 text-slate-500">{rule.description}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={rule.is_active ? "secondary" : "primary"}
                  onClick={() => toggleMutation.mutate({ rule, isActive: !rule.is_active })}
                  isLoading={toggleMutation.isPending}
                >
                  {rule.is_active ? t("automations.disable") : t("automations.enable")}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
        {!automationRules.data?.length ? (
          <EmptyState
            title={t("automations.emptyTitle")}
            description={t("automations.emptyDescription")}
            action={<Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus size={16} />{t("automations.createRule")}</Button>}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-bold text-midnight">{t("automations.runsTitle")}</h2>
        <div className="mt-3 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        {(runs.data || []).slice(0, 8).map((run) => (
            <div key={run.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_120px_160px_auto]">
              <div>
                <p className="font-bold text-midnight">{triggers.find((item) => item.value === run.trigger_type)?.label || run.trigger_type}</p>
                <p className="text-xs text-slate-500">
                  {run.entity_type || t("automations.entity")} #{run.entity_id || "-"} · {t("automations.attempt", { current: run.attempts || 0, max: run.max_attempts || 3 })}
                  {run.next_retry_at ? ` · ${t("automations.retryAt", { date: new Date(run.next_retry_at).toLocaleString(locale) })}` : ""}
                  {run.error ? ` · ${run.error}` : ""}
                </p>
              </div>
              <span className="font-semibold text-slate-600">{run.status}</span>
              <span className="text-xs font-semibold text-slate-400">{new Date(run.created_at).toLocaleString(locale)}</span>
              {run.status === "failed" ? (
                <Button
                  variant="secondary"
                  className="min-h-8 px-3 py-1 text-xs"
                  onClick={() => retryRunMutation.mutate(run.id)}
                  isLoading={retryRunMutation.isPending}
                >
                  <RotateCcw size={14} />{t("automations.retry")}
                </Button>
              ) : null}
            </div>
          ))}
          {!runs.data?.length ? <div className="px-4 py-5 text-sm text-slate-500">{t("automations.noRuns")}</div> : null}
        </div>
      </div>

      <Modal title={t("automations.createRule")} open={createOpen} onClose={() => setCreateOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              business: business.id,
              name: form.name,
              trigger_type: form.trigger_type,
              description: form.description,
              is_active: false,
            });
          }}
        >
          <Input placeholder={t("automations.ruleNamePlaceholder")} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Select value={form.trigger_type} onChange={(event) => setForm({ ...form, trigger_type: event.target.value })} options={triggers} />
          <Input placeholder={t("automations.descriptionPlaceholder")} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Button type="submit" isLoading={mutation.isPending}>{t("automations.saveDraft")}</Button>
        </form>
      </Modal>

      <Modal title={t("automations.advancedBuilder")} open={advancedOpen} onClose={() => setAdvancedOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!preview) {
              setAdvancedError(t("automations.previewRequired"));
              return;
            }
            createManualMutation.mutate();
          }}
        >
          {advancedError ? <ErrorState message={advancedError} /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={t("automations.name")} value={advancedForm.name} onChange={(event) => setAdvancedForm({ ...advancedForm, name: event.target.value })} required />
            <Select label={t("automations.trigger")} value={advancedForm.trigger_type} onChange={(event) => setAdvancedForm({ ...advancedForm, trigger_type: event.target.value })} options={triggers} />
          </div>
          <Textarea label={t("automations.descriptionLabel")} value={advancedForm.description} onChange={(event) => setAdvancedForm({ ...advancedForm, description: event.target.value })} />
          <div className="grid gap-3 md:grid-cols-[1fr_130px]">
            <Input
              label={t("automations.priority")}
              type="number"
              value={advancedForm.priority}
              onChange={(event) => setAdvancedForm({ ...advancedForm, priority: Number(event.target.value) })}
            />
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={advancedForm.is_active} onChange={(event) => setAdvancedForm({ ...advancedForm, is_active: event.target.checked })} />
              {t("automations.enableAfterSave")}
            </label>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-midnight">{t("automations.conditions")}</h3>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConditions([...conditions, { field: "source", operator: "eq", value: {}, rawValue: "" }])}
              >
                <Plus size={16} /> {t("automations.addCondition")}
              </Button>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={`${condition.field}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
                  <Input
                    placeholder={t("automations.fieldPlaceholder")}
                    value={condition.field}
                    onChange={(event) => setConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value } : item))}
                  />
                  <Select
                    value={condition.operator}
                    onChange={(event) => setConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as AutomationConditionDraft["operator"] } : item))}
                    options={conditionOperators}
                  />
                  <Input
                    placeholder={t("automations.expectedValue")}
                    value={condition.rawValue}
                    onChange={(event) => setConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, rawValue: event.target.value } : item))}
                  />
                  <Button type="button" variant="ghost" className="px-3" aria-label={t("automations.removeCondition")} onClick={() => setConditions(conditions.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {!conditions.length ? <p className="text-sm text-slate-500">{t("automations.noConditionsHint")}</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-midnight">{t("automations.actions")}</h3>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActions([...actions, { action_type: "wait", config: {}, configText: "{}", delay_seconds: 300 }])}
              >
                <Plus size={16} /> {t("automations.addAction")}
              </Button>
            </div>
            <div className="space-y-3">
              {actions.map((action, index) => (
                <div key={`${action.action_type}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_150px_auto]">
                    <Select
                      value={action.action_type}
                      onChange={(event) => setActions(actions.map((item, itemIndex) => itemIndex === index ? { ...item, action_type: event.target.value as AutomationActionDraft["action_type"] } : item))}
                      options={actionOptions}
                    />
                    <Input
                      type="number"
                      placeholder={t("automations.delaySeconds")}
                      value={action.delay_seconds}
                      onChange={(event) => setActions(actions.map((item, itemIndex) => itemIndex === index ? { ...item, delay_seconds: Number(event.target.value) } : item))}
                    />
                    <Button type="button" variant="ghost" className="px-3" aria-label={t("automations.removeAction")} onClick={() => setActions(actions.filter((_, itemIndex) => itemIndex !== index))}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-2 font-mono text-xs"
                    value={action.configText}
                    onChange={(event) => {
                      setPreview(null);
                      setActions(actions.map((item, itemIndex) => itemIndex === index ? { ...item, configText: event.target.value } : item));
                    }}
                    placeholder={t("automations.configPlaceholder")}
                  />
                </div>
              ))}
            </div>
          </div>

          {preview ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-bold">{t("automations.previewOk", { name: preview.name })}</p>
              <p className="mt-1">{preview.will_run_when}</p>
              <p className="mt-2 font-semibold">{t("automations.previewMeta", { conditions: preview.conditions_count, actions: preview.actions_count })}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => previewMutation.mutate()} isLoading={previewMutation.isPending}>
              {t("automations.testPreview")}
            </Button>
            <Button type="submit" isLoading={createManualMutation.isPending}>
              {t("automations.saveRule")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
