import { ArrowRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dealsApi } from "../../api/deals";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Deal, Id } from "../../types";

const dealStatuses = {
  open: "В работе",
  won: "Выиграна",
  lost: "Потеряна",
};

export function DealsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, pipelines, pipelineStages, deals } = useEntityData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", client: "", pipeline: "", stage: "", amount: "0" });

  const stagesByPipeline = useMemo(
    () => (pipelineStages.data || []).filter((stage) => !form.pipeline || stage.pipeline === Number(form.pipeline)),
    [form.pipeline, pipelineStages.data],
  );

  const mutation = useMutation({
    mutationFn: (payload: Partial<Deal>) => dealsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setOpen(false);
      setForm({ title: "", client: "", pipeline: "", stage: "", amount: "0" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: Id; stage: Id }) => dealsApi.moveStage({ id, stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
  });

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать со сделками." />;
  if (clients.isLoading || pipelines.isLoading || pipelineStages.isLoading || deals.isLoading) return <LoadingState />;

  const defaultPipeline = pipelines.data?.[0];
  const rows = deals.data || [];

  return (
    <>
      <PageHeader
        title="Сделки"
        description="Pipeline-слой поверх лидов: сумма, стадия, вероятность и результат."
        actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Создать сделку</Button>}
      />
      {!pipelines.data?.length ? (
        <ErrorState message="Сначала создайте pipeline и стадии через API или Django Admin. Это защищает CRM от хаотичных статусов." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {(pipelineStages.data || []).map((stage) => {
            const stageDeals = rows.filter((deal) => deal.stage === stage.id);
            return (
              <Card key={stage.id}>
                <CardBody>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-midnight">{stage.name}</h2>
                      <p className="text-xs text-slate-500">{stage.probability}% вероятность</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{stageDeals.length}</span>
                  </div>
                  <div className="space-y-3">
                    {stageDeals.map((deal) => {
                      const client = clients.data?.find((item) => item.id === deal.client);
                      const nextStage = (pipelineStages.data || []).find((item) => item.pipeline === deal.pipeline && item.order > stage.order);
                      return (
                        <div key={deal.id} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                          <p className="font-semibold text-midnight">{deal.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{client?.full_name || "Client"} · {Number(deal.amount).toLocaleString("ru-RU")} {deal.currency}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">{dealStatuses[deal.status]}</span>
                            {nextStage ? (
                              <Button variant="ghost" className="h-9 rounded-xl px-3 text-xs" onClick={() => moveMutation.mutate({ id: deal.id, stage: nextStage.id })}>
                                Далее <ArrowRight size={14} />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {!stageDeals.length ? <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">Нет сделок на стадии.</p> : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal title="Создать сделку" open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              business: business.id,
              title: form.title,
              client: Number(form.client),
              pipeline: Number(form.pipeline || defaultPipeline?.id),
              stage: Number(form.stage || stagesByPipeline[0]?.id),
              amount: form.amount,
              currency: "KZT",
            });
          }}
        >
          <Input placeholder="Название сделки" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Select value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })} options={[{ value: "", label: "Клиент" }, ...(clients.data || []).map((client) => ({ value: String(client.id), label: client.full_name }))]} />
          <Select value={form.pipeline || String(defaultPipeline?.id || "")} onChange={(event) => setForm({ ...form, pipeline: event.target.value, stage: "" })} options={(pipelines.data || []).map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))} />
          <Select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })} options={[{ value: "", label: "Первая стадия" }, ...stagesByPipeline.map((stage) => ({ value: String(stage.id), label: stage.name }))]} />
          <Input type="number" placeholder="Сумма" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <Button type="submit" isLoading={mutation.isPending}>Сохранить</Button>
        </form>
      </Modal>
    </>
  );
}
