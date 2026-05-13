import { Bot, Mic, Paperclip, Send, Sparkles, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { useEntityData } from "../../hooks/useEntityData";

const initialMessages = [
  { from: "client", text: "Здравствуйте, можно записаться на консультацию сегодня?" },
  { from: "ai", text: "AI предлагает: сегодня свободно 12:00 и 16:30. Подтвердить?" },
  { from: "manager", text: "Здравствуйте! Есть окно в 12:00. Забронировать для вас?" },
];

export function ConversationsPage() {
  const { clients } = useEntityData();
  const firstClient = clients.data?.[0];
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function sendReply() {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { from: "manager", text }]);
    setDraft("");
    setNotice("Ответ добавлен в диалог. Подключение реальной отправки пойдет через messaging API.");
  }

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Единый inbox для WhatsApp, Telegram, Instagram и сайта с AI-ответами."
        actions={<Button variant="ai" onClick={() => setNotice("AI подготовил 3 быстрых ответа для текущего диалога.")}><Sparkles size={18} />Generate replies</Button>}
      />
      {notice ? (
        <div className="mb-4 rounded-3xl border border-ai-100 bg-ai-50 px-4 py-3 text-sm font-medium text-ai-800">
          {notice}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[360px_1fr_340px]">
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-semibold text-midnight">Inbox</h2>
              <p className="mt-1 text-sm text-slate-500">4 диалога требуют ответа</p>
            </div>
            <div className="divide-y divide-slate-100">
              {[firstClient?.full_name || "Алия Иванова", "Марина Beauty", "Dental lead", "Instagram visitor"].map((name, index) => (
                <button key={name} className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${index === 0 ? "bg-brand-50/70" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ai-gradient text-sm font-bold text-white">{name[0]}</div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-midnight">{name}</p>
                      <p className="truncate text-sm text-slate-500">Можно записаться сегодня?</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="font-semibold text-midnight">{firstClient?.full_name || "Алия Иванова"}</h2>
              <p className="text-sm text-slate-500">WhatsApp · response time 3 min</p>
            </div>
            <Button variant="secondary" onClick={() => setNotice("Открытие формы записи из inbox будет подключено к AppointmentForm на следующем шаге.")}>Create appointment</Button>
          </div>
          <CardBody className="min-h-[520px] space-y-4 bg-gradient-to-b from-white to-slate-50">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.from === "client" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${message.from === "client" ? "bg-white text-slate-700" : message.from === "ai" ? "bg-ai-50 text-ai-800 ring-1 ring-ai-100" : "bg-midnight text-white"}`}>
                  {message.from === "ai" ? <Sparkles className="mb-2 inline text-ai-600" size={15} /> : null}
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
          </CardBody>
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-3 py-2">
              <Button variant="ghost" className="h-9 w-9 rounded-xl px-0" onClick={() => setNotice("Вложения пока в демо-режиме. Backend endpoint для файлов еще не подключен.")}><Paperclip size={16} /></Button>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Write a reply..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendReply();
                }}
              />
              <Button variant="ghost" className="h-9 w-9 rounded-xl px-0" onClick={() => setNotice("Голосовые сообщения пока в демо-режиме.")}><Mic size={16} /></Button>
              <Button variant="ai" className="h-9 w-9 rounded-xl px-0" onClick={sendReply}><Send size={16} /></Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-ai-gradient text-white">
                <Bot size={19} />
              </div>
              <div>
                <h2 className="font-semibold text-midnight">AI context</h2>
                <p className="text-xs text-slate-500">Smart summary</p>
              </div>
            </div>
            <div className="space-y-3">
              {["Клиент пришёл из WhatsApp", "Интересуется консультацией", "Вероятность записи: высокая", "Лучший следующий шаг: предложить 2 слота"].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                  <Zap size={15} className="mt-0.5 text-amber-500" />
                  {item}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
