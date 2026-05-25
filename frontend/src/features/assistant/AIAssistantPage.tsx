import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  BookOpenText,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Cpu,
  History,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
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
import { useI18n } from "../../lib/i18n";

const quickPromptKeys = [
  "aiAssistant.quick.attention",
  "aiAssistant.quick.firstClient",
  "aiAssistant.quick.managerPlan",
  "aiAssistant.quick.risks",
];

const memoryCategories = [
  { value: "business", labelKey: "aiAssistant.memory.category.business" },
  { value: "sales", labelKey: "aiAssistant.memory.category.sales" },
  { value: "service", labelKey: "aiAssistant.memory.category.service" },
  { value: "operations", labelKey: "aiAssistant.memory.category.operations" },
  { value: "tone", labelKey: "aiAssistant.memory.category.tone" },
  { value: "policy", labelKey: "aiAssistant.memory.category.policy" },
];

const emptyMemoryDraft = {
  title: "",
  content: "",
  category: "business",
  is_active: true,
};

type ChatHistoryItem = {
  question: string;
  response: AIAssistantChatResponse;
  createdAt: string;
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
  const { t } = useI18n();
  const { business, isLoading } = useActiveBusiness();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(() => t("aiAssistant.defaultQuestion"));
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<Id | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<AIToolCallLog[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<BusinessKnowledgeItem | undefined>();
  const [memoryDraft, setMemoryDraft] = useState(emptyMemoryDraft);

  const memory = useQuery({
    queryKey: ["ai-knowledge-items", business?.id],
    queryFn: businessKnowledgeApi.list,
    enabled: Boolean(business),
  });

  const aiStatus = useQuery({
    queryKey: ["ai-assistant-status", business?.id],
    queryFn: () => aiApi.assistantStatus(business!.id),
    enabled: Boolean(business),
  });

  const chatMutation = useMutation({
    mutationFn: (question: string) => {
      if (!business) throw new Error("Business is not selected.");
      return aiApi.assistantChat({ business: business.id, message: question, prompt_type: "crm_assistant" });
    },
    onSuccess: (response, question) => {
      const nextItem = { question, response, createdAt: new Date().toISOString() };
      setHistory((current) => [nextItem, ...current].slice(0, 12));
      setSelectedLogId(response.log_id);
      setMessage("");
    },
  });

  const actionSuggestMutation = useMutation({
    mutationFn: (question: string) => {
      if (!business) throw new Error("Business is not selected.");
      return aiApi.suggestTools({ business: business.id, message: question || t("aiAssistant.defaultNextAction") });
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
    const cleanQuestion = question.trim() || t("aiAssistant.defaultNextAction");
    actionSuggestMutation.mutate(cleanQuestion);
  }

  if (isLoading) return <LoadingState />;
  if (!business) return <ErrorState message={t("aiAssistant.noBusiness")} />;

  const selectedHistoryItem = history.find((item) => item.response.log_id === selectedLogId) || history[0];
  const activeMemoryItems = (memory.data || []).filter((item) => item.is_active);
  const memoryCategoryOptions = memoryCategories.map((item) => ({ value: item.value, label: t(item.labelKey) }));
  const providerLabel = aiStatus.data
    ? t("aiAssistant.providerStatus", {
        provider: aiStatus.data.provider,
        mode: aiStatus.data.mode === "live" ? t("aiAssistant.modeLive") : t("aiAssistant.modeMock"),
        model: aiStatus.data.model,
      })
    : t("aiAssistant.providerChecking");

  return (
    <>
      <PageHeader
        title={t("aiAssistant.title")}
        description={t("aiAssistant.description")}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); setMemoryOpen(true); }}>
              <Plus size={18} />{t("aiAssistant.addMemoryFact")}
            </Button>
            <Button variant="ai" onClick={() => ask(t("aiAssistant.dailyBriefPrompt"))} isLoading={chatMutation.isPending}>
              <Sparkles size={18} />{t("aiAssistant.dailyBrief")}
            </Button>
          </div>
        )}
      />

      {chatMutation.error || memoryMutation.error ? (
        <div className="mb-4"><ErrorState message={getApiErrorMessage(chatMutation.error || memoryMutation.error)} /></div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/92 shadow-premium backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-slate-100/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ai-gradient text-white shadow-glow">
                <Bot size={24} />
              </div>
              <div>
                <p className="text-lg font-black text-midnight">{t("aiAssistant.chatTitle")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAssistant.liveModeText")}</p>
              </div>
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
              <Cpu size={15} className="shrink-0 text-brand-600" />
              <span className="truncate">{providerLabel}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {!history.length ? (
              <div className="mx-auto flex min-h-[24rem] max-w-3xl flex-col items-center justify-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] bg-ai-gradient text-white shadow-glow">
                  <MessageSquareText size={30} />
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-midnight sm:text-4xl">{t("aiAssistant.heroFallback")}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-500">{t("aiAssistant.activeFactsSummary", { count: activeMemoryItems.length })}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {quickPromptKeys.map((key) => {
                    const item = t(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => ask(item)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand-700 hover:shadow-soft"
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-6">
                {[...history].reverse().map((item) => (
                  <div key={`${item.response.log_id}-${item.question}`} className="space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[86%] rounded-[1.5rem] rounded-br-md bg-midnight px-5 py-4 text-sm font-semibold leading-6 text-white shadow-soft">
                        {item.question}
                      </div>
                    </div>
                    <div className="flex justify-start gap-3">
                      <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-ai-gradient text-white shadow-sm">
                        <Sparkles size={17} />
                      </div>
                      <div className="max-w-[88%] rounded-[1.5rem] rounded-tl-md border border-slate-100 bg-slate-50 px-5 py-4 shadow-sm">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{item.response.answer}</p>
                        <p className="mt-3 text-xs font-semibold text-slate-400">
                          {t("aiAssistant.historyMeta", {
                            id: item.response.log_id,
                            mode: item.response.is_mock ? t("aiAssistant.modeMock") : `${item.response.provider} · ${item.response.model}`,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {chatMutation.isPending ? (
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-ai-gradient text-white"><Sparkles size={16} /></div>
                    {t("common.loading")}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100/90 bg-white/96 p-4 sm:p-5">
            <div className="mx-auto max-w-4xl">
              <Textarea
                label={t("aiAssistant.questionLabel")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("aiAssistant.questionPlaceholder")}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {quickPromptKeys.slice(0, 2).map((key) => {
                    const item = t(key);
                    return (
                      <Button key={key} type="button" variant="ghost" size="sm" onClick={() => setMessage(item)}>
                        <Wand2 size={14} />{item}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => suggestActions()} isLoading={actionSuggestMutation.isPending}>
                    <ClipboardList size={16} />{t("aiAssistant.createActions")}
                  </Button>
                  <Button variant="ai" onClick={() => ask()} isLoading={chatMutation.isPending} disabled={!message.trim()}>
                    <Send size={16} />{t("aiAssistant.ask")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-brand-700">
                  <History size={19} />
                </div>
                <div>
                  <p className="font-black text-midnight">{t("aiAssistant.historyTitle")}</p>
                  <p className="text-sm font-semibold text-slate-500">{t("aiAssistant.historySubtitle")}</p>
                </div>
              </div>
              <div className="space-y-2">
                {history.map((item) => {
                  const active = selectedHistoryItem?.response.log_id === item.response.log_id;
                  return (
                    <button
                      key={`${item.response.log_id}-${item.createdAt}`}
                      type="button"
                      onClick={() => setSelectedLogId(item.response.log_id)}
                      className={`w-full rounded-2xl border p-3 text-left transition hover:bg-white hover:shadow-soft ${active ? "border-brand-200 bg-brand-50/70" : "border-slate-100 bg-slate-50/70"}`}
                    >
                      <p className="line-clamp-2 text-sm font-black text-midnight">{item.question}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.response.answer}</p>
                    </button>
                  );
                })}
                {!history.length ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">{t("aiAssistant.emptyHistoryText")}</p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="mb-4 flex items-start gap-3 rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
                  <BookOpenText size={19} />
                </div>
                <div>
                  <p className="font-bold text-midnight">{t("aiAssistant.businessMemory")}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {t("aiAssistant.activeFactsSummary", { count: activeMemoryItems.length })}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("aiAssistant.memoryEyebrow")}</p>
                  <h2 className="mt-1 text-lg font-black text-midnight">{t("aiAssistant.memoryTitle")}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); setMemoryOpen(true); }}>
                  <Plus size={15} />{t("aiAssistant.add")}
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {(memory.data || []).slice(0, 4).map((item) => (
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
                        {item.is_active ? t("aiAssistant.active") : t("aiAssistant.off")}
                      </span>
                    </div>
                  </button>
                ))}
                {!memory.data?.length ? (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                    {t("aiAssistant.emptyMemoryText")}
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
                  <p className="font-semibold text-midnight">{t("aiAssistant.taskFlowTitle")}</p>
                  <p className="text-sm text-slate-500">{t("aiAssistant.taskFlowText")}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {suggestedActions.length ? suggestedActions.map((action) => (
                  <div key={action.id} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-midnight">{String(action.input_json.title || t("aiAssistant.actionFallback"))}</p>
                    <p className="mt-1 text-xs text-slate-500">{t("aiAssistant.actionStatus", { status: action.status, tool: action.tool_name })}</p>
                    {action.status === "executed" ? (
                      <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        {t("aiAssistant.taskCreated", { id: String(action.output_json.task_id || "-") })}
                      </p>
                    ) : (
                      <Button className="mt-3 w-full" variant="secondary" onClick={() => actionExecuteMutation.mutate(action.id)} isLoading={actionExecuteMutation.isPending}>
                        <CalendarCheck size={16} />{t("aiAssistant.createTask")}
                      </Button>
                    )}
                  </div>
                )) : (
                  <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
                    {t("aiAssistant.emptyActionsText")}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-2">
            {quickPromptKeys.map((key) => {
              const item = t(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => ask(item)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3 text-left font-medium text-midnight shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"
                >
                  <CheckCircle2 className="shrink-0 text-emerald-500" size={18} />
                  <span className="flex-1 text-sm">{item}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <Modal title={editingMemory ? t("aiAssistant.editMemoryTitle") : t("aiAssistant.addMemoryTitle")} open={memoryOpen} onClose={() => { setMemoryOpen(false); setEditingMemory(undefined); setMemoryDraft(emptyMemoryDraft); }}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            memoryMutation.mutate();
          }}
        >
          <Input
            label={t("aiAssistant.nameLabel")}
            value={memoryDraft.title}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder={t("aiAssistant.namePlaceholder")}
            required
          />
          <Select
            label={t("aiAssistant.categoryLabel")}
            value={memoryDraft.category}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, category: event.target.value }))}
            options={memoryCategoryOptions}
          />
          <Textarea
            label={t("aiAssistant.contentLabel")}
            value={memoryDraft.content}
            onChange={(event) => setMemoryDraft((current) => ({ ...current, content: event.target.value }))}
            placeholder={t("aiAssistant.contentPlaceholder")}
            required
          />
          <label className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={memoryDraft.is_active}
              onChange={(event) => setMemoryDraft((current) => ({ ...current, is_active: event.target.checked }))}
            />
            {t("aiAssistant.useInContext")}
          </label>
          <Button type="submit" variant="ai" isLoading={memoryMutation.isPending} disabled={!memoryDraft.title.trim() || !memoryDraft.content.trim()}>
            {t("aiAssistant.saveMemory")}
          </Button>
        </form>
      </Modal>
    </>
  );
}
