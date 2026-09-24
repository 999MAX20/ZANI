import { useState } from "react";
import { Bot, ChevronRight, FileText } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/cn";
import type { AgentProfile } from "../../../types";
import type { AgentFormState, BotDraftState } from "../aiAgentsTypes";
import { FieldHint } from "./AIAgentsShared";
export function ProfileManagerSection({
  botDraft,
  setBotDraft,
  form,
  setForm,
  canManage,
}: {
  botDraft: BotDraftState;
  setBotDraft: React.Dispatch<React.SetStateAction<BotDraftState>>;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [showQuality, setShowQuality] = useState(false);

  return (
    <div className="space-y-5">
      <SettingsSection botDraft={botDraft} setBotDraft={setBotDraft} setForm={setForm} canManage={canManage} />
      <PromptingSection form={form} setForm={setForm} canManage={canManage} advanced={showQuality} />
      <Card variant="outlined">
        <CardBody>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowQuality((value) => !value)}
            aria-expanded={showQuality}
            aria-controls="ai-agent-quality-settings"
          >
            <div>
              <h3 className="text-lg font-black text-midnight">{t("aiSetup.advanced")}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiSetup.advancedText")}</p>
            </div>
            <ChevronRight size={18} className={cn("shrink-0 text-zani-faint transition", showQuality && "rotate-90 text-ai-700")} />
          </button>
        </CardBody>
      </Card>
      {showQuality ? <div id="ai-agent-quality-settings"><ModelsSection draft={botDraft} setDraft={setBotDraft} canManage={canManage} /></div> : null}
    </div>
  );
}

function SettingsSection({
  botDraft,
  setBotDraft,
  setForm,
  canManage,
}: {
  botDraft: BotDraftState;
  setBotDraft: React.Dispatch<React.SetStateAction<BotDraftState>>;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
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
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Input label={t("aiAgents.name")} value={botDraft.name} disabled={!canManage} onChange={(event) => { const name = event.target.value; setBotDraft((current) => ({ ...current, name })); setForm((current) => ({ ...current, name })); }} />
            </div>
            <div>
              <Select
                label={t("aiAgents.language")}
                value={botDraft.default_language}
                disabled={!canManage}
                onChange={(event) => {
                  const language = event.target.value;
                  setBotDraft((current) => ({ ...current, default_language: language }));
                  setForm((current) => ({ ...current, language }));
                }}
                options={[
                  { value: "ru", label: t("language.ru") },
                  { value: "kk", label: t("language.kk") },
                  { value: "en", label: t("language.en") },
                ]}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function PromptingSection({
  form,
  setForm,
  canManage,
  advanced,
}: {
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  canManage: boolean;
  advanced: boolean;
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
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Button type="button" variant="secondary" disabled={!canManage} onClick={() => setForm((current) => ({ ...current, role_description: t("aiSetup.dentalRole"), system_prompt: t("aiSetup.dentalPrompt"), rules_text: t("aiAgents.defaultRules"), escalation_text: t("aiSetup.dentalEscalation") }))}>
            {t("aiSetup.applyDentalRole")}
          </Button>
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
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <Textarea label={t("aiAgents.roleDescription")} value={form.role_description} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, role_description: event.target.value }))} />
          </div>
          {advanced ? <>
          <Input label={t("aiAgents.profileName")} value={form.name} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <div>
            <Textarea label={t("aiAgents.systemPrompt")} value={form.system_prompt} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, system_prompt: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.systemPrompt")}</FieldHint>
          </div>
          <div>
            <Textarea label={t("aiAgents.rules")} value={form.rules_text} disabled={!canManage} onChange={(event) => setForm((current) => ({ ...current, rules_text: event.target.value }))} />
            <FieldHint>{t("aiAgents.hint.rules")}</FieldHint>
          </div>

          </> : null}
        </div>

      </CardBody>
    </Card>
  );
}

function ModelsSection({ draft, setDraft, canManage }: { draft: BotDraftState; setDraft: React.Dispatch<React.SetStateAction<BotDraftState>>; canManage: boolean }) {
  const { t } = useI18n();
  const model = String(draft.settings_json.model || "");
  const temperature = Number(draft.settings_json.temperature ?? 0.4);
  const setModel = (value: string) => setDraft((current) => ({ ...current, settings_json: { ...current.settings_json, model: value } }));
  const setTemperature = (value: number) => setDraft((current) => ({ ...current, settings_json: { ...current.settings_json, temperature: value } }));

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
              { value: "", label: t("aiQuality.configuredModel") },
              ...(model && !["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"].includes(model) ? [{ value: model, label: model }] : []),
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

        </div>
      </CardBody>
    </Card>
  );
}
