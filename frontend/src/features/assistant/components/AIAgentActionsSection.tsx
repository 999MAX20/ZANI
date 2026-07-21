import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, FunctionSquare, Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../lib/cn";
import type { AgentProfile, Bot as BotType } from "../../../types";
import type { AgentFormState, AutoPipelineMode } from "../aiAgentsTypes";
import { autoPipelineFromSettings, defaultAllowedTools } from "../aiAgentsUtils";
import { ToggleSwitch } from "../../integrations/components/setup/IntegrationSetupUi";
import { HelpCard, FieldHint } from "./AIAgentsShared";
export function AgentActionsSection({
  bot,
  form,
  setForm,
  updateBot,
  saveProfile,
  canManage,
}: {
  bot: BotType;
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>;
  saveProfile: ReturnType<typeof useMutation<AgentProfile, Error, void>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <HelpCard
        title={t("aiAgents.onboarding.actions.helpTitle")}
        text={t("aiAgents.onboarding.actions.helpText")}
        recommendation={t("aiAgents.onboarding.actions.recommendation")}
      />
      <ControlSection bot={bot} updateBot={updateBot} canManage={canManage} />
      <FunctionsSection form={form} setForm={setForm} saveProfile={saveProfile} canManage={canManage} />
    </div>
  );
}

function ControlSection({ bot, updateBot, canManage }: { bot: BotType; updateBot: ReturnType<typeof useMutation<BotType, Error, Partial<BotType>>>; canManage: boolean }) {
  const { t } = useI18n();
  const [config, setConfig] = useState(() => autoPipelineFromSettings(bot.settings_json || {}));
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setConfig(autoPipelineFromSettings(bot.settings_json || {}));
  }, [bot.id, bot.settings_json]);

  const saveConfig = () => {
    const nextConfig = {
      ...config,
      enabled: config.mode !== "off" && config.enabled,
      min_lead_confidence: Math.max(0.1, Math.min(config.min_lead_confidence, 1)),
      min_deal_confidence: Math.max(0.1, Math.min(config.min_deal_confidence, 1)),
      max_auto_reply_chars: Math.max(120, Math.min(config.max_auto_reply_chars, 2000)),
    };
    updateBot.mutate({
      settings_json: {
        ...bot.settings_json,
        auto_crm_pipeline: nextConfig,
      },
    });
  };

  return (
    <Card>
      <CardBody>
        <div className="mb-5">
          <h3 className="text-xl font-black text-midnight">{t("aiAgents.control.pipelineTitle")}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{t("aiAgents.control.pipelineText")}</p>
        </div>

        <Select
          label={t("aiAgents.control.mode")}
          value={config.mode}
          onChange={(event) => {
            const mode = event.target.value as AutoPipelineMode;
            setConfig((current) => ({ ...current, mode, enabled: mode !== "off" }));
          }}
          options={[
            { value: "off", label: t("aiAgents.control.mode.off") },
            { value: "triage", label: t("aiAgents.control.mode.triage") },
            { value: "lead_task", label: t("aiAgents.control.mode.leadTask") },
            { value: "draft_deal", label: t("aiAgents.control.mode.draftDeal") },
          ]}
        />
        <FieldHint>{t("aiAgents.hint.pipelineMode")}</FieldHint>

        <div className="mt-5 grid gap-3">
          {[
            ["require_review_on_fallback", t("aiAgents.control.reviewFallbackTitle"), t("aiAgents.control.reviewFallbackText")],
            ["create_appointment", t("aiAgents.control.appointmentTitle"), t("aiAgents.control.appointmentText")],
            ["auto_send_reply", t("aiAgents.control.autoReplyTitle"), t("aiAgents.control.autoReplyText")],
          ].map(([key, title, text]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h4 className="font-black text-midnight">{title}</h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">{text}</p>
              </div>
              <ToggleSwitch
                checked={Boolean(config[key as keyof typeof config])}
                disabled={!canManage || config.mode === "off"}
                label={title}
                onChange={(next) => setConfig((current) => ({ ...current, [key]: next }))}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            <div>
              <h4 className="font-black text-midnight">{t("aiAgents.control.advancedTitle")}</h4>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{t("aiAgents.control.advancedText")}</p>
            </div>
            <ChevronRight size={18} className={cn("shrink-0 text-slate-400 transition", showAdvanced && "rotate-90 text-brand-700")} />
          </button>

          {showAdvanced ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Input
                  label={t("aiAgents.control.maxReplyChars")}
                  type="number"
                  min={120}
                  max={2000}
                  value={config.max_auto_reply_chars}
                  onChange={(event) => setConfig((current) => ({ ...current, max_auto_reply_chars: Number(event.target.value) }))}
                />
                <FieldHint>{t("aiAgents.hint.maxReplyChars")}</FieldHint>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.control.leadConfidence", { value: config.min_lead_confidence.toFixed(1) })}</span>
                <input className="w-full accent-brand-600" type="range" min="0.1" max="1" step="0.1" value={config.min_lead_confidence} onChange={(event) => setConfig((current) => ({ ...current, min_lead_confidence: Number(event.target.value) }))} />
                <FieldHint>{t("aiAgents.hint.leadConfidence")}</FieldHint>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-700">{t("aiAgents.control.dealConfidence", { value: config.min_deal_confidence.toFixed(1) })}</span>
                <input className="w-full accent-brand-600" type="range" min="0.1" max="1" step="0.1" value={config.min_deal_confidence} onChange={(event) => setConfig((current) => ({ ...current, min_deal_confidence: Number(event.target.value) }))} />
                <FieldHint>{t("aiAgents.hint.dealConfidence")}</FieldHint>
              </label>
            </div>
          ) : null}
        </div>

        <Button className="mt-5" type="button" disabled={!canManage} isLoading={updateBot.isPending} onClick={saveConfig}>
          <Save size={16} /> {t("common.save")}
        </Button>
      </CardBody>
    </Card>
  );
}

function FunctionsSection({
  form,
  setForm,
  saveProfile,
  canManage,
}: {
  form: AgentFormState;
  setForm: React.Dispatch<React.SetStateAction<AgentFormState>>;
  saveProfile: ReturnType<typeof useMutation<AgentProfile, Error, void>>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const tools = [
    ["create_lead", t("aiAgents.functions.leadTitle"), t("aiAgents.functions.leadText")],
    ["create_task", t("aiAgents.functions.taskTitle"), t("aiAgents.functions.taskText")],
    ["create_deal", t("aiAgents.functions.dealTitle"), t("aiAgents.functions.dealText")],
    ["handoff_to_manager", t("aiAgents.functions.managerTitle"), t("aiAgents.functions.managerText")],
  ];
  const toggleTool = (tool: string, enabled: boolean) => {
    setForm((current) => ({
      ...current,
      allowed_tools: enabled
        ? Array.from(new Set([...current.allowed_tools, tool]))
        : current.allowed_tools.filter((item) => item !== tool),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map(([key, title, text]) => {
          const enabled = form.allowed_tools.includes(key);
          return (
        <Card key={key}>
          <CardBody className="flex min-h-[170px] flex-col">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <FunctionSquare size={20} />
            </div>
            <h3 className="mt-4 text-lg font-black text-midnight">{title}</h3>
            <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-500">{text}</p>
            <FieldHint>{t(`aiAgents.hint.tool.${key}`)}</FieldHint>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-black text-slate-600">{enabled ? t("aiAgents.functions.enabled") : t("aiAgents.functions.disabled")}</span>
              <ToggleSwitch checked={enabled} disabled={!canManage} label={title} onChange={(next) => toggleTool(key, next)} />
            </div>
          </CardBody>
        </Card>
          );
        })}
      </div>
      <Button type="button" disabled={!canManage} isLoading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
        <Save size={16} /> {t("aiAgents.functions.save")}
      </Button>
    </div>
  );
}
