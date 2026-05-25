import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";

import { botChannelsApi, botsApi, telegramChannelApi, websiteChatApi } from "../../api/bots";
import { businessConnectorsApi, type BusinessConnectorPayload } from "../../api/connectors";
import { importExportApi, type ImportEntity } from "../../api/importExport";
import { getApiErrorMessage } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../auth/AuthProvider";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import { useI18n } from "../../lib/i18n";
import { hasPermission } from "../../lib/permissions";
import { ConnectorCard } from "./components/ConnectorCard";
import type { Bot, BotChannel, BusinessConnector, ConnectorCapability, Id, ImportJob } from "../../types";

type CapabilityFilter = "all" | "included" | "self_service" | "request" | "upgrade" | "roadmap";
type CapabilityGroup = "all" | ConnectorCapability["capability"];

const importEntityOptions: Array<{ value: ImportEntity; labelKey: string; helperKey: string }> = [
  { value: "clients", labelKey: "integrations.import.clients", helperKey: "integrations.import.clientsHelp" },
  { value: "leads", labelKey: "integrations.import.leads", helperKey: "integrations.import.leadsHelp" },
  { value: "sales", labelKey: "integrations.import.sales", helperKey: "integrations.import.salesHelp" },
  { value: "catalog", labelKey: "integrations.import.catalog", helperKey: "integrations.import.catalogHelp" },
];

function capabilityGroupLabel(capability: ConnectorCapability, t: (key: string) => string) {
  return t(`integrations.capability.${capability.capability}`) || capability.capability;
}

function scrollToIntegrationSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatIntegrationEvent(status?: string, createdAt?: string | null, emptyLabel?: string) {
  if (!status && !createdAt) return emptyLabel || "";
  if (!createdAt) return status || "";
  return `${status || ""} · ${new Date(createdAt).toLocaleString()}`.trim();
}

function dataConnectorStatusLabel(status: BusinessConnector["status"] | undefined, t: (key: string) => string) {
  if (!status) return t("integrations.data.status.request");
  const labels: Record<string, string> = {
    connected: "integrations.merchantStatus.connected",
    pending_request: "integrations.merchantStatus.pending_request",
    provider_configuring: "integrations.merchantStatus.pending_request",
    setup_required: "integrations.merchantStatus.setup_required",
    needs_attention: "integrations.merchantStatus.setup_required",
    failed: "integrations.merchantStatus.error",
    error: "integrations.merchantStatus.error",
    expired_credentials: "integrations.merchantStatus.error",
    disabled: "integrations.merchantStatus.disconnected",
    disconnected: "integrations.merchantStatus.disconnected",
  };
  return t(labels[status] || "integrations.merchantStatus.available");
}

function IntegrationOnboardingGuide({
  connectedCount,
  hasWebsiteChannel,
  hasTelegramChannel,
  hasWhatsAppRequest,
  hasAnyDataConnector,
}: {
  connectedCount: number;
  hasWebsiteChannel: boolean;
  hasTelegramChannel: boolean;
  hasWhatsAppRequest: boolean;
  hasAnyDataConnector: boolean;
}) {
  const { t } = useI18n();
  const steps = [
    {
      title: t("integrations.guide.importTitle"),
      description: t("integrations.guide.importText"),
      status: hasAnyDataConnector ? "started" : "first",
      section: "integration-import",
      cta: hasAnyDataConnector ? t("integrations.guide.openImport") : t("integrations.guide.startImport"),
    },
    {
      title: t("integrations.guide.channelsTitle"),
      description: t("integrations.guide.channelsText"),
      status: hasWebsiteChannel || hasTelegramChannel ? "started" : "next",
      section: hasTelegramChannel ? "integration-website" : "integration-telegram",
      cta: hasWebsiteChannel || hasTelegramChannel ? t("integrations.guide.checkChannels") : t("integrations.guide.connectChannel"),
    },
    {
      title: t("integrations.guide.whatsappTitle"),
      description: t("integrations.guide.whatsappText"),
      status: hasWhatsAppRequest ? "done" : "request",
      section: "integration-requests",
      cta: hasWhatsAppRequest ? t("integrations.guide.requestCreated") : t("integrations.guide.fillRequest"),
    },
    {
      title: t("integrations.guide.demoSyncTitle"),
      description: t("integrations.guide.demoSyncText"),
      status: connectedCount ? "ready" : "pilot",
      section: "integration-data",
      cta: t("integrations.guide.openDataConnectors"),
    },
  ];

  const statusClass: Record<string, string> = {
    first: "bg-brand-50 text-brand-700 ring-brand-100",
    next: "bg-slate-100 text-slate-700 ring-slate-200",
    request: "bg-violet-50 text-violet-700 ring-violet-100",
    started: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    done: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    ready: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    pilot: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div className="mb-5 overflow-hidden rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-premium backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">{t("integrations.guide.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-midnight">{t("integrations.guide.title")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {t("integrations.guide.description")}
          </p>
        </div>
        <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">{t("integrations.guide.activeConnections")}</p>
          <p className="mt-1 text-3xl font-black">{connectedCount}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        {steps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => scrollToIntegrationSection(step.section)}
            className="group rounded-3xl border border-slate-100 bg-slate-50/80 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-midnight shadow-sm">
                {index + 1}
              </span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ring-1 ${statusClass[step.status]}`}>
                {step.status}
              </span>
            </div>
            <p className="mt-4 font-black text-midnight">{step.title}</p>
            <p className="mt-1 min-h-[48px] text-sm leading-6 text-slate-500">{step.description}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-black text-brand-700">
              {step.cta}
              <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExcelCsvImportPanel({ businessId }: { businessId: Id }) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [entity, setEntity] = useState<ImportEntity>("clients");
  const [file, setFile] = useState<File | null>(null);
  const [activeImportId, setActiveImportId] = useState<Id | null>(null);
  const jobsQuery = useQuery({
    queryKey: ["import-jobs", businessId],
    queryFn: importExportApi.importJobs,
  });
  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t("integrations.import.chooseFile"));
      return importExportApi.upload({ business: businessId, entity, file });
    },
    onSuccess: (job) => {
      setActiveImportId(job.id);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
  });
  const confirmMutation = useMutation({
    mutationFn: importExportApi.confirm,
    onSuccess: (job) => {
      setActiveImportId(job.id);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
  const templateMutation = useMutation({
    mutationFn: importExportApi.downloadTemplate,
  });
  const jobs = jobsQuery.data || [];
  const activeImport = jobs.find((job) => job.id === activeImportId) || jobs[0];
  const rowErrors = activeImport?.errors_json?.rows || [];
  const duplicates = activeImport?.duplicates_json?.rows || [];
  const importSummary = activeImport?.summary_json || activeImport?.preview_json?.import_summary;
  const selectedOption = importEntityOptions.find((item) => item.value === entity);
  const error = jobsQuery.error || uploadMutation.error || confirmMutation.error || templateMutation.error;

  return (
    <div id="integration-import" className="scroll-mt-24 mb-5 rounded-3xl border border-emerald-100 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{t("integrations.import.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-black text-midnight">{t("integrations.import.title")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {t("integrations.import.description")}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => templateMutation.mutate(entity)} isLoading={templateMutation.isPending}>
          <FileSpreadsheet size={16} /> {t("integrations.import.downloadTemplate")}
        </Button>
      </div>

      {error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(error)} /></div> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[240px_1fr_auto]">
        <Select
          value={entity}
          onChange={(event) => setEntity(event.target.value as ImportEntity)}
          options={importEntityOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
        />
        <Input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <Button type="button" onClick={() => uploadMutation.mutate()} disabled={!file} isLoading={uploadMutation.isPending}>
          <Upload size={16} /> {t("integrations.import.preview")}
        </Button>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-500">{selectedOption ? t(selectedOption.helperKey) : ""}</p>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-black text-midnight">{activeImport?.original_filename || t("integrations.import.noFile")}</p>
              <p className="mt-1 text-sm text-slate-500">
                {activeImport ? t("integrations.import.fileMeta", { entity: activeImport.entity_type, rows: activeImport.total_rows, status: activeImport.status }) : t("integrations.import.previewPlaceholder")}
              </p>
            </div>
            {activeImport?.status === "previewed" && !rowErrors.length ? (
              <Button type="button" onClick={() => confirmMutation.mutate(activeImport.id)} isLoading={confirmMutation.isPending}>
                {t("integrations.import.confirm")}
              </Button>
            ) : null}
          </div>

          {importSummary ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {[
                { label: t("integrations.import.summaryCreated"), value: importSummary.created || 0 },
                { label: t("integrations.import.summaryUpdated"), value: importSummary.updated || 0 },
                { label: t("integrations.import.summarySkipped"), value: importSummary.skipped || 0 },
                { label: t("integrations.import.summaryErrors"), value: importSummary.errors || 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                  <p className="mt-1 text-lg font-black text-midnight">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {rowErrors.length ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3">
              <p className="text-sm font-black text-red-800">{t("integrations.import.fixFile")}</p>
              <div className="mt-2 space-y-1">
                {rowErrors.slice(0, 5).map((item, index) => (
                  <p key={`${item.row}-${item.field}-${index}`} className="text-xs font-semibold text-red-700">
                    {t("integrations.import.rowError", { row: item.row, field: item.field, message: item.message })}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {activeImport ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.import.columnMapping")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(activeImport.mapping_json || {}).map(([field, header]) => (
                    <span key={field} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {field} {"<-"} {header}
                    </span>
                  ))}
                  {!Object.keys(activeImport.mapping_json || {}).length ? <span className="text-sm text-slate-500">{t("integrations.import.noMapping")}</span> : null}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.import.duplicates")}</p>
                <p className={duplicates.length ? "mt-2 text-sm font-bold text-amber-700" : "mt-2 text-sm font-bold text-emerald-700"}>
                  {t("integrations.import.duplicatesCount", { count: duplicates.length })}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {(activeImport?.preview_json?.rows || []).slice(0, 5).map((row, index) => (
              <div key={index} className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600 last:border-b-0">
                {Object.entries(row).slice(0, 6).map(([key, value]) => `${key}: ${value || "-"}`).join(" · ")}
              </div>
            ))}
            {!(activeImport?.preview_json?.rows || []).length ? <p className="px-3 py-4 text-sm text-slate-500">{t("integrations.import.previewEmpty")}</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <p className="font-black text-midnight">{t("integrations.import.history")}</p>
          <div className="mt-3 space-y-2">
            {jobs.slice(0, 8).map((job: ImportJob) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setActiveImportId(job.id)}
                className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm transition hover:bg-slate-100"
              >
                <span className="font-bold text-midnight">#{job.id} {job.entity_type}</span>
                <span className="ml-2 text-slate-500">{job.status} · {job.imported_count}/{job.total_rows}</span>
              </button>
            ))}
            {!jobsQuery.isLoading && !jobs.length ? <p className="text-sm text-slate-500">{t("integrations.import.noImports")}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildWebsiteWidgetSnippet(publicToken: string, apiBaseUrl: string) {
  return `<script src="/widget/zani-widget.js" data-zani-token="${publicToken}" data-zani-api="${apiBaseUrl}"></script>`;
}

function WebsiteChatConnectorPanel({
  websiteChannel,
  isLoading,
}: {
  websiteChannel?: BotChannel;
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [preview, setPreview] = useState({
    full_name: t("integrations.website.previewName"),
    phone: "+77015550000",
    email: "",
    message: t("integrations.website.previewMessage"),
  });
  const [followUpMessage, setFollowUpMessage] = useState(t("integrations.website.followUpMessage"));
  const [conversationId, setConversationId] = useState("");
  const [notice, setNotice] = useState("");
  const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const snippet = websiteChannel ? buildWebsiteWidgetSnippet(websiteChannel.public_token, apiBaseUrl) : "";

  const createConversation = useMutation({
    mutationFn: () => {
      if (!websiteChannel) throw new Error("Website channel is not configured.");
      return websiteChatApi.createConversation({
        publicToken: websiteChannel.public_token,
        payload: {
          full_name: preview.full_name,
          phone: preview.phone,
          email: preview.email,
          message: preview.message,
          external_user_id: `preview-${Date.now()}`,
        },
      });
    },
    onSuccess: (result) => {
      setConversationId(result.conversation_id);
      setNotice(t("integrations.website.conversationCreated", { lead: result.lead_id || "-", client: result.client_id || "-" }));
      queryClient.invalidateQueries({ queryKey: ["bot-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["bot-messages"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const sendFollowUp = useMutation({
    mutationFn: () => {
      if (!websiteChannel || !conversationId) throw new Error("Create a conversation first.");
      return websiteChatApi.sendMessage({
        publicToken: websiteChannel.public_token,
        conversationId,
        message: followUpMessage,
      });
    },
    onSuccess: () => {
      setNotice(t("integrations.website.followUpAdded"));
      queryClient.invalidateQueries({ queryKey: ["bot-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["bot-messages"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
    },
  });

  const copySnippet = async () => {
    if (!snippet) return;
    await navigator.clipboard?.writeText(snippet);
    setNotice(t("integrations.website.snippetCopied"));
  };

  const error = createConversation.error || sendFollowUp.error;

  return (
    <div id="integration-website" className="scroll-mt-24 mb-5 rounded-3xl border border-blue-100 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <MessageSquareText size={22} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{t("integrations.website.eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-black text-midnight">{t("integrations.website.title")}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {t("integrations.website.description")}
            </p>
          </div>
        </div>
        <Link to="/dashboard/inbox?channel=website">
          <Button type="button" variant="secondary">
            <ExternalLink size={16} /> {t("integrations.website.openInbox")}
          </Button>
        </Link>
      </div>

      {isLoading ? <div className="mt-4"><LoadingState label={t("integrations.website.loading")} /></div> : null}

      {!isLoading && !websiteChannel ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5">
          <p className="font-black text-midnight">{t("integrations.website.notConfiguredTitle")}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t("integrations.website.notConfiguredText")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/dashboard/bots"><Button type="button" variant="secondary">{t("integrations.website.openBots")}</Button></Link>
            <Link to="/dashboard/pilot-readiness"><Button type="button" variant="ghost">{t("integrations.website.checkReadiness")}</Button></Link>
          </div>
        </div>
      ) : null}

      {websiteChannel ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-blue-900">{t("integrations.website.channelStatus", { status: websiteChannel.status })}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    {t("integrations.website.readyText")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={copySnippet}>
                    <Copy size={16} /> {t("integrations.website.copySnippet")}
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold text-blue-700">
                {t("integrations.website.copyNotice")}
              </p>
            </div>

            {notice ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
            {error ? <ErrorState message={getApiErrorMessage(error)} /> : null}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <p className="font-black text-midnight">{t("integrations.website.testTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t("integrations.website.testText")}
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                createConversation.mutate();
              }}
            >
              <Input label={t("integrations.website.name")} value={preview.full_name} onChange={(event) => setPreview({ ...preview, full_name: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t("integrations.website.phone")} value={preview.phone} onChange={(event) => setPreview({ ...preview, phone: event.target.value })} />
                <Input label={t("common.email")} value={preview.email} onChange={(event) => setPreview({ ...preview, email: event.target.value })} />
              </div>
              <Input label={t("integrations.website.message")} value={preview.message} onChange={(event) => setPreview({ ...preview, message: event.target.value })} required />
              <Button type="submit" isLoading={createConversation.isPending}>
                <Send size={16} /> {t("integrations.website.createDialog")}
              </Button>
            </form>

            {conversationId ? (
              <div className="mt-4 rounded-2xl bg-white p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{t("integrations.website.followUpTitle")}</p>
                <Input className="mt-3" value={followUpMessage} onChange={(event) => setFollowUpMessage(event.target.value)} />
                <Button
                  type="button"
                  className="mt-3"
                  variant="secondary"
                  disabled={!followUpMessage.trim()}
                  isLoading={sendFollowUp.isPending}
                  onClick={() => sendFollowUp.mutate()}
                >
                  <Send size={16} /> {t("integrations.website.addMessage")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TelegramConnectorWizard({
  businessId,
  bots,
  telegramChannel,
  canManage,
}: {
  businessId: Id;
  bots: Bot[];
  telegramChannel?: BotChannel;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [botToken, setBotToken] = useState("");
  const [notice, setNotice] = useState("");
  const webhookUrl = `${(import.meta.env.VITE_API_URL as string | undefined) || window.location.origin}/api/integrations/telegram/webhook/`;

  const telegramStatus = useQuery({
    queryKey: ["telegram-status", telegramChannel?.id],
    queryFn: () => telegramChannelApi.status(telegramChannel!.id),
    enabled: Boolean(telegramChannel?.id),
  });

  const ensureChannel = async () => {
    if (telegramChannel) return telegramChannel;
    const bot = bots[0] || await botsApi.create({
      business: businessId,
      name: "Telegram bot",
      status: "active",
      default_language: "ru",
      settings_json: {},
    });
    return botChannelsApi.create({
      bot: bot.id,
      channel: "telegram",
      status: "draft",
      external_id: "",
      config_json: {},
    });
  };

  const saveConfig = useMutation({
    mutationFn: async () => {
      const channel = await ensureChannel();
      const config = await telegramChannelApi.configure({
        channelId: channel.id,
        botToken,
      });
      const webhook = await telegramChannelApi.setWebhook({ channelId: channel.id, webhookUrl });
      return { channel, config, webhook };
    },
    onSuccess: (result) => {
      setBotToken("");
      setNotice(
        result.webhook?.mock
          ? t("integrations.telegram.savedMock", { reason: result.webhook.reason || t("integrations.telegram.unknownError") })
          : t("integrations.telegram.saved")
      );
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const channel = await ensureChannel();
      return telegramChannelApi.testConnection(channel.id);
    },
    onSuccess: (result) => {
      setNotice(
        result.ok
          ? (result.mock ? t("integrations.telegram.testMock") : t("integrations.telegram.testOk"))
          : t("integrations.telegram.testFailed", { reason: result.reason || t("integrations.telegram.unknownError") })
      );
      queryClient.invalidateQueries({ queryKey: ["bot-channels"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    },
  });

  const error = saveConfig.error || testConnection.error || telegramStatus.error;
  const tokenConfigured = telegramStatus.data?.token_configured || telegramChannel?.config_json?.bot_token === "configured";

  return (
    <div id="integration-telegram" className="scroll-mt-24 mb-5 rounded-3xl border border-sky-100 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">{t("integrations.telegram.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-black text-midnight">{t("integrations.telegram.title")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {t("integrations.telegram.description")}
          </p>
        </div>
        <Link to="/dashboard/inbox?channel=telegram">
          <Button type="button" variant="secondary"><ExternalLink size={16} /> {t("integrations.telegram.openInbox")}</Button>
        </Link>
      </div>

      {error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(error)} /></div> : null}
      {notice ? <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="font-black text-midnight">{t("integrations.telegram.ownerGuide")}</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <li>{t("integrations.telegram.step1")}</li>
            <li>{t("integrations.telegram.step2")}</li>
            <li>{t("integrations.telegram.step3")}</li>
            <li>{t("integrations.telegram.step4")}</li>
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.telegram.token")}</p>
              <p className={tokenConfigured ? "mt-1 font-bold text-emerald-700" : "mt-1 font-bold text-amber-700"}>
                {tokenConfigured ? t("integrations.telegram.tokenSaved") : t("integrations.telegram.tokenMissing")}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.telegram.messageIntake")}</p>
              <p className={telegramChannel ? "mt-1 font-bold text-emerald-700" : "mt-1 font-bold text-amber-700"}>
                {telegramChannel ? t("integrations.telegram.intakeConfigured") : t("integrations.telegram.intakePending")}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.telegram.webhook")}</p>
              <p className={telegramStatus.data?.webhook_configured ? "mt-1 font-bold text-emerald-700" : "mt-1 font-bold text-amber-700"}>
                {telegramStatus.data?.webhook_configured ? t("integrations.telegram.webhookConfigured") : t("integrations.telegram.webhookPending")}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.telegram.lastInbound")}</p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {formatIntegrationEvent(telegramStatus.data?.last_inbound_status, telegramStatus.data?.last_inbound_at, t("integrations.telegram.noEvents"))}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("integrations.telegram.lastOutbound")}</p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {formatIntegrationEvent(telegramStatus.data?.last_outbound_status, telegramStatus.data?.last_outbound_at, t("integrations.telegram.noEvents"))}
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold leading-6 text-sky-800">
            {t("integrations.telegram.betaNotice")}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <p className="font-black text-midnight">{t("integrations.telegram.supportSetupTitle")}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("integrations.telegram.supportSetupText")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!canManage || !telegramChannel} isLoading={testConnection.isPending} onClick={() => testConnection.mutate()}>
              <CheckCircle2 size={16} /> {t("integrations.telegram.testConnection")}
            </Button>
            <Link to="/dashboard/inbox?channel=telegram">
              <Button type="button" variant="ghost">
                <ExternalLink size={16} /> {t("integrations.telegram.openInbox")}
              </Button>
            </Link>
          </div>
          <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-black text-midnight">{t("integrations.telegram.advancedSetup")}</summary>
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveConfig.mutate();
              }}
            >
              <Input
                label={t("integrations.telegram.botFatherToken")}
                type="password"
                value={botToken}
                onChange={(event) => setBotToken(event.target.value)}
                placeholder={tokenConfigured ? t("integrations.telegram.tokenReplacePlaceholder") : t("integrations.telegram.tokenPlaceholder")}
                disabled={!canManage}
              />
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{t("integrations.telegram.advancedSetupHelp")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" disabled={!canManage || !botToken.trim()} isLoading={saveConfig.isPending}>
                  <ShieldCheck size={16} /> {t("integrations.telegram.save")}
                </Button>
              </div>
              {!canManage ? <p className="mt-3 text-sm font-semibold text-slate-500">{t("integrations.telegram.readOnly")}</p> : null}
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}

function RequestReadyConnectorPanel({
  provider,
  connector,
  businessId,
  canManage,
}: {
  provider: "whatsapp" | "instagram";
  connector?: BusinessConnector;
  businessId: Id;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState<Record<string, string>>(
    provider === "whatsapp"
      ? {
          company_name: "",
          phone_number: "",
          contact_person: "",
          preferred_method: "not_sure",
          monthly_messages: "0",
          has_meta_assets: "false",
          comment: "",
        }
      : {
          instagram_username: "",
          facebook_page: "",
          contact_person: "",
          comment: "",
        },
  );
  const label = provider === "whatsapp" ? "WhatsApp" : "Instagram";
  const isPending = connector?.status === "needs_attention";
  const requestStatus = connector?.status === "pending_request" || connector?.status === "provider_configuring" || connector?.status === "setup_required" || isPending
    ? connector.status
    : connector?.status || "not_requested";

  const submitRequest = useMutation({
    mutationFn: () => {
      if (provider === "whatsapp") {
        return businessConnectorsApi.requestWhatsApp({
          business: businessId,
          company_name: form.company_name || "",
          phone_number: form.phone_number || "",
          contact_person: form.contact_person || "",
          preferred_method: (form.preferred_method || "not_sure") as "not_sure" | "qr_pilot" | "meta_cloud" | "360dialog" | "twilio",
          monthly_messages: Number(form.monthly_messages || 0),
          has_meta_assets: form.has_meta_assets === "true",
          comment: form.comment || "",
        });
      }
      const payload: BusinessConnectorPayload = {
        business: businessId,
        provider,
        name: `${label} connection request`,
        capability: "communications",
        auth_type: "oauth",
        scopes_json: [],
        config_json: {
          request_type: `${provider}_connection_request`,
          request_status: "pending_request",
          requested_from_ui: true,
          provider_ready: ["meta_placeholder"],
          form,
        },
      };
      if (connector) {
        return businessConnectorsApi.update({ id: connector.id, payload });
      }
      return businessConnectorsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  return (
    <div className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">{t("integrations.request.eyebrow", { provider: label })}</p>
          <h3 className="mt-2 text-xl font-black text-midnight">{t("integrations.request.title", { provider: label })}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {provider === "whatsapp"
              ? t("integrations.request.whatsappText")
              : t("integrations.request.instagramText")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${isPending ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
          {t(`status.${requestStatus}`)}
        </span>
      </div>

      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submitRequest.mutate();
        }}
      >
        {provider === "whatsapp" ? (
          <>
            <Input label={t("integrations.request.companyName")} value={form.company_name || ""} onChange={(event) => setForm({ ...form, company_name: event.target.value })} disabled={!canManage} />
            <Input label={t("integrations.request.whatsappNumber")} value={form.phone_number || ""} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} disabled={!canManage} />
            <Input label={t("integrations.request.contactPerson")} value={form.contact_person || ""} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} disabled={!canManage} />
            <Select
              value={form.preferred_method || "not_sure"}
              onChange={(event) => setForm({ ...form, preferred_method: event.target.value })}
              disabled={!canManage}
              options={[
                { value: "not_sure", label: t("integrations.request.notSure") },
                { value: "qr_pilot", label: t("integrations.request.qrPilot") },
                { value: "meta_cloud", label: "Meta Cloud API" },
                { value: "360dialog", label: "360dialog" },
                { value: "twilio", label: "Twilio" },
              ]}
            />
            <Input label={t("integrations.request.monthlyMessages")} type="number" value={form.monthly_messages || "0"} onChange={(event) => setForm({ ...form, monthly_messages: event.target.value })} disabled={!canManage} />
            <Select
              value={form.has_meta_assets || "false"}
              onChange={(event) => setForm({ ...form, has_meta_assets: event.target.value })}
              disabled={!canManage}
              options={[
                { value: "false", label: t("integrations.request.metaAssetsNo") },
                { value: "true", label: t("integrations.request.metaAssetsYes") },
              ]}
            />
          </>
        ) : (
          <>
            <Input label={t("integrations.instagram.username")} value={form.instagram_username || ""} onChange={(event) => setForm({ ...form, instagram_username: event.target.value })} disabled={!canManage} />
            <Input label={t("integrations.request.facebookPage")} value={form.facebook_page || ""} onChange={(event) => setForm({ ...form, facebook_page: event.target.value })} disabled={!canManage} />
            <Input label={t("integrations.request.contactPerson")} value={form.contact_person || ""} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} disabled={!canManage} />
          </>
        )}
        <Input label={t("integrations.request.comment")} value={form.comment || ""} onChange={(event) => setForm({ ...form, comment: event.target.value })} disabled={!canManage} />
        <Button type="submit" variant="secondary" disabled={!canManage} isLoading={submitRequest.isPending}>
          <Send size={16} /> {connector ? t("integrations.request.update") : t("integrations.request.submit")}
        </Button>
      </form>
      {submitRequest.error ? <div className="mt-3"><ErrorState message={getApiErrorMessage(submitRequest.error)} /></div> : null}
      {submitRequest.isSuccess ? <p className="mt-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">{t("integrations.request.saved")}</p> : null}
    </div>
  );
}

const dataConnectorCatalog: Array<{
  provider: BusinessConnector["provider"];
  label: string;
  descriptionKey: string;
  capability: BusinessConnector["capability"];
  eventType: string;
}> = [
  {
    provider: "kaspi",
    label: "Kaspi",
    descriptionKey: "integrations.data.kaspiDescription",
    capability: "finance",
    eventType: "kaspi_order_imported",
  },
  {
    provider: "1c",
    label: "1C",
    descriptionKey: "integrations.data.oneCDescription",
    capability: "inventory",
    eventType: "sale_imported",
  },
  {
    provider: "google_sheets",
    label: "Google Sheets",
    descriptionKey: "integrations.data.googleSheetsDescription",
    capability: "sales",
    eventType: "sheet_row_imported",
  },
  {
    provider: "email",
    label: "Email",
    descriptionKey: "integrations.data.emailDescription",
    capability: "communications",
    eventType: "email_channel_requested",
  },
  {
    provider: "moysklad",
    label: "МойСклад",
    descriptionKey: "integrations.data.moyskladDescription",
    capability: "inventory",
    eventType: "moysklad_stock_imported",
  },
  {
    provider: "wildberries",
    label: "Wildberries",
    descriptionKey: "integrations.data.wildberriesDescription",
    capability: "finance",
    eventType: "order_imported",
  },
  {
    provider: "ozon",
    label: "Ozon",
    descriptionKey: "integrations.data.ozonDescription",
    capability: "finance",
    eventType: "order_imported",
  },
  {
    provider: "yandex_market",
    label: "Яндекс.Маркет",
    descriptionKey: "integrations.data.yandexMarketDescription",
    capability: "finance",
    eventType: "order_imported",
  },
];

function DataConnectorsFoundationPanel({
  businessId,
  connectorByProvider,
  canManage,
}: {
  businessId: Id;
  connectorByProvider: Map<string, BusinessConnector>;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [commentByProvider, setCommentByProvider] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const requestConnector = useMutation({
    mutationFn: ({ provider, label, capability, comment }: { provider: BusinessConnector["provider"]; label: string; capability: BusinessConnector["capability"]; comment: string }) => {
      const existing = connectorByProvider.get(provider);
      const payload: BusinessConnectorPayload = {
        business: businessId,
        provider,
        name: label,
        capability,
        auth_type: "connector",
        scopes_json: [],
        config_json: {
          request_status: "pending_request",
          requested_from_ui: true,
          pilot_mode: "request_or_import_only",
          no_write_back: true,
          comment,
        },
      };
      if (existing) {
        return businessConnectorsApi.update({ id: existing.id, payload });
      }
      return businessConnectorsApi.create(payload);
    },
    onSuccess: (connector) => {
      setNotice(t("integrations.data.requestSaved", { name: connector.name }));
      queryClient.invalidateQueries({ queryKey: ["business-connectors"] });
    },
  });

  const mockSync = useMutation({
    mutationFn: ({ connector }: { connector: BusinessConnector; eventType: string }) => businessConnectorsApi.mockSync(connector.id),
    onSuccess: () => {
      setNotice(t("integrations.data.demoImported"));
      queryClient.invalidateQueries({ queryKey: ["business-events"] });
    },
  });

  const error = requestConnector.error || mockSync.error;

  return (
    <div id="integration-data" className="scroll-mt-24 mb-5 rounded-3xl border border-amber-100 bg-white/95 p-5 shadow-soft">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">{t("integrations.data.eyebrow")}</p>
        <h2 className="mt-2 text-2xl font-black text-midnight">{t("integrations.data.title")}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          {t("integrations.data.description")}
        </p>
      </div>

      {notice ? <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}
      {error ? <div className="mt-4"><ErrorState message={getApiErrorMessage(error)} /></div> : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {dataConnectorCatalog.map((item) => {
          const connector = connectorByProvider.get(item.provider);
          const comment = commentByProvider[item.provider] || "";
          return (
            <div key={item.provider} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-midnight">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{t(item.descriptionKey)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                  {dataConnectorStatusLabel(connector?.status, t)}
                </span>
              </div>
              <Input
                className="mt-4"
                placeholder={t("integrations.data.commentPlaceholder")}
                value={comment}
                onChange={(event) => setCommentByProvider({ ...commentByProvider, [item.provider]: event.target.value })}
                disabled={!canManage}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canManage}
                  isLoading={requestConnector.isPending}
                  onClick={() => requestConnector.mutate({ provider: item.provider, label: item.label, capability: item.capability, comment })}
                >
                  <Send size={16} /> {connector ? t("integrations.data.update") : t("integrations.data.request")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canManage || !connector}
                  isLoading={mockSync.isPending}
                  onClick={() => connector && mockSync.mutate({ connector, eventType: item.eventType })}
                >
                  {t("integrations.data.checkDemoImport")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const canManage = hasPermission(user, business?.id, "integrations", "manage");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CapabilityFilter>("all");
  const [group, setGroup] = useState<CapabilityGroup>("all");

  const capabilities = useQuery({
    queryKey: ["connector-capabilities"],
    queryFn: businessConnectorsApi.capabilities,
  });
  const connectors = useQuery({
    queryKey: ["business-connectors", business?.id],
    queryFn: businessConnectorsApi.list,
    enabled: Boolean(business?.id),
  });
  const entityData = useEntityData({ enabled: Boolean(business?.id), bots: true, botChannels: true });

  const connectorByProvider = useMemo(() => {
    const map = new Map<string, BusinessConnector>();
    (connectors.data || []).forEach((connector) => map.set(connector.provider, connector));
    return map;
  }, [connectors.data]);

  const capabilityList = capabilities.data || [];
  const summary = useMemo(() => {
    return {
      total: capabilityList.length,
      included: capabilityList.filter((item) => item.availability === "included").length,
      request: capabilityList.filter((item) => item.action_behavior === "request").length,
      roadmap: capabilityList.filter((item) => ["soon", "roadmap"].includes(item.availability)).length,
      connected: (connectors.data || []).filter((item) => item.status === "connected").length,
    };
  }, [capabilityList, connectors.data]);

  const filteredCapabilities = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return capabilityList.filter((capability) => {
      const matchesSearch =
        !normalizedSearch ||
        [capability.label, capability.provider, capability.description, capabilityGroupLabel(capability, t)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesGroup = group === "all" || capability.capability === group;
      const matchesFilter =
        filter === "all" ||
        (filter === "self_service" && capability.action_behavior === "self_service") ||
        (filter === "request" && capability.action_behavior === "request") ||
        (filter === "included" && capability.availability === "included") ||
        (filter === "upgrade" && capability.availability === "upgrade") ||
        (filter === "roadmap" && ["soon", "roadmap"].includes(capability.availability));
      return matchesSearch && matchesGroup && matchesFilter;
    });
  }, [capabilityList, filter, group, search, t]);
  const hasExcelCsv = capabilityList.some((capability) => capability.provider === "excel_csv");
  const websiteChannel = (entityData.botChannels.data || []).find((channel) => channel.channel === "website");
  const telegramChannel = (entityData.botChannels.data || []).find((channel) => channel.channel === "telegram");
  const bots = entityData.bots.data || [];
  const hasWhatsAppRequest = Boolean(connectorByProvider.get("whatsapp"));
  const hasAnyDataConnector = ["kaspi", "1c", "google_sheets", "moysklad", "wildberries", "ozon", "yandex_market", "excel_csv"].some((provider) =>
    connectorByProvider.has(provider),
  );

  if (isBusinessLoading || capabilities.isLoading || connectors.isLoading || entityData.bots.isLoading || entityData.botChannels.isLoading) {
    return <LoadingState label={t("integrations.page.loading")} />;
  }

  if (!business) {
    return <EmptyState title={t("integrations.page.noBusinessTitle")} description={t("integrations.page.noBusinessDescription")} />;
  }

  return (
    <div>
      <PageHeader
        title={t("integrations.page.title")}
        description={t("integrations.page.description")}
        actions={
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="mr-2 inline" size={16} />
            {t("integrations.page.safeTokenNotice")}
          </div>
        }
      />

      {capabilities.error || connectors.error ? <ErrorState message={getApiErrorMessage(capabilities.error || connectors.error)} /> : null}

      <IntegrationOnboardingGuide
        connectedCount={summary.connected}
        hasWebsiteChannel={Boolean(websiteChannel)}
        hasTelegramChannel={Boolean(telegramChannel)}
        hasWhatsAppRequest={hasWhatsAppRequest}
        hasAnyDataConnector={hasAnyDataConnector}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-soft">
          <Sparkles className="text-brand-600" size={20} />
          <p className="mt-2 text-2xl font-black text-midnight">{summary.included}</p>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{t("integrations.page.includedTitle")}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("integrations.page.includedText")}</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-soft">
          <Send className="text-violet-600" size={20} />
          <p className="mt-2 text-2xl font-black text-midnight">{summary.request}</p>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{t("integrations.page.requestTitle")}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("integrations.page.requestText")}</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-soft">
          <Clock3 className="text-amber-600" size={20} />
          <p className="mt-2 text-2xl font-black text-midnight">{summary.roadmap}</p>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{t("integrations.page.roadmapTitle")}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("integrations.page.roadmapText")}</p>
        </div>
        <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-soft">
          <ShieldCheck className="text-emerald-600" size={20} />
          <p className="mt-2 text-2xl font-black text-midnight">{summary.connected}</p>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{t("integrations.page.connectedTitle")}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t("integrations.page.connectedText")}</p>
        </div>
      </div>

      <div className="mb-5 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("integrations.page.searchPlaceholder")} />
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value as CapabilityFilter)}
            options={[
              { value: "all", label: t("integrations.page.allStatuses") },
              { value: "included", label: t("integrations.page.includedTitle") },
              { value: "self_service", label: t("integrations.page.selfServiceTitle") },
              { value: "request", label: t("integrations.page.requestTitle") },
              { value: "upgrade", label: t("integrations.page.upgradeTitle") },
              { value: "roadmap", label: t("integrations.page.roadmapTitle") },
            ]}
          />
          <Select
            value={group}
            onChange={(event) => setGroup(event.target.value as CapabilityGroup)}
            options={[
              { value: "all", label: t("integrations.page.allGroups") },
              { value: "communications", label: t("integrations.capability.communications") },
              { value: "sales", label: t("integrations.capability.sales") },
              { value: "calendar", label: t("integrations.capability.calendar") },
              { value: "finance", label: t("integrations.capability.finance") },
              { value: "inventory", label: t("integrations.capability.inventory") },
              { value: "marketing", label: t("integrations.capability.marketing") },
              { value: "custom", label: t("integrations.capability.custom") },
            ]}
          />
          <Button variant="ghost" onClick={() => { setSearch(""); setFilter("all"); setGroup("all"); }}>
            <Filter size={16} /> {t("integrations.page.reset")}
          </Button>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">
          {t("integrations.page.resultsMeta", { found: filteredCapabilities.length, total: summary.total })}
        </p>
      </div>

      {filteredCapabilities.length === 0 ? (
        <EmptyState title={t("integrations.page.noResultsTitle")} description={t("integrations.page.noResultsDescription")} />
      ) : (
        <div className="mb-5 grid gap-4 xl:grid-cols-2">
          {filteredCapabilities.map((capability) => (
            <ConnectorCard
              key={capability.provider}
              capability={capability}
              connector={connectorByProvider.get(capability.provider)}
              businessId={business.id}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {hasExcelCsv ? <ExcelCsvImportPanel businessId={business.id} /> : null}

      <div id="integration-requests" className="scroll-mt-24 mb-5 grid gap-4 xl:grid-cols-2">
        <RequestReadyConnectorPanel
          provider="whatsapp"
          connector={connectorByProvider.get("whatsapp")}
          businessId={business.id}
          canManage={canManage}
        />
        <RequestReadyConnectorPanel
          provider="instagram"
          connector={connectorByProvider.get("instagram")}
          businessId={business.id}
          canManage={canManage}
        />
      </div>

      <DataConnectorsFoundationPanel businessId={business.id} connectorByProvider={connectorByProvider} canManage={canManage} />

      <TelegramConnectorWizard businessId={business.id} bots={bots} telegramChannel={telegramChannel} canManage={canManage} />

      <WebsiteChatConnectorPanel websiteChannel={websiteChannel} isLoading={entityData.botChannels.isLoading} />
    </div>
  );
}
