import { ClipboardCheck, Play, Plus, RotateCcw, Settings2, Trash2, Workflow } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import type { AutomationActionDraft, AutomationConditionDraft, AutomationPreview, AutomationRule, ManualAutomationRulePayload } from "../../types";

const triggers = [
  { value: "lead_created", label: "Новая заявка" },
  { value: "deal_created", label: "Новая сделка" },
  { value: "stage_changed", label: "Смена стадии" },
  { value: "message_received", label: "Новое сообщение" },
  { value: "appointment_created", label: "Создана запись" },
  { value: "task_overdue", label: "Просрочена задача" },
];

const conditionOperators = [
  { value: "eq", label: "=" },
  { value: "contains", label: "contains" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "in", label: "in" },
];

const actionOptions = [
  { value: "create_task", label: "Создать задачу" },
  { value: "create_notification", label: "Создать уведомление" },
  { value: "wait", label: "Delay / wait" },
];

function valueJson(value: string) {
  return { value };
}

function parseConfig(configText: string) {
  if (!configText.trim()) return {};
  return JSON.parse(configText) as Record<string, unknown>;
}

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { automationRules } = useEntityData();
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
  const [actions, setActions] = useState<Array<AutomationActionDraft & { configText: string }>>([
    { action_type: "create_task", config: { title: "Связаться с клиентом" }, configText: "{\"title\":\"Связаться с клиентом\"}", delay_seconds: 0 },
  ]);
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [advancedError, setAdvancedError] = useState<string | null>(null);

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
      setAdvancedError(error instanceof Error ? error.message : "Preview failed. Check rule fields.");
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
      setActions([{ action_type: "create_task", config: { title: "Связаться с клиентом" }, configText: "{\"title\":\"Связаться с клиентом\"}", delay_seconds: 0 }]);
    },
    onError: (error) => setAdvancedError(error instanceof Error ? error.message : "Rule was not saved. Preview it first and check validation."),
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

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с автоматизациями." />;
  if (automationRules.isLoading || templates.isLoading || runs.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Автоматизации"
        description="Простой режим: готовые шаблоны автоматизаций, включение правил и журнал запусков без сложного конструктора."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAdvancedOpen(true)}><Settings2 size={18} />Advanced builder</Button>
            <Button onClick={() => setCreateOpen(true)}><Plus size={18} />Создать правило</Button>
          </div>
        }
      />
      {applyTemplateMutation.error || toggleMutation.error || mutation.error || createManualMutation.error ? (
        <div className="mb-4"><ErrorState message="Не удалось сохранить автоматизацию. Проверьте доступы и данные правила." /></div>
      ) : null}

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-brand-700" />
          <h2 className="text-xl font-bold text-midnight">Шаблоны для быстрого старта</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(templates.data || []).map((template) => (
            <Card key={template.key}>
              <CardBody>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                    {triggers.find((item) => item.value === template.trigger_type)?.label || template.trigger_type}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{template.actions.length} action</span>
                </div>
                <h3 className="text-lg font-bold text-midnight">{template.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => applyTemplateMutation.mutate({ templateKey: template.key, isActive: false })}
                    isLoading={applyTemplateMutation.isPending}
                  >
                    Добавить черновик
                  </Button>
                  <Button
                    onClick={() => applyTemplateMutation.mutate({ templateKey: template.key, isActive: true })}
                    isLoading={applyTemplateMutation.isPending}
                  >
                    <Play size={16} /> Включить
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Workflow size={20} className="text-brand-700" />
        <h2 className="text-xl font-bold text-midnight">Активные и черновые правила</h2>
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
                  {rule.is_active ? "Active" : "Draft"}
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
                  {rule.is_active ? "Отключить" : "Включить"}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
        {!automationRules.data?.length ? (
          <EmptyState
            title="Автоматизаций пока нет"
            description="Начните с одного простого правила: новая заявка, задача менеджеру или напоминание по записи."
            action={<Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus size={16} />Создать правило</Button>}
          />
        ) : null}
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-bold text-midnight">Журнал запусков</h2>
        <div className="mt-3 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        {(runs.data || []).slice(0, 8).map((run) => (
            <div key={run.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_120px_160px_auto]">
              <div>
                <p className="font-bold text-midnight">{triggers.find((item) => item.value === run.trigger_type)?.label || run.trigger_type}</p>
                <p className="text-xs text-slate-500">
                  {run.entity_type || "entity"} #{run.entity_id || "-"} · attempt {run.attempts || 0}/{run.max_attempts || 3}
                  {run.next_retry_at ? ` · retry ${new Date(run.next_retry_at).toLocaleString("ru-RU")}` : ""}
                  {run.error ? ` · ${run.error}` : ""}
                </p>
              </div>
              <span className="font-semibold text-slate-600">{run.status}</span>
              <span className="text-xs font-semibold text-slate-400">{new Date(run.created_at).toLocaleString("ru-RU")}</span>
              {run.status === "failed" ? (
                <Button
                  variant="secondary"
                  className="min-h-8 px-3 py-1 text-xs"
                  onClick={() => retryRunMutation.mutate(run.id)}
                  isLoading={retryRunMutation.isPending}
                >
                  <RotateCcw size={14} />Retry
                </Button>
              ) : null}
            </div>
          ))}
          {!runs.data?.length ? <div className="px-4 py-5 text-sm text-slate-500">Запусков пока нет. Они появятся после событий CRM.</div> : null}
        </div>
      </div>

      <Modal title="Создать правило" open={createOpen} onClose={() => setCreateOpen(false)}>
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
          <Input placeholder="Название правила" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Select value={form.trigger_type} onChange={(event) => setForm({ ...form, trigger_type: event.target.value })} options={triggers} />
          <Input placeholder="Краткое описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Button type="submit" isLoading={mutation.isPending}>Сохранить черновик</Button>
        </form>
      </Modal>

      <Modal title="Advanced automation builder" open={advancedOpen} onClose={() => setAdvancedOpen(false)}>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!preview) {
              setAdvancedError("Сначала выполните preview/test-run, затем сохраните правило.");
              return;
            }
            createManualMutation.mutate();
          }}
        >
          {advancedError ? <ErrorState message={advancedError} /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Название" value={advancedForm.name} onChange={(event) => setAdvancedForm({ ...advancedForm, name: event.target.value })} required />
            <Select label="Trigger" value={advancedForm.trigger_type} onChange={(event) => setAdvancedForm({ ...advancedForm, trigger_type: event.target.value })} options={triggers} />
          </div>
          <Textarea label="Описание" value={advancedForm.description} onChange={(event) => setAdvancedForm({ ...advancedForm, description: event.target.value })} />
          <div className="grid gap-3 md:grid-cols-[1fr_130px]">
            <Input
              label="Priority"
              type="number"
              value={advancedForm.priority}
              onChange={(event) => setAdvancedForm({ ...advancedForm, priority: Number(event.target.value) })}
            />
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={advancedForm.is_active} onChange={(event) => setAdvancedForm({ ...advancedForm, is_active: event.target.checked })} />
              Включить после сохранения
            </label>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-midnight">Conditions</h3>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConditions([...conditions, { field: "source", operator: "eq", value: {}, rawValue: "" }])}
              >
                <Plus size={16} /> Add condition
              </Button>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={`${condition.field}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
                  <Input
                    placeholder="field, e.g. source"
                    value={condition.field}
                    onChange={(event) => setConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value } : item))}
                  />
                  <Select
                    value={condition.operator}
                    onChange={(event) => setConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value as AutomationConditionDraft["operator"] } : item))}
                    options={conditionOperators}
                  />
                  <Input
                    placeholder="expected value"
                    value={condition.rawValue}
                    onChange={(event) => setConditions(conditions.map((item, itemIndex) => itemIndex === index ? { ...item, rawValue: event.target.value } : item))}
                  />
                  <Button type="button" variant="ghost" className="px-3" onClick={() => setConditions(conditions.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              {!conditions.length ? <p className="text-sm text-slate-500">Без условий правило сработает на каждый выбранный trigger.</p> : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold text-midnight">Actions</h3>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActions([...actions, { action_type: "wait", config: {}, configText: "{}", delay_seconds: 300 }])}
              >
                <Plus size={16} /> Add action
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
                      placeholder="delay seconds"
                      value={action.delay_seconds}
                      onChange={(event) => setActions(actions.map((item, itemIndex) => itemIndex === index ? { ...item, delay_seconds: Number(event.target.value) } : item))}
                    />
                    <Button type="button" variant="ghost" className="px-3" onClick={() => setActions(actions.filter((_, itemIndex) => itemIndex !== index))}>
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
                    placeholder='{"title":"Связаться с клиентом","priority":"high"}'
                  />
                </div>
              ))}
            </div>
          </div>

          {preview ? (
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-bold">Preview OK: {preview.name}</p>
              <p className="mt-1">{preview.will_run_when}</p>
              <p className="mt-2 font-semibold">{preview.conditions_count} conditions · {preview.actions_count} actions</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => previewMutation.mutate()} isLoading={previewMutation.isPending}>
              Test / preview
            </Button>
            <Button type="submit" isLoading={createManualMutation.isPending}>
              Сохранить правило
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
