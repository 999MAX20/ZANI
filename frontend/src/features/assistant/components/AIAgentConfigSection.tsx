import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, ChevronRight, FileText, Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { MetricCard } from "../../../components/ui/MetricCard";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/Switch";
import { Textarea } from "../../../components/ui/Textarea";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/cn";
import type { AgentProfile, Bot as BotType } from "../../../types";
import type { AgentFormState, BotDraftState } from "../aiAgentsTypes";
import { HelpCard, FieldHint } from "./AIAgentsShared";
export function ProfileManagerSection({
  bot,
  channelsCount,
  messagesCount,
  botDraft,
  setBotDraft,
  form,
  setForm,
  updateBot,
  canManage,
}: {
  bot: BotType;
  channelsCount: number;
  messagesCount: number;
  botDraft: BotDraftState;
  setBotDraft: React.Dispatch<React.SetStateAction<BotDraftState>>;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showQuality, setShowQuality] = useState(false);

  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.profile.helpTitle")}
        text={t("aiAgents.onboarding.profile.helpText")}
        recommendation={t("aiAgents.onboarding.profile.recommendation")}
      />
      <SettingsSection bot={bot} channelsCount={channelsCount} messagesCount={messagesCount} botDraft={botDraft} setBotDraft={setBotDraft} canManage={canManage} />
      <PromptingSection form={form} setForm={setForm} canManage={canManage} />
      <Card variant="outlined">
        <CardBody>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowQuality((value) => !value)}
          >
            <div>
              <h3 className="text-lg font-black text-midnight">{t("aiAgents.qualityAdvanced")}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.qualityAdvancedText")}</p>
            </div>
            <ChevronRight size={18} className={cn("shrink-0 text-zani-faint transition", showQuality && "rotate-90 text-ai-700")} />
          </button>
        </CardBody>
      </Card>
      {showQuality ? <ModelsSection bot={bot} updateBot={updateBot} canManage={canManage} /> : null}
    </div>
  );
}

function SettingsSection({
  bot,
  channelsCount,
  messagesCount,
  botDraft,
  setBotDraft,
  canManage,
}: {
  bot: BotType;
  channelsCount: number;
  messagesCount: number;
  botDraft: BotDraftState;
  setBotDraft: React.Dispatch<React.SetStateAction<BotDraftState>>;
  canManage: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <Card variant="outlined">
        <CardBody>
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-600 text-white">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-midnight">{t("aiAgents.generalSettings")}</h3>
              <p className="text-sm font-semibold text-slate-500">{t("aiAgents.generalSettingsText")}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Input label={t("aiAgents.name")} value={botDraft.name} disabled={!canManage} onChange={(event) => setBotDraft((current) => ({ ...current, name: event.target.value }))} />
              <FieldHint>{t("aiAgents.hint.agentName")}</FieldHint>
            </div>
            <div>
              <Input label={t("aiAgents.language")} value={botDraft.default_language} disabled={!canManage} onChange={(event) => setBotDraft((current) => ({ ...current, default_language: event.target.value }))} />
              <FieldHint>{t("aiAgents.hint.agentLanguage")}</FieldHint>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label={t("aiAgents.statusLabel")} value={bot.status === "active" ? t("aiAgents.status.active") : bot.status === "paused" ? t("aiAgents.status.paused") : t("aiAgents.status.draft")} compact />
            <MetricCard label={t("aiAgents.channelsMetric")} value={String(channelsCount)} compact />
            <MetricCard label={t("aiAgents.messagesMetric")} value={String(messagesCount)} compact />
          </div>
          <FieldHint>{t("aiAgents.hint.agentStatus")}</FieldHint>

        </CardBody>
      </Card>
    </div>
  );
}

function PromptingSection({
  form,
  setForm,
  canManage,
}: {
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card variant="outlined">
      <CardBody>
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <FileText size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black text-midnight">{t("aiAgents.instructionTitle")}</h3>
            <p className="text-sm font-semibold text-slate-500">{t("aiAgents.instructionText")}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Input label={t("aiAgents.profileName")} value={form.name} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.profileName")}</FieldHint>
          </div>
          <div>
            <Select
              label={t("aiAgents.tone")}
              value={form.tone}
              disabled={!canManage}
              onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value as AgentProfile["tone"] }))}
              options={[
                { value: "friendly", label: t("aiAgents.tone.friendly") },
                { value: "expert", label: t("aiAgents.tone.expert") },
                { value: "formal", label: t("aiAgents.tone.formal") },
                { value: "sales", label: t("aiAgents.tone.sales") },
                { value: "support", label: t("aiAgents.tone.support") },
              ]}
            />
            <FieldHint>{t("aiAgents.hint.tone")}</FieldHint>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <Textarea label={t("aiAgents.roleDescription")} value={form.role_description} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, role_description: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.role")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.systemPrompt")} value={form.system_prompt} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, system_prompt: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.systemPrompt")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.rules")} value={form.rules_text} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, rules_text: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.rules")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.escalationRules")} value={form.escalation_text} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, escalation_text: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.escalation")}</FieldHint>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-control border border-zani-border bg-surface-muted p-3">
          <span className="text-sm font-semibold text-zani-subtle">{t("aiAgents.profileActive")}</span>
          <ToggleSwitch
            checked={form.is_active}
            disabled={!canManage}
            label={t("aiAgents.profileActive")}
            tone="ai"
            onChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function ModelsSection({ bot, updateBot, canManage }: { bot: BotType; updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>; canManage: boolean }) {
  const { t } = useI18n();
  const settings = bot.settings_json || {};
  const [model, setModel] = useState(String(settings.model || "gpt-4.1"));
  const [temperature, setTemperature] = useState(Number(settings.temperature ?? 0.4));

  useEffect(() => {
    setModel(String(bot.settings_json?.model || "gpt-4.1"));
    setTemperature(Number(bot.settings_json?.temperature ?? 0.4));
  }, [bot.id, bot.settings_json]);

  return (
    <Card variant="outlined">
      <CardBody>
        <h3 className="text-xl font-black text-midnight">{t("aiAgents.modelsTitle")}</h3>
        <div className="mt-4 grid gap-4">
          <Select
            label={t("aiAgents.responseMode")}
            value={model}
            disabled={!canManage}
            onChange={(event) => setModel(event.target.value)}
            options={[
              { value: "gpt-4.1", label: t("aiAgents.responseMode.quality") },
              { value: "gpt-4.1-mini", label: t("aiAgents.responseMode.fast") },
              { value: "gpt-4o-mini", label: t("aiAgents.responseMode.economy") },
            ]}
          />
          <FieldHint>{t("aiAgents.hint.responseMode")}</FieldHint>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.responseFreedom", { value: temperature.toFixed(1) })}</span>
            <input className="w-full accent-ai-600" type="range" min="0" max="1" step="0.1" value={temperature} disabled={!canManage} onChange={(event) => setTemperature(Number(event.target.value))} />
            <FieldHint>{t("aiAgents.hint.temperature")}</FieldHint>
          </label>
          <Button
            type="button"
            disabled={!canManage}
            isLoading={updateBot.isPending}
            onClick={() => updateBot.mutate({ settings_json: { ...bot.settings_json, model, temperature } })}
          >
            <Save size={16} /> {t("common.save")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
