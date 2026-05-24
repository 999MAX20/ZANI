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
import { useI18n } from "../../lib/i18n";
import type { Business } from "../../types";

export function OnboardingPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
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
  if (!business) return <ErrorState message={t("onboarding.noBusiness")} />;

  const currentStatus = status.data;
  const selected = templates.data?.find((template) => template.key === selectedTemplate) || templates.data?.[0];
  const error = applyMutation.error || demoMutation.error || setupChannelMutation.error || firstMessageMutation.error || templates.error || status.error;

  return (
    <>
      <PageHeader
        title={t("onboarding.title")}
        description={t("onboarding.description")}
        actions={<Link to="/dashboard"><Button variant="secondary">{t("onboarding.backDashboard")}</Button></Link>}
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
                <h2 className="text-xl font-black text-midnight">{t("onboarding.templateTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("onboarding.templateText")}</p>
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
                <TemplateLine label={t("onboarding.templatePipeline")} items={selected.stages} />
                <TemplateLine label={t("onboarding.templateServices")} items={selected.services} />
                <TemplateLine label={t("onboarding.templateResources")} items={selected.resources} />
                <TemplateLine label={t("onboarding.templateReplies")} items={selected.quick_replies} />
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => applyMutation.mutate()} isLoading={applyMutation.isPending}>
                <Play size={16} />
                {t("onboarding.applyTemplate")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => demoMutation.mutate()} isLoading={demoMutation.isPending}>
                {t("onboarding.createDemoFlow")}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("onboarding.checklistEyebrow")}</p>
                <h2 className="mt-2 text-xl font-black text-midnight">{t("onboarding.checklistTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("onboarding.checklistText")}</p>
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
              <Link to="/dashboard/leads"><Button className="w-full" variant="secondary">{t("nav.leads")}</Button></Link>
              <Link to="/dashboard/calendar"><Button className="w-full" variant="secondary">{t("nav.calendar")}</Button></Link>
              <Link to="/dashboard/settings"><Button className="w-full" variant="secondary">{t("nav.settings")}</Button></Link>
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
                <h2 className="text-xl font-black text-midnight">{t("onboarding.firstChannelTitle")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {t("onboarding.firstChannelText")}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Button type="button" onClick={() => setupChannelMutation.mutate("website")} isLoading={setupChannelMutation.isPending}>
                {t("onboarding.channelWebsite")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setupChannelMutation.mutate("telegram")} isLoading={setupChannelMutation.isPending}>
                {t("onboarding.channelTelegram")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setupChannelMutation.mutate("whatsapp")} isLoading={setupChannelMutation.isPending}>
                {t("onboarding.channelWhatsapp")}
              </Button>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              {t("onboarding.mockConnectorText")}
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
                <h2 className="text-xl font-black text-midnight">{t("onboarding.firstMessageTitle")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {t("onboarding.firstMessageText")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => firstMessageMutation.mutate()} isLoading={firstMessageMutation.isPending}>
                {t("onboarding.createFirstMessage")}
              </Button>
              <Link to="/dashboard/conversations"><Button type="button" variant="secondary">{t("onboarding.openConversations")}</Button></Link>
              <Link to="/dashboard/integrations"><Button type="button" variant="secondary">{t("nav.integrations")}</Button></Link>
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
