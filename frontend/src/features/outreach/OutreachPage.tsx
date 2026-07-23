import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Lock,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "../../api/client";
import { segmentsApi } from "../../api/activities";
import { clientsApi } from "../../api/clients";
import { notificationsApi } from "../../api/notifications";
import { outreachCampaignsApi, outreachConsentsApi, outreachRecipientsApi, outreachTemplatesApi } from "../../api/outreach";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Surface } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { MetricTile } from "../../components/ui/Primitives";
import { formatDateTime } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import type { Client, Id, OutreachCampaign, OutreachTemplate } from "../../types";
import { useI18n } from "../../lib/i18n";

const channelLabels = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
};

type OutreachTone = "green" | "amber" | "slate";

const campaignStatusVariant: Record<OutreachCampaign["status"], BadgeVariant> = {
  draft: "neutral",
  ready: "primary",
  scheduled: "info",
  running: "warning",
  sent: "success",
  cancelled: "danger",
};

function toneBadgeVariant(tone: OutreachTone): BadgeVariant {
  if (tone === "green") return "success";
  if (tone === "amber") return "warning";
  return "neutral";
}

function createEmptyForm(defaultMessage: string) {
  return {
  name: "",
  channel: "telegram",
  campaign_type: "service",
  audience_type: "all_clients",
  segment: "",
  template: "",
  message_text: defaultMessage,
  require_opt_in: true,
  whatsapp_template_name: "",
  whatsapp_template_language: "ru",
  whatsapp_template_status: "draft",
  rate_limit_per_minute: "60",
  batch_size: "100",
  scheduled_at: "",
};
}

export function OutreachPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { business, isLoading: businessLoading } = useActiveBusiness();
  const [open, setOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualClientIds, setManualClientIds] = useState<number[]>([]);
  const [form, setForm] = useState(() => createEmptyForm(t("outreach.defaultMessage")));
  const [consentForm, setConsentForm] = useState({
    channel: "whatsapp" as "telegram" | "whatsapp",
    status: "opted_in" as "opted_in" | "opted_out" | "unknown",
    source: "manual_import",
    rows: "",
  });
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");

  const campaigns = useQuery({
    queryKey: ["outreach-campaigns", business?.id],
    queryFn: outreachCampaignsApi.list,
    enabled: Boolean(business?.id),
  });
  const segments = useQuery({
    queryKey: ["segments", business?.id],
    queryFn: segmentsApi.list,
    enabled: Boolean(business?.id),
  });
  const clients = useQuery({
    queryKey: ["outreach-clients", business?.id, manualSearch],
    queryFn: () => clientsApi.listFiltered({ q: manualSearch || undefined }),
    enabled: Boolean(business?.id),
  });
  const templates = useQuery({
    queryKey: ["outreach-templates", business?.id],
    queryFn: outreachTemplatesApi.list,
    enabled: Boolean(business?.id),
  });
  const selectedCampaign = useMemo(
    () => campaigns.data?.find((campaign) => campaign.id === selectedId) || campaigns.data?.[0] || null,
    [campaigns.data, selectedId],
  );
  const recipients = useQuery({
    queryKey: ["outreach-recipients", selectedCampaign?.id],
    queryFn: () => outreachRecipientsApi.listByCampaign(selectedCampaign!.id),
    enabled: Boolean(selectedCampaign?.id),
  });
  const audiencePreview = useQuery({
    queryKey: ["outreach-audience-preview", selectedCampaign?.id],
    queryFn: () => outreachCampaignsApi.previewAudience(selectedCampaign!.id),
    enabled: Boolean(selectedCampaign?.id),
  });
  const stats = useQuery({
    queryKey: ["outreach-campaign-stats", selectedCampaign?.id],
    queryFn: () => outreachCampaignsApi.stats(selectedCampaign!.id),
    enabled: Boolean(selectedCampaign?.id),
  });
  const launchChecklist = useQuery({
    queryKey: ["outreach-launch-checklist", selectedCampaign?.id],
    queryFn: () => outreachCampaignsApi.launchChecklist(selectedCampaign!.id),
    enabled: Boolean(selectedCampaign?.id),
  });
  const appointmentAutomation = useQuery({
    queryKey: ["appointment-automation-status", business?.id],
    queryFn: () => outreachCampaignsApi.appointmentAutomationStatus(business!.id),
    enabled: Boolean(business?.id),
  });

  const invalidateCampaigns = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["outreach-campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["outreach-recipients"] }),
      queryClient.invalidateQueries({ queryKey: ["outreach-audience-preview"] }),
      queryClient.invalidateQueries({ queryKey: ["outreach-campaign-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["outreach-launch-checklist"] }),
      queryClient.invalidateQueries({ queryKey: ["outreach-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["appointment-automation-status"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  };

  const createCampaign = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      return outreachCampaignsApi.create({
        business: business.id,
        name: form.name.trim() || t("outreach.defaultCampaignName"),
        channel: form.channel,
        campaign_type: form.campaign_type,
        audience_type: form.audience_type,
        segment: form.audience_type === "segment" && form.segment ? Number(form.segment) : null,
        template: form.template ? Number(form.template) : null,
        message_text: form.message_text,
        require_opt_in: form.require_opt_in,
        whatsapp_template_name: form.whatsapp_template_name,
        whatsapp_template_language: form.whatsapp_template_language,
        whatsapp_template_status: form.channel === "whatsapp" ? form.whatsapp_template_status : "not_required",
        rate_limit_per_minute: Number(form.rate_limit_per_minute || 60),
        batch_size: Number(form.batch_size || 100),
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      } as Partial<OutreachCampaign>);
    },
    onSuccess: async (campaign) => {
      setOpen(false);
      setForm(createEmptyForm(t("outreach.defaultMessage")));
      setSelectedId(campaign.id);
      await invalidateCampaigns();
    },
  });
  const createTemplate = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      return outreachTemplatesApi.create({
        business: business.id,
        name: templateName.trim() || form.name.trim() || t("outreach.defaultTemplateName"),
        channel: form.channel,
        body: form.message_text,
        external_template_name: form.whatsapp_template_name,
        language_code: form.whatsapp_template_language,
        is_approved: form.channel === "telegram" || form.whatsapp_template_status === "approved",
        is_active: true,
      } as Partial<OutreachTemplate>);
    },
    onSuccess: async (template) => {
      setForm((state) => ({ ...state, template: String(template.id) }));
      setTemplateName("");
      await invalidateCampaigns();
    },
  });
  const prepare = useMutation({
    mutationFn: ({ id, clientIds }: { id: number; clientIds?: Id[] }) => outreachCampaignsApi.prepare({ id, clientIds }),
    onSuccess: invalidateCampaigns,
  });
  const launch = useMutation({
    mutationFn: (id: number) => outreachCampaignsApi.launch(id),
    onSuccess: invalidateCampaigns,
  });
  const refresh = useMutation({
    mutationFn: (id: number) => outreachCampaignsApi.refreshStatus(id),
    onSuccess: invalidateCampaigns,
  });
  const retryNotification = useMutation({
    mutationFn: (id: number) => notificationsApi.retry(id),
    onSuccess: invalidateCampaigns,
  });
  const retryFailed = useMutation({
    mutationFn: ({ id, retryableOnly = false, delayMinutes = 0 }: { id: number; retryableOnly?: boolean; delayMinutes?: number }) =>
      outreachCampaignsApi.retryFailed({ id, retryableOnly, delayMinutes }),
    onSuccess: invalidateCampaigns,
  });
  const cancel = useMutation({
    mutationFn: (id: number) => outreachCampaignsApi.cancel(id),
    onSuccess: invalidateCampaigns,
  });
  const importConsents = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      const rows = consentForm.rows
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [phoneOrEmail, note = ""] = line.split(";").map((part) => part.trim());
          return phoneOrEmail.includes("@") ? { email: phoneOrEmail, note } : { phone: phoneOrEmail, note };
        });
      return outreachConsentsApi.bulkImport({
        business: business.id,
        channel: consentForm.channel,
        status: consentForm.status,
        source: consentForm.source,
        rows,
      });
    },
    onSuccess: async () => {
      setConsentOpen(false);
      setConsentForm({ channel: "whatsapp", status: "opted_in", source: "manual_import", rows: "" });
      setConsentFile(null);
      await invalidateCampaigns();
    },
  });
  const importConsentFile = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is not selected.");
      if (!consentFile) throw new Error("File is not selected.");
      return outreachConsentsApi.bulkImportFile({
        business: business.id,
        channel: consentForm.channel,
        status: consentForm.status,
        source: consentForm.source || "file_import",
        file: consentFile,
      });
    },
    onSuccess: async () => {
      setConsentOpen(false);
      setConsentForm({ channel: "whatsapp", status: "opted_in", source: "manual_import", rows: "" });
      setConsentFile(null);
      await invalidateCampaigns();
    },
  });

  if (businessLoading || campaigns.isLoading) return <LoadingState label={t("outreach.loading")} />;
  if (!business) return <ErrorState message={t("outreach.noBusiness")} />;

  const campaignList = campaigns.data || [];
  const totalRecipients = campaignList.reduce((sum, campaign) => sum + (campaign.recipients_total || 0), 0);
  const sentRecipients = campaignList.reduce((sum, campaign) => sum + (campaign.recipients_sent || 0), 0);
  const activeCampaigns = campaignList.filter((campaign) => ["ready", "scheduled", "running"].includes(campaign.status)).length;
  const pageError = campaigns.error || segments.error || clients.error || templates.error || recipients.error || audiencePreview.error || stats.error || launchChecklist.error || appointmentAutomation.error || createCampaign.error || createTemplate.error || prepare.error || launch.error || refresh.error || retryNotification.error || retryFailed.error || cancel.error || importConsents.error || importConsentFile.error;
  const segmentList = (segments.data || []).filter((segment) => segment.is_active);
  const templateList = (templates.data || []).filter((template) => template.is_active);
  const channelTemplates = templateList.filter((template) => template.channel === form.channel);
  const clientList = clients.data?.clients || [];
  const manualSelectedCount = manualClientIds.length;
  const prepareClientIds = selectedCampaign?.audience_type === "manual" ? manualClientIds : undefined;
  const currentMembership = user?.memberships?.find((membership) => String(membership.business) === String(business.id) && membership.is_active);
  const currentRole = currentMembership?.role || user?.role || "staff";
  const canManageOutreach = ["owner", "admin", "marketer", "business_owner"].includes(currentRole);
  const currentRoleLabel = t(`settings.role.${currentRole.replace("business_", "")}`);
  const launchBlockedReason = canManageOutreach
    ? launchChecklist.data?.can_launch
      ? ""
      : t("outreach.launchBlockedChecklist")
    : t("outreach.launchBlockedRole");

  return (
    <div>
      <PageHeader
        title={t("outreach.title")}
        description={t("outreach.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!canManageOutreach} title={!canManageOutreach ? t("outreach.importConsentRoleTitle") : undefined} onClick={() => setConsentOpen(true)}><Upload size={18} /> {t("outreach.importConsents")}</Button>
            <Button disabled={!canManageOutreach} title={!canManageOutreach ? t("outreach.createRoleTitle") : undefined} onClick={() => setOpen(true)}><Plus size={18} /> {t("outreach.createCampaign")}</Button>
          </div>
        }
      />

      {pageError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(pageError)} /></div> : null}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricTile icon={BarChart3} tone="brand" label={t("outreach.metric.campaigns")} value={campaignList.length} hint={t("outreach.metric.active", { count: activeCampaigns })} />
        <MetricTile icon={Users} tone="ai" label={t("outreach.metric.queued")} value={totalRecipients} hint={t("outreach.metric.recipientsHint")} />
        <MetricTile icon={CheckCircle2} tone="green" label={t("outreach.metric.sent")} value={sentRecipients} hint={t("outreach.metric.sentHint")} />
      </div>

      <div className="mb-5 grid gap-3 xl:grid-cols-3">
        <ReadinessCard
          icon={Lock}
          title={t("outreach.readiness.rolesTitle")}
          tone={canManageOutreach ? "green" : "amber"}
          value={canManageOutreach ? t("outreach.readiness.roleCanLaunch", { role: currentRoleLabel }) : t("outreach.readiness.roleReadOnly", { role: currentRoleLabel })}
          description={t("outreach.readiness.rolesText")}
        />
        <ReadinessCard
          icon={CalendarCheck2}
          title={t("outreach.readiness.appointmentTitle")}
          tone={appointmentAutomation.data?.total_failed ? "amber" : "green"}
          value={t("outreach.readiness.appointmentValue", { pending: appointmentAutomation.data?.total_pending ?? 0, failed: appointmentAutomation.data?.total_failed ?? 0 })}
          description={t("outreach.readiness.appointmentText")}
        />
        <ReadinessCard
          icon={ShieldCheck}
          title={t("outreach.readiness.safetyTitle")}
          tone={launchChecklist.data?.can_launch ? "green" : "slate"}
          value={selectedCampaign ? (launchChecklist.data?.can_launch ? t("outreach.checklistPassed") : t("outreach.checklistRequired")) : t("outreach.selectCampaign")}
          description={t("outreach.readiness.safetyText")}
        />
      </div>

      {appointmentAutomation.data ? (
        <Surface as="section" className="mb-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-brand-700">{t("outreach.appointmentAutoEyebrow")}</p>
              <h2 className="mt-1 text-lg font-semibold text-zani-ink">{t("outreach.appointmentAutoTitle")}</h2>
            </div>
            <Badge variant={appointmentAutomation.data.enabled ? "success" : "neutral"} className="w-fit">
              {appointmentAutomation.data.enabled ? t("settings.enabled") : t("settings.disabled")}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {appointmentAutomation.data.scenarios.map((scenario) => (
              <Surface key={scenario.key} variant="muted" padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zani-ink">{scenario.label}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-zani-muted">{scenario.trigger}</p>
                  </div>
                  <Badge variant="success" size="sm">{t("outreach.auto")}</Badge>
                </div>
                <p className="mt-3 text-sm font-medium leading-5 text-zani-subtle">{scenario.description}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniCount label={t("outreach.count.pending")} value={scenario.counts.pending} />
                  <MiniCount label={t("outreach.count.sent")} value={scenario.counts.sent} />
                  <MiniCount label={t("outreach.count.failed")} value={scenario.counts.failed} tone={scenario.counts.failed ? "amber" : "slate"} />
                </div>
              </Surface>
            ))}
          </div>
          {appointmentAutomation.data.failed_notifications.length ? (
            <Surface className="mt-4 border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)]" padding="sm">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zani-warning">{t("outreach.deliveryErrorsTitle")}</p>
                  <p className="text-sm font-medium text-zani-warning">{t("outreach.deliveryErrorsText")}</p>
                </div>
                <Badge variant="warning">{t("outreach.failedCount", { count: appointmentAutomation.data.total_failed })}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {appointmentAutomation.data.failed_notifications.map((notification) => (
                  <div key={notification.id} className="flex flex-col gap-3 rounded-card border border-zani-border bg-surface-card px-3 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zani-ink">{notification.label} · {notification.client_name || notification.client_phone || t("common.client")}</p>
                      <p className="mt-0.5 text-xs font-semibold uppercase text-zani-muted">{notification.channel} · {formatDateTime(notification.send_at)}</p>
                    </div>
                    <Button type="button" variant="secondary" disabled={!canManageOutreach} isLoading={retryNotification.isPending} onClick={() => retryNotification.mutate(Number(notification.id))}>
                      <RefreshCw size={15} /> {t("common.retry")}
                    </Button>
                  </div>
                ))}
              </div>
            </Surface>
          ) : null}
        </Surface>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Surface padding="sm">
          <div className="flex items-center justify-between px-2 py-2">
            <h2 className="text-lg font-semibold text-zani-ink">{t("outreach.campaigns")}</h2>
            <Badge variant="neutral">{campaignList.length}</Badge>
          </div>
          <div className="mt-2 space-y-2">
            {campaignList.map((campaign) => {
              const active = campaign.id === selectedCampaign?.id;
              return (
                <button
                  key={campaign.id}
                  type="button"
                  className={`w-full rounded-card border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${active ? "border-brand-200 bg-brand-50 shadow-sm" : "border-zani-border bg-surface-card hover:border-brand-100 hover:bg-surface-warm"}`}
                  onClick={() => setSelectedId(campaign.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-zani-ink">{campaign.name}</p>
                      <p className="mt-1 text-sm font-medium text-zani-subtle">{channelLabels[campaign.channel]} · {t(`outreach.campaignType.${campaign.campaign_type}`)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant={campaignStatusVariant[campaign.status]}>{t(`outreach.status.${campaign.status}`)}</Badge>
                      <Badge variant="primary" size="sm">{campaign.recipients_total || 0}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
            {!campaignList.length ? <EmptyState title={t("outreach.emptyTitle")} description={t("outreach.emptyDescription")} /> : null}
          </div>
        </Surface>

        <Surface padding="lg">
          {selectedCampaign ? (
            <div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-brand-700">{t("outreach.channelCampaign", { channel: channelLabels[selectedCampaign.channel] })}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-zani-ink">{selectedCampaign.name}</h2>
                  <p className="mt-2 text-sm font-medium text-zani-subtle">
                    {t("outreach.statusLine", { status: t(`outreach.status.${selectedCampaign.status}`) })}
                    {selectedCampaign.scheduled_at ? t("outreach.startLine", { date: formatDateTime(selectedCampaign.scheduled_at) }) : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" disabled={!canManageOutreach || (selectedCampaign.audience_type === "manual" && !manualSelectedCount)} isLoading={prepare.isPending} onClick={() => prepare.mutate({ id: selectedCampaign.id, clientIds: prepareClientIds })}>
                    <Users size={16} /> {t("outreach.prepare")}
                  </Button>
                  <Button type="button" disabled={!canManageOutreach || !launchChecklist.data?.can_launch} title={launchBlockedReason || undefined} isLoading={launch.isPending} onClick={() => launch.mutate(selectedCampaign.id)}>
                    <Play size={16} /> {t("outreach.launch")}
                  </Button>
                  <Button type="button" variant="secondary" isLoading={refresh.isPending} onClick={() => refresh.mutate(selectedCampaign.id)}>
                    <RefreshCw size={16} /> {t("common.refresh")}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!canManageOutreach || !stats.data?.retryable_failed} isLoading={retryFailed.isPending} onClick={() => retryFailed.mutate({ id: selectedCampaign.id, retryableOnly: true, delayMinutes: 15 })}>
                    <RefreshCw size={16} /> {t("outreach.retry15")}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!canManageOutreach || !selectedCampaign.recipients_failed} isLoading={retryFailed.isPending} onClick={() => retryFailed.mutate({ id: selectedCampaign.id })}>
                    <RefreshCw size={16} /> {t("outreach.retryAll")}
                  </Button>
                  <Button type="button" variant="ghost" disabled={!canManageOutreach || selectedCampaign.status === "cancelled"} isLoading={cancel.isPending} onClick={() => cancel.mutate(selectedCampaign.id)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>

              {!canManageOutreach ? (
                <Surface variant="danger" className="mt-4 text-sm font-medium leading-6 text-zani-danger">
                  {t("outreach.readOnlyNotice")}
                </Surface>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MiniStat label={t("outreach.stat.total")} value={selectedCampaign.recipients_total || 0} />
                <MiniStat label={t("outreach.stat.pending")} value={selectedCampaign.recipients_pending || 0} />
                <MiniStat label={t("outreach.stat.sent")} value={selectedCampaign.recipients_sent || 0} />
                <MiniStat label={t("outreach.stat.failed")} value={selectedCampaign.recipients_failed || 0} />
                <MiniStat label={t("outreach.stat.skipped")} value={selectedCampaign.recipients_skipped || 0} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SafetyCard icon={CheckCircle2} label={t("outreach.deliveryRate")} value={`${stats.data?.delivery_rate ?? 0}%`} tone="green" />
                <SafetyCard icon={AlertTriangle} label={t("outreach.failureRate")} value={`${stats.data?.failure_rate ?? 0}%`} tone={stats.data?.failed ? "amber" : "green"} />
                <SafetyCard icon={ShieldCheck} label={t("outreach.suppressionRate")} value={`${stats.data?.suppression_rate ?? 0}%`} tone={stats.data?.skipped ? "amber" : "green"} />
              </div>

              {launchChecklist.data ? (
                <Surface className={`mt-4 ${launchChecklist.data.can_launch ? "border-[rgba(21,128,61,0.18)] bg-[var(--zani-success-soft)]" : "border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-sm font-semibold ${launchChecklist.data.can_launch ? "text-zani-success" : "text-zani-warning"}`}>{t("outreach.prelaunchCheck")}</h3>
                    <Badge variant={launchChecklist.data.can_launch ? "success" : "warning"}>
                      {launchChecklist.data.can_launch ? t("outreach.ready") : t("outreach.needsCheck")}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {launchChecklist.data.checks.map((check) => (
                      <div key={check.key} className="flex items-center gap-2 text-sm font-semibold text-zani-subtle">
                        <span className={`h-2.5 w-2.5 rounded-full ${check.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {check.label}
                      </div>
                    ))}
                  </div>
                </Surface>
              ) : null}

              {stats.data?.errors?.length ? (
                <Surface className="mt-4 border-[rgba(183,121,31,0.22)] bg-[var(--zani-warning-soft)]">
                  <h3 className="text-sm font-semibold text-zani-warning">{t("outreach.errorReasons")}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stats.data.errors.map((error) => (
                      <Badge key={error.code} variant="warning">
                        {error.label}: {error.count}
                      </Badge>
                    ))}
                  </div>
                </Surface>
              ) : null}

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <SafetyCard icon={ShieldCheck} label={t("outreach.consents")} value={selectedCampaign.require_opt_in ? t("outreach.required") : t("outreach.notRequired")} tone={selectedCampaign.require_opt_in ? "green" : "amber"} />
                <SafetyCard icon={Users} label={t("outreach.limit")} value={t("outreach.limitValue", { limit: selectedCampaign.rate_limit_per_minute, batch: selectedCampaign.batch_size })} />
                <SafetyCard icon={Clock3} label={t("outreach.audience")} value={t(`outreach.audienceType.${selectedCampaign.audience_type}`)} />
                <SafetyCard
                  icon={AlertTriangle}
                  label={t("outreach.whatsappTemplate")}
                  value={selectedCampaign.channel === "whatsapp" ? selectedCampaign.whatsapp_template_status : t("outreach.notNeeded")}
                  tone={selectedCampaign.channel === "whatsapp" && selectedCampaign.whatsapp_template_status !== "approved" ? "amber" : "green"}
                />
              </div>

              <Surface variant="muted" className="mt-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-zani-ink">
                  <MessageSquareText size={17} /> {t("outreach.messageText")}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-zani-subtle">{selectedCampaign.message_text}</p>
              </Surface>

              {selectedCampaign.audience_type === "manual" ? (
                <ManualAudiencePicker
                  campaign={selectedCampaign}
                  clients={clientList}
                  selectedIds={manualClientIds}
                  search={manualSearch}
                  onSearch={setManualSearch}
                  onToggle={(clientId) => {
                    setManualClientIds((ids) => ids.includes(clientId) ? ids.filter((id) => id !== clientId) : [...ids, clientId]);
                  }}
                />
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Surface variant="outlined">
                  <h3 className="font-semibold text-zani-ink">{t("outreach.audience")}</h3>
                  <p className="mt-1 text-sm font-medium text-zani-subtle">
                    {t("outreach.audiencePreview", { total: audiencePreview.data?.count ?? "...", eligible: audiencePreview.data?.eligible_count ?? "...", suppressed: audiencePreview.data?.suppressed_count ?? "..." })}
                  </p>
                  <div className="mt-3 space-y-2">
                    {(audiencePreview.data?.clients || []).map((client) => (
                      <div key={client.id} className={`rounded-card px-3 py-2 text-sm font-medium ${client.eligible ? "bg-surface-muted text-zani-subtle" : "bg-[var(--zani-warning-soft)] text-zani-warning"}`}>
                        {client.full_name} · {client.recipient_id}
                        {!client.eligible ? <span className="ml-2 text-xs font-semibold">({client.suppression_reason})</span> : null}
                      </div>
                    ))}
                  </div>
                </Surface>

                <Surface variant="outlined">
                  <h3 className="font-semibold text-zani-ink">{t("outreach.latestRecipients")}</h3>
                  <div className="mt-3 space-y-2">
                    {(recipients.data || []).slice(0, 6).map((recipient) => (
                      <div key={recipient.id} className="flex items-center justify-between gap-3 rounded-card bg-surface-muted px-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-zani-subtle">{recipient.client_name || recipient.recipient_id}</span>
                        <Badge variant={recipient.status === "sent" ? "success" : recipient.status === "failed" ? "danger" : recipient.status === "skipped" ? "warning" : "neutral"} size="sm">
                          {recipient.status}
                        </Badge>
                        {recipient.skipped_reason ? <span className="text-xs font-semibold text-amber-700">{recipient.skipped_reason}</span> : null}
                        {recipient.error_code ? <span className="text-xs font-semibold text-rose-700">{recipient.error_code}</span> : null}
                      </div>
                    ))}
                    {!recipients.isLoading && !(recipients.data || []).length ? <p className="text-sm font-medium text-zani-subtle">{t("outreach.queueEmpty")}</p> : null}
                  </div>
                </Surface>
              </div>
            </div>
          ) : (
            <EmptyState title={t("outreach.selectCampaign")} description={t("outreach.selectCampaignDescription")} />
          )}
        </Surface>
      </section>

      <Modal title={t("outreach.newCampaign")} open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <Surface className="border-brand-100 bg-brand-50">
            <p className="text-sm font-semibold text-brand-900">{t("outreach.launchOrderTitle")}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-zani-subtle">
              {t("outreach.launchOrderText")}
            </p>
          </Surface>
          <Input label={t("outreach.nameLabel")} value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} placeholder={t("outreach.namePlaceholder")} />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label={t("settings.channel")}
              value={form.channel}
              onChange={(event) => setForm((state) => ({ ...state, channel: event.target.value }))}
              options={[
                { value: "telegram", label: "Telegram" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
            <Select
              label={t("outreach.campaignType")}
              value={form.campaign_type}
              onChange={(event) => setForm((state) => ({ ...state, campaign_type: event.target.value }))}
              options={[
                { value: "service", label: t("outreach.campaignType.service") },
                { value: "marketing", label: t("outreach.campaignType.marketing") },
                { value: "transactional", label: t("outreach.campaignType.transactional") },
              ]}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Select
              label={t("settings.template")}
              value={form.template}
              onChange={(event) => {
                const template = channelTemplates.find((item) => String(item.id) === event.target.value);
                setForm((state) => ({
                  ...state,
                  template: event.target.value,
                  message_text: template?.body || state.message_text,
                  whatsapp_template_name: template?.external_template_name || state.whatsapp_template_name,
                  whatsapp_template_language: template?.language_code || state.whatsapp_template_language,
                  whatsapp_template_status: template && state.channel === "whatsapp" ? (template.is_approved ? "approved" : "draft") : state.whatsapp_template_status,
                }));
              }}
              options={[
                { value: "", label: t("outreach.noTemplate") },
                ...channelTemplates.map((template) => ({ value: String(template.id), label: `${template.name}${template.is_approved ? ` · ${t("outreach.templateStatus.approved")}` : ""}` })),
              ]}
            />
            <Button type="button" variant="secondary" disabled={!canManageOutreach || !form.message_text.trim()} isLoading={createTemplate.isPending} onClick={() => createTemplate.mutate()}>
              {t("outreach.saveTemplate")}
            </Button>
          </div>
          <Input label={t("outreach.newTemplateName")} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder={t("outreach.templateNamePlaceholder")} />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label={t("outreach.audience")}
              value={form.audience_type}
              onChange={(event) => setForm((state) => ({ ...state, audience_type: event.target.value }))}
              options={[
                { value: "all_clients", label: t("outreach.audienceType.all_clients") },
                { value: "segment", label: t("outreach.audienceType.segment") },
                { value: "manual", label: t("outreach.audienceType.manual") },
              ]}
            />
            <Select
              label={t("outreach.clientConsent")}
              value={form.require_opt_in ? "required" : "not_required"}
              onChange={(event) => setForm((state) => ({ ...state, require_opt_in: event.target.value === "required" }))}
              options={[
                { value: "required", label: t("outreach.optInOnly") },
                { value: "not_required", label: t("outreach.noOptInCheck") },
              ]}
            />
          </div>
          {form.audience_type === "segment" ? (
            <Select
              label={t("outreach.segment")}
              value={form.segment}
              onChange={(event) => setForm((state) => ({ ...state, segment: event.target.value }))}
              options={[
                { value: "", label: t("outreach.selectSegment") },
                ...segmentList.map((segment) => ({ value: String(segment.id), label: `${segment.name} (${segment.cached_count})` })),
              ]}
            />
          ) : null}
          {form.channel === "whatsapp" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Input label={t("outreach.whatsappTemplateName")} value={form.whatsapp_template_name} onChange={(event) => setForm((state) => ({ ...state, whatsapp_template_name: event.target.value }))} placeholder="appointment_recall_ru" />
              <Input label={t("common.language")} value={form.whatsapp_template_language} onChange={(event) => setForm((state) => ({ ...state, whatsapp_template_language: event.target.value }))} placeholder="ru" />
              <Select
                label={t("outreach.templateStatus")}
                value={form.whatsapp_template_status}
                onChange={(event) => setForm((state) => ({ ...state, whatsapp_template_status: event.target.value }))}
                options={[
                  { value: "draft", label: t("outreach.templateStatus.draft") },
                  { value: "pending", label: t("outreach.templateStatus.pending") },
                  { value: "approved", label: t("outreach.templateStatus.approved") },
                  { value: "rejected", label: t("outreach.templateStatus.rejected") },
                ]}
              />
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input label={t("outreach.rateLimit")} type="number" value={form.rate_limit_per_minute} onChange={(event) => setForm((state) => ({ ...state, rate_limit_per_minute: event.target.value }))} />
            <Input label={t("outreach.batchSize")} type="number" value={form.batch_size} onChange={(event) => setForm((state) => ({ ...state, batch_size: event.target.value }))} />
          </div>
          <Input label={t("outreach.scheduledAt")} type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm((state) => ({ ...state, scheduled_at: event.target.value }))} />
          <Textarea label={t("outreach.message")} value={form.message_text} onChange={(event) => setForm((state) => ({ ...state, message_text: event.target.value }))} rows={6} />
          <div className="rounded-card bg-surface-muted px-3 py-2 text-sm font-medium leading-6 text-zani-subtle">
            {t("outreach.templateVariables")}
          </div>
          <div className="rounded-card bg-[var(--zani-warning-soft)] px-3 py-2 text-sm font-medium leading-6 text-zani-warning">
            {t("outreach.productionModeNotice")}
          </div>
          <Button type="button" disabled={!canManageOutreach || !form.message_text.trim() || (form.audience_type === "segment" && !form.segment)} isLoading={createCampaign.isPending} onClick={() => createCampaign.mutate()}>
            <Send size={16} /> {t("outreach.create")}
          </Button>
        </div>
      </Modal>

      <Modal title={t("outreach.importConsents")} open={consentOpen} onClose={() => setConsentOpen(false)}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label={t("settings.channel")}
              value={consentForm.channel}
              onChange={(event) => setConsentForm((state) => ({ ...state, channel: event.target.value as "telegram" | "whatsapp" }))}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "telegram", label: "Telegram" },
              ]}
            />
            <Select
              label={t("pricing.status")}
              value={consentForm.status}
              onChange={(event) => setConsentForm((state) => ({ ...state, status: event.target.value as "opted_in" | "opted_out" | "unknown" }))}
              options={[
                { value: "opted_in", label: "Opt-in" },
                { value: "opted_out", label: "Opt-out" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
          </div>
          <Input label={t("outreach.consentSource")} value={consentForm.source} onChange={(event) => setConsentForm((state) => ({ ...state, source: event.target.value }))} />
          <Textarea
            label={t("common.client")}
            value={consentForm.rows}
            onChange={(event) => setConsentForm((state) => ({ ...state, rows: event.target.value }))}
            rows={8}
            placeholder={t("outreach.consentRowsPlaceholder")}
          />
          <Input type="file" accept=".csv,.xlsx" onChange={(event) => setConsentFile(event.target.files?.[0] || null)} />
          <div className="rounded-card bg-surface-muted px-3 py-2 text-sm font-medium leading-6 text-zani-subtle">
            {t("outreach.consentImportNotice")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!consentForm.rows.trim()} isLoading={importConsents.isPending} onClick={() => importConsents.mutate()}>
              <Upload size={16} /> {t("outreach.importText")}
            </Button>
            <Button type="button" variant="secondary" disabled={!consentFile} isLoading={importConsentFile.isPending} onClick={() => importConsentFile.mutate()}>
              <Upload size={16} /> {t("outreach.importFile")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ManualAudiencePicker({
  campaign,
  clients,
  selectedIds,
  search,
  onSearch,
  onToggle,
}: {
  campaign: OutreachCampaign;
  clients: Client[];
  selectedIds: number[];
  search: string;
  onSearch: (value: string) => void;
  onToggle: (clientId: number) => void;
}) {
  const { t } = useI18n();
  return (
    <Surface className="mt-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-semibold text-zani-ink">{t("outreach.manualAudience")}</h3>
          <p className="mt-1 text-sm font-medium text-zani-subtle">{t("outreach.manualAudienceText", { count: selectedIds.length })}</p>
        </div>
        <Input className="md:max-w-xs" placeholder={t("outreach.clientSearch")} value={search} onChange={(event) => onSearch(event.target.value)} />
      </div>
      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
        {clients.slice(0, 80).map((client) => {
          const recipientId = campaign.channel === "telegram" ? client.telegram_id : client.whatsapp_id || client.phone;
          const disabled = !recipientId;
          const selected = selectedIds.includes(Number(client.id));
          return (
            <button
              key={client.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(Number(client.id))}
              className={`rounded-card border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${selected ? "border-brand-200 bg-brand-50 text-brand-900" : "border-zani-border bg-surface-muted text-zani-subtle"} ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-brand-100 hover:bg-surface-card"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{client.full_name}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold opacity-70">{recipientId || t("outreach.noChannelId")}</p>
                </div>
                <Badge variant={selected ? "primary" : "neutral"} size="sm">{selected ? t("outreach.selected") : channelLabels[campaign.channel]}</Badge>
              </div>
            </button>
          );
        })}
      </div>
      {!clients.length ? <p className="mt-3 text-sm font-medium text-zani-subtle">{t("outreach.clientsNotFound")}</p> : null}
    </Surface>
  );
}

function SafetyCard({ icon: Icon, label, value, tone = "slate" }: { icon: LucideIcon; label: string; value: string; tone?: "green" | "amber" | "slate" }) {
  return (
    <Surface variant="muted" padding="sm" className="flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${tone === "green" ? "bg-[var(--zani-success-soft)] text-zani-success" : tone === "amber" ? "bg-[var(--zani-warning-soft)] text-zani-warning" : "bg-surface-card text-zani-subtle"}`}>
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase text-zani-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-zani-ink">{value}</p>
      </div>
    </Surface>
  );
}

function ReadinessCard({
  icon: Icon,
  title,
  value,
  description,
  tone = "slate",
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
  tone?: "green" | "amber" | "slate";
}) {
  const iconClass = tone === "green" ? "bg-[var(--zani-success-soft)] text-zani-success" : tone === "amber" ? "bg-[var(--zani-warning-soft)] text-zani-warning" : "bg-brand-50 text-brand-700";
  return (
    <Surface>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-zani-muted">{title}</p>
          <p className="mt-1 text-sm font-semibold text-zani-ink">{value}</p>
          <p className="mt-1 text-sm font-medium leading-5 text-zani-subtle">{description}</p>
        </div>
      </div>
    </Surface>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-surface-muted px-4 py-3">
      <p className="text-xs font-bold uppercase text-zani-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zani-ink">{value}</p>
    </div>
  );
}

function MiniCount({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" }) {
  return (
    <div className={`rounded-card bg-surface-card px-2 py-2 ${tone === "amber" ? "text-zani-warning" : "text-zani-subtle"}`}>
      <p className="text-[10px] font-bold uppercase text-zani-muted">{label}</p>
      <p className="mt-0.5 text-base font-semibold">{value}</p>
    </div>
  );
}
