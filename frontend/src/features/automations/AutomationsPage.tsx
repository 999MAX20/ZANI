import { Plus, Workflow } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { automationRulesApi } from "../../api/automations";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { AutomationRule } from "../../types";

const triggers = [
  { value: "lead_created", label: "Новая заявка" },
  { value: "deal_created", label: "Новая сделка" },
  { value: "stage_changed", label: "Смена стадии" },
  { value: "message_received", label: "Новое сообщение" },
  { value: "appointment_created", label: "Создана запись" },
  { value: "task_overdue", label: "Просрочена задача" },
];

export function AutomationsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { automationRules } = useEntityData();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "lead_created", description: "" });

  const mutation = useMutation({
    mutationFn: (payload: Partial<AutomationRule>) => automationRulesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setCreateOpen(false);
      setForm({ name: "", trigger_type: "lead_created", description: "" });
    },
  });

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с автоматизациями." />;
  if (automationRules.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Автоматизации"
        description="Правила событий: триггер, условия и действия. Без визуального перегруза."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus size={18} />Создать правило</Button>}
      />
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
    </>
  );
}
