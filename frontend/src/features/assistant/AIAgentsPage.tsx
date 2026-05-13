import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, BrainCircuit, CheckCircle2, Plus, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { agentProfilesApi } from "../../api/ai";
import { botsApi } from "../../api/bots";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { useActiveBusiness } from "../../hooks/useBusiness";
import type { AgentProfile, Id } from "../../types";

type AgentFormState = {
  id: Id | null;
  name: string;
  bot: string;
  role_description: string;
  tone: AgentProfile["tone"];
  language: string;
  is_active: boolean;
  system_prompt: string;
  rules_text: string;
  escalation_text: string;
};

const emptyForm: AgentFormState = {
  id: null,
  name: "Zani assistant",
  bot: "",
  role_description: "Qualify leads and help managers reply faster.",
  tone: "friendly",
  language: "ru",
  is_active: true,
  system_prompt: "Be concise, helpful and do not promise unavailable slots.",
  rules_text: "Do not send messages automatically.\nEscalate complex questions to a manager.",
  escalation_text: "handoff_required: pricing dispute, medical/legal question, angry client",
};

function jsonFromLines(text: string) {
  return {
    items: text
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function formFromProfile(profile: AgentProfile): AgentFormState {
  return {
    id: profile.id,
    name: profile.name,
    bot: profile.bot ? String(profile.bot) : "",
    role_description: profile.role_description,
    tone: profile.tone,
    language: profile.language,
    is_active: profile.is_active,
    system_prompt: profile.system_prompt,
    rules_text: Array.isArray(profile.rules_json?.items) ? (profile.rules_json.items as string[]).join("\n") : "",
    escalation_text: Array.isArray(profile.escalation_rules_json?.items) ? (profile.escalation_rules_json.items as string[]).join("\n") : "",
  };
}

export function AIAgentsPage() {
  const queryClient = useQueryClient();
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const profiles = useQuery({ queryKey: ["ai-agent-profiles"], queryFn: agentProfilesApi.list });
  const bots = useQuery({ queryKey: ["bots"], queryFn: botsApi.list });
  const [form, setForm] = useState<AgentFormState>(emptyForm);

  const selectedProfile = useMemo(() => profiles.data?.find((profile) => profile.id === form.id) || null, [profiles.data, form.id]);

  useEffect(() => {
    if (!form.id && profiles.data?.[0]) {
      setForm(formFromProfile(profiles.data[0]));
    }
  }, [profiles.data, form.id]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      const payload = {
        business: business.id,
        bot: form.bot ? Number(form.bot) : null,
        name: form.name,
        role_description: form.role_description,
        tone: form.tone,
        language: form.language,
        is_active: form.is_active,
        system_prompt: form.system_prompt,
        rules_json: jsonFromLines(form.rules_text),
        allowed_tools_json: { placeholder: ["create_task", "create_lead", "handoff_to_manager"] },
        escalation_rules_json: jsonFromLines(form.escalation_text),
      };
      return form.id ? agentProfilesApi.update({ id: form.id, payload }) : agentProfilesApi.create(payload);
    },
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-agent-profiles"] });
      setForm(formFromProfile(profile));
    },
  });

  if (isBusinessLoading || profiles.isLoading || bots.isLoading) return <LoadingState label="Загружаем AI agents..." />;
  if (!business) return <ErrorState message="Создайте бизнес, чтобы настраивать AI agents." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">Agent profiles</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-midnight sm:text-5xl">AI agents</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Управляемые профили поведения для AI drafts. Они помогают suggested replies, но не отправляют сообщения автоматически.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setForm(emptyForm)}>
          <Plus size={18} />New profile
        </Button>
      </div>

      {profiles.error ? <ErrorState message={getApiErrorMessage(profiles.error)} /> : null}
      {saveMutation.error ? <ErrorState message={getApiErrorMessage(saveMutation.error)} /> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-bold text-midnight">Profiles</h2>
              <p className="text-sm text-slate-500">{profiles.data?.length || 0} профилей</p>
            </div>
            {!profiles.data?.length ? (
              <div className="p-4">
                <EmptyState title="Профилей пока нет" description="Создайте первый agent profile для бота или всего бизнеса." />
              </div>
            ) : null}
            <div className="divide-y divide-slate-100">
              {(profiles.data || []).map((profile) => (
                <button
                  key={profile.id}
                  className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${
                    selectedProfile?.id === profile.id ? "bg-brand-50/70" : "bg-white/40"
                  }`}
                  onClick={() => setForm(formFromProfile(profile))}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ai-gradient text-white">
                      <BrainCircuit size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-midnight">{profile.name}</p>
                      <p className="truncate text-sm text-slate-500">{profile.bot_name || "Business default"}</p>
                      <div className="mt-2 flex gap-2">
                        <StatusBadge status={profile.tone} />
                        {profile.is_active ? <StatusBadge status="active" /> : <StatusBadge status="paused" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <SlidersHorizontal size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-midnight">{form.id ? "Edit agent profile" : "Create agent profile"}</h2>
                <p className="text-sm text-slate-500">Prompt behavior, tone, language and safe tool placeholders.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white/85 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Bot</span>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white/85 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  value={form.bot}
                  onChange={(event) => setForm((current) => ({ ...current, bot: event.target.value }))}
                >
                  <option value="">Business default</option>
                  {(bots.data || []).map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tone</span>
                <select
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white/85 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  value={form.tone}
                  onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value as AgentProfile["tone"] }))}
                >
                  <option value="friendly">Friendly</option>
                  <option value="expert">Expert</option>
                  <option value="formal">Formal</option>
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Language</span>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white/85 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  value={form.language}
                  onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4">
              <Textarea
                label="Role description"
                value={form.role_description}
                onChange={(event) => setForm((current) => ({ ...current, role_description: event.target.value }))}
              />
              <Textarea
                label="System prompt"
                value={form.system_prompt}
                onChange={(event) => setForm((current) => ({ ...current, system_prompt: event.target.value }))}
              />
              <Textarea
                label="Rules"
                value={form.rules_text}
                onChange={(event) => setForm((current) => ({ ...current, rules_text: event.target.value }))}
              />
              <Textarea
                label="Escalation rules"
                value={form.escalation_text}
                onChange={(event) => setForm((current) => ({ ...current, escalation_text: event.target.value }))}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-ai-100 bg-ai-50 p-4 text-sm text-ai-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={18} /> Tools are placeholders until confirmation flows are implemented.
              </div>
              <label className="inline-flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                />
                Active
              </label>
            </div>

            <Button className="mt-5" variant="ai" onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
              {form.id ? <Save size={18} /> : <CheckCircle2 size={18} />}
              {form.id ? "Save profile" : "Create profile"}
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex items-start gap-3">
          <Bot className="mt-1 text-brand-600" size={20} />
          <p className="text-sm leading-6 text-slate-600">
            При генерации suggested reply для bot conversation backend сначала ищет активный profile у конкретного бота,
            затем fallback profile бизнеса. Auto-send не включается.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
