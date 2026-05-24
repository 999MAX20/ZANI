import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, BookOpenText, CalendarCheck, CheckCircle2, ClipboardList, Plus, Send, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";

import { aiApi, businessKnowledgeApi, type AIAssistantChatResponse } from "../../api/ai";
import type { AIToolCallLog, BusinessKnowledgeItem, Id } from "../../types";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";

const quickPrompts = [
  "Что требует внимания сегодня?",
  "Кому из клиентов стоит написать первым?",
  "Сделай краткий план действий для менеджера.",
  "Какие риски есть по заявкам и записям?",
];

const memoryCategories = [
  { value: "business", label: "О бизнесе" },
  { value: "sales", label: "Продажи" },
  { value: "service", label: "Услуги" },
  { value: "operations", label: "Операции" },
  { value: "tone", label: "Тон общения" },
  { value: "policy", label: "Правила" },
];

const emptyMemoryDraft = {
  title: "",
  content: "",
  category: "business",
  is_active: true,
};

function memoryDraftFromItem(item?: BusinessKnowledgeItem) {
  return item
    ? {
        title: item.title,
        content: item.content,
        category: item.category || "business",
        is_active: item.is_active,
      }
    : emptyMemoryDraft;
}

export function AIAssistantPage() {
  const { business, isLoading } = useActiveBusiness();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Что требует внимания сегодня?");
  const [history, setHistory] = useState<{ question: string; response: AIAssistantChatResponse }[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<AIToolCallLog[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<BusinessKnowledgeItem | undefined>();
  const [memoryDraft, setMemoryDraft] = useState(emptyMemoryDraft);

  const memory = useQuery({
    queryKey: ["ai-knowledge-items", business?.id],
    queryFn: businessKnowledgeApi.list,
    enabled: Boolean(business),
  });

  const chatMutation = useMutation({
    mutationFn: (question: string) => {
      if (!business) throw new Error("Business is not selected.");
      return aiApi.assistantChat({ business: business.id, message: question, prompt_type: "crm_assistant" });
    },
    onSuccess: (response, question) => {
      setHistory((current) => [{ question, response }, ...current].slice(0, 6));
      setMessage("");
    },
  });

  const actionSuggestMutation = useMutation({
    mutationFn: (question: string) => {
      if (!business) throw new Error("Business is not selected.");
      return aiApi.suggestTools({ business: business.id, message: question || "Что нужно сделать дальше?" });
    },
    onSuccess: (response) => {
      setSuggestedActions(response.suggested_actions.filter((action) => action.tool_name === "create_task").slice(0, 3));
    },
  });

  const actionExecuteMutation = useMutation({
    mutationFn: (logId: Id) => aiApi.executeTool(logId),
    onSuccess: (updatedAction) => {
      setSuggestedActions((current) => current.map((action) => (action.id === updatedAction.id ? updatedAction : action)));
    },
  });

  const memoryMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      const payload = { ...memoryDraft, business: business.id };
      return editingMemory
        ? businessKnowledgeApi.update({ id: editingMemory.id, payload })
        : businessKnowledgeApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-items"] });
      setMemoryOpen(false);
      setEditingMemory(undefined);
      setMemoryDraft(emptyMemoryDraft);
    },
  });

  function ask(question = message) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    chatMutation.mutate(cleanQuestion);
  }

  function suggestActions(question = message) {
    const cleanQuestion = question.trim() || "Что нужно сделать дальше?";
    actionSuggestMutation.mutate(cleanQuestion);
  }

  if (isLoading) return <LoadingState />;
  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы использовать AI Assistant." />;

  const latest = history[0]?.response;
  const activeMemoryItems = (memory.data || []).filter((item) => item.is_active);

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Операционный помощник использует контекст текущего бизнеса: заявки, клиентов, записи и базу знаний."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); setMemoryOpen(true); }}>
              <Plus size={18} />Факт памяти
            </Button>
            <Button variant="ai" onClick={() => ask("Сделай короткий daily brief по CRM.")} isLoading={chatMutation.isPending}>
              <Sparkles size={18} />Daily brief
            </Button>
          </div>
        )}
      />
      {chatMutation.error || memoryMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(chatMutation.error || memoryMutation.error)} /></div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="overflow-hidden bg-midnight text-white">
          <CardBody className="p-8">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white/10">
              <Bot size={28} />
            </div>
            <h2 className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight">
              {latest?.answer || "Спросите AI, что требует внимания в бизнесе сегодня."}
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-white/65">
              {latest?.is_mock
                ? "Сейчас включён безопасный тестовый режим AI: можно проверить UX без внешней отправки данных."
                : "Ответ построен на изолированном CRM-контексте текущего бизнеса."}
            </p>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl bg-white/8 p-4">
                <p className="text-sm text-white/55">Новые заявки</p>
                <p className="mt-1 text-2xl font-bold">{latest?.context.new_leads_count ?? "-"}</p>
              </div>
              <div className="rounded-3xl bg-white/8 p-4">
                <p className="text-sm text-white/55">Открытые записи</p>
                <p className="mt-1 text-2xl font-bold">{latest?.context.open_appointments_count ?? "-"}</p>
              </div>
              <div className="rounded-3xl bg-white/8 p-4">
                <p className="text-sm text-white/55">Клиенты</p>
                <p className="mt-1 text-2xl font-bold">{latest?.context.clients_count ?? "-"}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="mb-4 flex items-start gap-3 rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
                  <BookOpenText size={19} />
                </div>
                <div>
                  <p className="font-bold text-midnight">Business Memory</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Активных фактов: {activeMemoryItems.length}. AI использует их как контекст: услуги, правила, тон общения и особенности бизнеса.
                  </p>
                </div>
              </div>
              <Textarea
                label="Вопрос AI"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Например: кому написать сегодня?"
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button className="w-full" variant="ai" onClick={() => ask()} isLoading={chatMutation.isPending}>
                  <Send size={16} />Спросить AI
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => suggestActions()} isLoading={actionSuggestMutation.isPending}>
                  <ClipboardList size={16} />Создать действия
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Memory</p>
                  <h2 className="mt-1 text-lg font-black text-midnight">Что AI знает о бизнесе</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); setMemoryOpen(true); }}>
                  <Plus size={15} />Добавить
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {(memory.data || []).slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setEditingMemory(item); setMemoryDraft(memoryDraftFromItem(item)); setMemoryOpen(true); }}
                    className="w-full rounded-3xl border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:bg-white hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-midnight">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{item.content}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.is_active ? "active" : "off"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{item.category || "business"}</p>
                  </button>
                ))}
                {!memory.data?.length ? (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    Добавьте 3-5 фактов: как общаться с клиентами, какие услуги продвигать, что нельзя обещать, когда передавать менеджеру.
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                  <CalendarCheck size={20} />
                </div>
                <div>
                  <p className="font-semibold text-midnight">AI → задача → календарь</p>
                  <p className="text-sm text-slate-500">AI предлагает действие, а владелец подтверждает создание задачи.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {suggestedActions.length ? suggestedActions.map((action) => (
                  <div key={action.id} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-midnight">{String(action.input_json.title || "AI suggested action")}</p>
                    <p className="mt-1 text-xs text-slate-500">Статус: {action.status} · инструмент: {action.tool_name}</p>
                    {action.status === "executed" ? (
                      <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        Задача создана и попала в рабочий список. ID: {String(action.output_json.task_id || "-")}
                      </p>
                    ) : (
                      <Button className="mt-3 w-full" variant="secondary" onClick={() => actionExecuteMutation.mutate(action.id)} isLoading={actionExecuteMutation.isPending}>
                        <CalendarCheck size={16} />Создать задачу
                      </Button>
                    )}
                  </div>
                )) : (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                    Нажмите “Создать действия”, чтобы AI подготовил подтверждаемую задачу. Без подтверждения задача не создаётся.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {quickPrompts.map((item) => (
            <Card key={item}>
              <CardBody className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                <p className="flex-1 font-medium text-midnight">{item}</p>
                <Button variant="ghost" className="rounded-xl" onClick={() => ask(item)} isLoading={chatMutation.isPending}>
                  <Wand2 size={16} />Run
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {history.length ? (
        <div className="mt-6 grid gap-4">
          {history.map((item) => (
            <Card key={`${item.response.log_id}-${item.question}`}>
              <CardBody>
                <p className="text-sm font-semibold text-slate-500">{item.question}</p>
                <p className="mt-2 leading-7 text-midnight">{item.response.answer}</p>
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Ответ #{item.response.log_id} · {item.response.is_mock ? "тестовый режим" : "AI режим"}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal title={editingMemory ? "Редактировать память AI" : "Добавить факт памяти"} open={memoryOpen} onClose={() => { setMemoryOpen(false); setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); }}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            memoryMutation.mutate();
          }}
        >
          <Input
            label="Название"
            value={memoryDraft.title}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Например: Правило записи клиентов"
            required
          />
          <Select
            label="Категория"
            value={memoryDraft.category}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, category: event.target.value }))}
            options={memoryCategories}
          />
          <Textarea
            label="Что должен помнить AI"
            value={memoryDraft.content}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, content: event.target.value }))}
            placeholder="Например: если клиент спрашивает цену, сначала уточнить услугу и удобное время, потом предложить запись."
            required
          />
          <label className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={memoryDraft.is_active}
              onChange={(event) => setMemoryDraft((current) => ({ ...current, is_active: event.target.checked }))}
            />
            Использовать в AI-контексте
          </label>
          <Button type="submit" variant="ai" isLoading={memoryMutation.isPending} disabled={!memoryDraft.title.trim() || !memoryDraft.content.trim()}>
            Сохранить память
          </Button>
        </form>
      </Modal>
    </>
  );
}
