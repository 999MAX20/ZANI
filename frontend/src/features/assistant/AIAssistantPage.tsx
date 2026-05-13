import { useMutation } from "@tanstack/react-query";
import { Bot, CheckCircle2, Send, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";

import { aiApi, type AIAssistantChatResponse } from "../../api/ai";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { Textarea } from "../../components/ui/Textarea";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";

const quickPrompts = [
  "Что требует внимания сегодня?",
  "Кому из клиентов стоит написать первым?",
  "Сделай краткий план действий для менеджера.",
  "Какие риски есть по заявкам и записям?",
];

export function AIAssistantPage() {
  const { business, isLoading } = useActiveBusiness();
  const [message, setMessage] = useState("Что требует внимания сегодня?");
  const [history, setHistory] = useState<{ question: string; response: AIAssistantChatResponse }[]>([]);

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

  function ask(question = message) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    chatMutation.mutate(cleanQuestion);
  }

  if (isLoading) return <LoadingState />;
  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы использовать AI Assistant." />;

  const latest = history[0]?.response;

  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Операционный помощник использует контекст текущего бизнеса: заявки, клиентов, записи и базу знаний."
        actions={<Button variant="ai" onClick={() => ask("Сделай короткий daily brief по CRM.")} isLoading={chatMutation.isPending}><Sparkles size={18} />Daily brief</Button>}
      />
      {chatMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(chatMutation.error)} /></div> : null}

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
                ? "Сейчас используется controlled mock, потому что OPENAI_API_KEY не настроен. UX и логирование уже работают."
                : "Ответ сохранён в AIRequestLog и построен на tenant-safe CRM context."}
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
              <Textarea
                label="Вопрос AI"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Например: кому написать сегодня?"
              />
              <Button className="mt-3 w-full" variant="ai" onClick={() => ask()} isLoading={chatMutation.isPending}>
                <Send size={16} />Спросить AI
              </Button>
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
                  log #{item.response.log_id} · {item.response.model} · {item.response.is_mock ? "mock" : `${item.response.tokens_used} tokens`}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
