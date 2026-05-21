import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, MessageSquareText, Play, PlugZap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { onboardingApi } from "../../api/onboarding";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import type { Business } from "../../types";

export function OnboardingPage() {
  const queryClient = useQueryClient();
  const { business, isLoading } = useActiveBusiness();
  const [selectedTemplate, setSelectedTemplate] = useState<Business["business_type"]>("other");
  const templates = useQuery({ queryKey: ["onboarding-templates"], queryFn: onboardingApi.templates });
  const status = useQuery({
    queryKey: ["onboarding-status", business?.id],
    queryFn: () => onboardingApi.status(business!.id),
    enabled: Boolean(business),
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return onboardingApi.applyTemplate({ business: business.id, templateKey: selectedTemplate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["quick-replies"] });
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });

  const demoMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return onboardingApi.createDemoData(business.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
  });
  const setupChannelMutation = useMutation({
    mutationFn: (channel: "website" | "telegram" | "whatsapp") => {
      if (!business) throw new Error("Business is required.");
      return onboardingApi.setupChannel({ business: business.id, channel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });
  const firstMessageMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return onboardingApi.createFirstMessage(business.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
    },
  });

  if (isLoading || templates.isLoading || status.isLoading) return <LoadingState />;
  if (!business) return <ErrorState message="Сначала создайте бизнес в настройках." />;

  const currentStatus = status.data;
  const selected = templates.data?.find((template) => template.key === selectedTemplate) || templates.data?.[0];
  const error = applyMutation.error || demoMutation.error || setupChannelMutation.error || firstMessageMutation.error || templates.error || status.error;

  return (
    <>
      <PageHeader
        title="Быстрый старт"
        description="Короткий маршрут до первой рабочей CRM: ниша, канал, первое сообщение и проверка заявки без лишних настроек."
        actions={<Link to="/dashboard"><Button variant="secondary">Вернуться на dashboard</Button></Link>}
      />
      {error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(error)} /></div> : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <Sparkles size={22} />
              </div>
              <div>
              <h2 className="text-xl font-black text-midnight">Шаблон ниши</h2>
                <p className="mt-1 text-sm text-slate-500">Минимальная структура для старта: услуги, воронка, график, ответы и базовые автоматизации.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(templates.data || []).map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => setSelectedTemplate(template.key)}
                  className={template.key === selectedTemplate ? "rounded-3xl border border-brand-200 bg-brand-50 p-4 text-left shadow-soft" : "rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"}
                >
                  <p className="font-bold text-midnight">{template.label}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{template.services.slice(0, 3).join(" · ")}</p>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-black text-midnight">{selected.label}</p>
                <TemplateLine label="Pipeline" items={selected.stages} />
                <TemplateLine label="Services" items={selected.services} />
                <TemplateLine label="Resources" items={selected.resources} />
                <TemplateLine label="Replies" items={selected.quick_replies} />
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => applyMutation.mutate()} isLoading={applyMutation.isPending}>
                <Play size={16} />
                Применить шаблон
              </Button>
              <Button type="button" variant="secondary" onClick={() => demoMutation.mutate()} isLoading={demoMutation.isPending}>
                Создать demo flow
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Setup checklist</p>
                <h2 className="mt-2 text-xl font-black text-midnight">Готовность CRM</h2>
                <p className="mt-1 text-sm text-slate-500">Каждый пункт ведёт к реальному действию, которое менеджер сможет повторить в работе.</p>
              </div>
              <div className="rounded-3xl bg-slate-50 px-5 py-3 text-center">
                <p className="text-3xl font-black text-midnight">{currentStatus?.progress || 0}%</p>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  {currentStatus?.completed || 0}/{currentStatus?.total || 0}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {(currentStatus?.items || []).map((item) => (
                <div key={item.key} className={item.is_completed ? "flex items-center gap-3 rounded-2xl bg-emerald-50 p-3" : "flex items-center gap-3 rounded-2xl bg-slate-50 p-3"}>
                  <div className={item.is_completed ? "grid h-9 w-9 place-items-center rounded-2xl bg-white text-emerald-600" : "grid h-9 w-9 place-items-center rounded-2xl bg-white text-slate-400"}>
                    {item.is_completed ? <CheckCircle2 size={18} /> : <ClipboardCheck size={18} />}
                  </div>
                  <p className={item.is_completed ? "font-bold text-emerald-900" : "font-bold text-midnight"}>{item.title}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Link to="/dashboard/leads"><Button className="w-full" variant="secondary">Заявки</Button></Link>
              <Link to="/dashboard/calendar"><Button className="w-full" variant="secondary">Календарь</Button></Link>
              <Link to="/dashboard/settings"><Button className="w-full" variant="secondary">Настройки</Button></Link>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <PlugZap size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-midnight">Первый канал</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Для пилота можно начать с Website channel: он не требует внешних токенов и сразу показывает путь от формы или чата к заявке и inbox.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Button type="button" onClick={() => setupChannelMutation.mutate("website")} isLoading={setupChannelMutation.isPending}>
                Website
              </Button>
              <Button type="button" variant="secondary" onClick={() => setupChannelMutation.mutate("telegram")} isLoading={setupChannelMutation.isPending}>
                Telegram mock
              </Button>
              <Button type="button" variant="secondary" onClick={() => setupChannelMutation.mutate("whatsapp")} isLoading={setupChannelMutation.isPending}>
                WhatsApp mock
              </Button>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Telegram/WhatsApp на этом шаге создают безопасный mock connector с recovery state. Реальные токены подключаются позже в разделе интеграций.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <MessageSquareText size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-midnight">Первое сообщение</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Создаёт тестовое входящее сообщение, клиента и заявку, чтобы менеджер увидел реальный inbox-сценарий без ручной настройки.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => firstMessageMutation.mutate()} isLoading={firstMessageMutation.isPending}>
                Создать первое сообщение
              </Button>
              <Link to="/dashboard/conversations"><Button type="button" variant="secondary">Открыть диалоги</Button></Link>
              <Link to="/dashboard/integrations"><Button type="button" variant="secondary">Интеграции</Button></Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function TemplateLine({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
