import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { botAiApi, type AgentPreviewMessage } from "../../../api/bots";
import { getApiErrorMessage } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Textarea } from "../../../components/ui/Textarea";
import { StatusNotice } from "../../../components/ui/StatusNotice";
import { ErrorState } from "../../../components/ui/StateViews";
import { useI18n } from "../../../lib/i18n";

export function AIAgentPreview({ botId, blocked, canTest }: { botId: number; blocked: boolean; canTest: boolean }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<AgentPreviewMessage[]>([]);
  const preview = useMutation({
    mutationFn: (history: AgentPreviewMessage[]) => botAiApi.preview(botId, history),
    onSuccess: (result, history) => {
      setMessages([...history, ...(result.reply ? [{ direction: "outbound" as const, text: result.reply }] : [])]);
      setText("");
    },
  });
  const disabled = blocked || !canTest || preview.isPending;
  return (
    <Card variant="outlined">
      <CardBody className="space-y-4">
        <h3 className="text-lg font-semibold">{t("aiSetup.previewTitle")}</h3>
        <p className="text-sm text-zani-subtle">{t("aiSetup.previewScope")}</p>
        {!canTest ? <ErrorState message={t("aiSetup.previewForbidden")} /> : blocked ? (
          <StatusNotice compact tone="warning" title={t("aiSetup.saveBeforeTest")} />
        ) : null}
        <div className="flex flex-wrap gap-2">
          {["price", "booking", "complaint"].map((scenario) => (
            <Button key={scenario} type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => setText(t(`aiSetup.example.${scenario}`))}>
              {t(`aiSetup.scenario.${scenario}`)}
            </Button>
          ))}
        </div>
        <div role="log" aria-label={t("aiSetup.previewTitle")} className="space-y-3">
          {messages.map((message, index) => (
            <div key={index} className="rounded-control bg-surface-warm p-3">
              <p className="text-xs font-semibold text-zani-subtle">{t(message.direction === "inbound" ? "aiAgents.client" : "aiAgents.reply")}</p>
              <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
            </div>
          ))}
        </div>
        {preview.data ? <div className="space-y-2" aria-live="polite">
          <StatusNotice compact tone={preview.data.handoff_required ? "warning" : "success"}
            title={t(preview.data.handoff_required ? "aiSetup.handoff" : preview.data.automatic_reply_enabled ? "aiSetup.automatic" : "aiSetup.draftOnly")}
            description={preview.data.summary} />
          <p className="text-sm text-zani-subtle">{t(preview.data.provider_state === "live" ? "aiAgents.aiProviderLive" : "aiQuality.mock")}</p>
          {preview.data.sources.length ? <ul aria-label={t("aiAgents.aiSources")} className="flex flex-wrap gap-2 text-xs text-zani-subtle">
            {preview.data.sources.map((source) => <li key={`${source.type}-${source.id}`}>{source.label}</li>)}
          </ul> : null}
        </div> : null}
        {preview.error ? <ErrorState message={getApiErrorMessage(preview.error)} /> : null}
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && text.trim()) preview.mutate([...messages.slice(-14), { direction: "inbound", text: text.trim() }]);
        }}>
          <Textarea label={t("aiSetup.message")} value={text} maxLength={2000} disabled={disabled} onChange={(event) => setText(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={disabled || !text.trim()} isLoading={preview.isPending}>{t("aiSetup.testReply")}</Button>
            <Button type="button" variant="secondary" disabled={preview.isPending} onClick={() => { setMessages([]); setText(""); preview.reset(); }}>{t("aiSetup.resetTest")}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
