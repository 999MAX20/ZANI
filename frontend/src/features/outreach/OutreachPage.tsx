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
import { Button } from "../../components/ui/Button";
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

const defaultMessage = "Здравствуйте, {client_name}! Напоминаем, что у нас можно записаться на ближайшее свободное время. Ответьте на это сообщение, и менеджер подберет удобный слот.";

const statusLabels: Record<OutreachCampaign["status"], string> = {
  draft: "Черновик",
  ready: "Готова",
  scheduled: "Запланирована",
  running: "В отправке",
  sent: "Отправлена",
  cancelled: "Отменена",
};

const channelLabels = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
};

const campaignTypeLabels: Record<OutreachCampaign["campaign_type"], string> = {
  service: "Сервисная",
  marketing: "Маркетинговая",
  transactional: "Транзакционная",
};

const audienceLabels: Record<OutreachCampaign["audience_type"], string> = {
  all_clients: "Все клиенты",
  segment: "Сегмент",
  manual: "Ручной список",
};

const roleLabels: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  marketer: "Маркетолог",
  manager: "Менеджер",
  operator: "Оператор",
  support: "Поддержка",
  accountant: "Бухгалтер",
  staff: "Сотрудник",
  business_owner: "Владелец",
  business_manager: "Менеджер",
  business_operator: "Оператор",
};

const emptyForm = {
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

export function OutreachPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { business, isLoading: businessLoading } = useActiveBusiness();
  const [open, setOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualClientIds, setManualClientIds] = useState<number[]>([]);
  const [form, setForm] = useState(emptyForm);
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
      if (!business) throw new Error("Бизнес не выбран.");
      return outreachCampaignsApi.create({
        business: business.id,
        name: form.name.trim() || "Новая рассылка",
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
      setForm(emptyForm);
      setSelectedId(campaign.id);
      await invalidateCampaigns();
    },
  });
  const createTemplate = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Бизнес не выбран.");
      return outreachTemplatesApi.create({
        business: business.id,
        name: templateName.trim() || form.name.trim() || "Новый шаблон",
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
      if (!business) throw new Error("Бизнес не выбран.");
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
      if (!business) throw new Error("Бизнес не выбран.");
      if (!consentFile) throw new Error("Файл не выбран.");
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

  if (businessLoading || campaigns.isLoading) return <LoadingState label="Загружаем рассылки..." />;
  if (!business) return <ErrorState message="Бизнес не выбран." />;

  const campaignList = campaigns.data || [];
  const totalRecipients = campaignList.reduce((sum, campaign) => sum + (campaign.recipients_total || 0), 0);
  const sentRecipients = campaignList.reduce((sum, campaign) => sum + (campaign.recipients_sent || 0), 0);
  const activeCampaigns = campaignList.filter((campaign) => ["ready", "scheduled", "running"].includes(campaign.status)).length;
  const pageError = campaigns.error || segments.error || clients.error || templates.error || recipients.error || audiencePreview.error || stats.error || launchChecklist.error || appointmentAutomation.error || createCampaign.error || createTemplate.error || prepare.error || launch.error || refresh.error || retryNotification.error || retryFailed.error || cancel.error || importConsents.error || importConsentFile.error;
  const segmentList = (segments.data || []).filter((segment) => segment.is_active);
  const templateList = (templates.data || []).filter((template) => template.is_active);
  const channelTemplates = templateList.filter((template) => template.channel === form.channel);
  const clientList = clients.data || [];
  const manualSelectedCount = manualClientIds.length;
  const prepareClientIds = selectedCampaign?.audience_type === "manual" ? manualClientIds : undefined;
  const currentMembership = user?.memberships?.find((membership) => String(membership.business) === String(business.id) && membership.is_active);
  const currentRole = currentMembership?.role || user?.role || "staff";
  const canManageOutreach = ["owner", "admin", "marketer", "business_owner"].includes(currentRole);
  const launchBlockedReason = canManageOutreach
    ? launchChecklist.data?.can_launch
      ? ""
      : "Сначала подготовьте аудиторию и пройдите checklist."
    : "Запуск доступен владельцу, администратору или маркетологу.";

  return (
    <div>
      <PageHeader
        title="Рассылки"
        description="Рабочий центр для Telegram и WhatsApp кампаний: аудитория, очередь получателей, запуск и статусы доставки."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!canManageOutreach} title={!canManageOutreach ? "Импорт согласий доступен владельцу, администратору или маркетологу." : undefined} onClick={() => setConsentOpen(true)}><Upload size={18} /> Импорт согласий</Button>
            <Button disabled={!canManageOutreach} title={!canManageOutreach ? "Создание рассылок доступно владельцу, администратору или маркетологу." : undefined} onClick={() => setOpen(true)}><Plus size={18} /> Создать рассылку</Button>
          </div>
        }
      />

      {pageError ? <div className="mb-4"><ErrorState message={getApiErrorMessage(pageError)} /></div> : null}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricTile icon={BarChart3} tone="brand" label="Кампаний" value={campaignList.length} hint={`${activeCampaigns} активных`} />
        <MetricTile icon={Users} tone="ai" label="В очередях" value={totalRecipients} hint="получателей в кампаниях" />
        <MetricTile icon={CheckCircle2} tone="green" label="Отправлено" value={sentRecipients} hint="по обновленным статусам" />
      </div>

      <div className="mb-5 grid gap-3 xl:grid-cols-3">
        <ReadinessCard
          icon={Lock}
          title="Роли и запуск"
          tone={canManageOutreach ? "green" : "amber"}
          value={canManageOutreach ? `${roleLabels[currentRole] || currentRole}: можно запускать` : `${roleLabels[currentRole] || currentRole}: только просмотр`}
          description="Боевые массовые рассылки запускают owner/admin/marketer. Preferences могут скрыть обычный шум, но high/urgent уведомления всегда доходят."
        />
        <ReadinessCard
          icon={CalendarCheck2}
          title="Автосообщения записей"
          tone={appointmentAutomation.data?.total_failed ? "amber" : "green"}
          value={`${appointmentAutomation.data?.total_pending ?? 0} в очереди · ${appointmentAutomation.data?.total_failed ?? 0} ошибок`}
          description="Подтверждение за 24 часа, напоминание за 2 часа и спасибо после завершенного визита создаются автоматически."
        />
        <ReadinessCard
          icon={ShieldCheck}
          title="Защита запуска"
          tone={launchChecklist.data?.can_launch ? "green" : "slate"}
          value={selectedCampaign ? (launchChecklist.data?.can_launch ? "Checklist пройден" : "Checklist обязателен") : "Выберите кампанию"}
          description="Перед запуском проверяются текст, аудитория, opt-in, подготовленная очередь, лимиты и WhatsApp template."
        />
      </div>

      {appointmentAutomation.data ? (
        <section className="mb-5 rounded-3xl border border-slate-100 bg-white/95 p-4 shadow-soft">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-brand-700">Автоматические сообщения по записям</p>
              <h2 className="mt-1 text-lg font-black text-midnight">Сервисные сценарии работают без ручного запуска рассылки</h2>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${appointmentAutomation.data.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {appointmentAutomation.data.enabled ? "включено" : "выключено"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {appointmentAutomation.data.scenarios.map((scenario) => (
              <div key={scenario.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-midnight">{scenario.label}</p>
                    <p className="mt-1 text-xs font-black uppercase text-slate-400">{scenario.trigger}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700">auto</span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-5 text-slate-600">{scenario.description}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <MiniCount label="Очередь" value={scenario.counts.pending} />
                  <MiniCount label="Ушло" value={scenario.counts.sent} />
                  <MiniCount label="Ошибки" value={scenario.counts.failed} tone={scenario.counts.failed ? "amber" : "slate"} />
                </div>
              </div>
            ))}
          </div>
          {appointmentAutomation.data.failed_notifications.length ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black text-amber-950">Ошибки отправки</p>
                  <p className="text-sm font-semibold text-amber-900">Проверьте подключение канала или повторите отправку после исправления.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-900">{appointmentAutomation.data.total_failed} failed</span>
              </div>
              <div className="mt-3 space-y-2">
                {appointmentAutomation.data.failed_notifications.map((notification) => (
                  <div key={notification.id} className="flex flex-col gap-3 rounded-2xl bg-white px-3 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-midnight">{notification.label} · {notification.client_name || notification.client_phone || "Клиент"}</p>
                      <p className="mt-0.5 text-xs font-semibold uppercase text-slate-400">{notification.channel} · {formatDateTime(notification.send_at)}</p>
                    </div>
                    <Button type="button" variant="secondary" disabled={!canManageOutreach} isLoading={retryNotification.isPending} onClick={() => retryNotification.mutate(Number(notification.id))}>
                      <RefreshCw size={15} /> Повторить
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="rounded-3xl border border-slate-100 bg-white/95 p-3 shadow-soft">
          <div className="flex items-center justify-between px-2 py-2">
            <h2 className="text-lg font-black text-midnight">Кампании</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{campaignList.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {campaignList.map((campaign) => {
              const active = campaign.id === selectedCampaign?.id;
              return (
                <button
                  key={campaign.id}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-brand-200 bg-brand-50/70 shadow-sm" : "border-slate-100 bg-white hover:bg-slate-50"}`}
                  onClick={() => setSelectedId(campaign.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-midnight">{campaign.name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{channelLabels[campaign.channel]} · {campaignTypeLabels[campaign.campaign_type]} · {statusLabels[campaign.status]}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-brand-700">{campaign.recipients_total || 0}</span>
                  </div>
                </button>
              );
            })}
            {!campaignList.length ? <EmptyState title="Рассылок пока нет" description="Создайте первую кампанию для Telegram или WhatsApp." /> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white/95 p-5 shadow-soft">
          {selectedCampaign ? (
            <div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-brand-700">{channelLabels[selectedCampaign.channel]} рассылка</p>
                  <h2 className="mt-1 text-2xl font-black text-midnight">{selectedCampaign.name}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Статус: {statusLabels[selectedCampaign.status]}
                    {selectedCampaign.scheduled_at ? ` · старт ${formatDateTime(selectedCampaign.scheduled_at)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" disabled={!canManageOutreach || (selectedCampaign.audience_type === "manual" && !manualSelectedCount)} isLoading={prepare.isPending} onClick={() => prepare.mutate({ id: selectedCampaign.id, clientIds: prepareClientIds })}>
                    <Users size={16} /> Подготовить
                  </Button>
                  <Button type="button" disabled={!canManageOutreach || !launchChecklist.data?.can_launch} title={launchBlockedReason || undefined} isLoading={launch.isPending} onClick={() => launch.mutate(selectedCampaign.id)}>
                    <Play size={16} /> Запустить
                  </Button>
                  <Button type="button" variant="secondary" isLoading={refresh.isPending} onClick={() => refresh.mutate(selectedCampaign.id)}>
                    <RefreshCw size={16} /> Обновить
                  </Button>
                  <Button type="button" variant="secondary" disabled={!canManageOutreach || !stats.data?.retryable_failed} isLoading={retryFailed.isPending} onClick={() => retryFailed.mutate({ id: selectedCampaign.id, retryableOnly: true, delayMinutes: 15 })}>
                    <RefreshCw size={16} /> Retry 15 мин
                  </Button>
                  <Button type="button" variant="secondary" disabled={!canManageOutreach || !selectedCampaign.recipients_failed} isLoading={retryFailed.isPending} onClick={() => retryFailed.mutate({ id: selectedCampaign.id })}>
                    <RefreshCw size={16} /> Повторить все
                  </Button>
                  <Button type="button" variant="ghost" disabled={!canManageOutreach || selectedCampaign.status === "cancelled"} isLoading={cancel.isPending} onClick={() => cancel.mutate(selectedCampaign.id)}>
                    Отменить
                  </Button>
                </div>
              </div>

              {!canManageOutreach ? (
                <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50/70 p-4 text-sm font-semibold leading-6 text-amber-950">
                  Ваша роль может контролировать статус рассылок и получателей, но запуск, импорт согласий и повтор ошибок закрыты. Это защищает клиентов от случайных массовых сообщений.
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MiniStat label="Всего" value={selectedCampaign.recipients_total || 0} />
                <MiniStat label="В ожидании" value={selectedCampaign.recipients_pending || 0} />
                <MiniStat label="Отправлено" value={selectedCampaign.recipients_sent || 0} />
                <MiniStat label="Ошибки" value={selectedCampaign.recipients_failed || 0} />
                <MiniStat label="Пропущено" value={selectedCampaign.recipients_skipped || 0} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <SafetyCard icon={CheckCircle2} label="Delivery rate" value={`${stats.data?.delivery_rate ?? 0}%`} tone="green" />
                <SafetyCard icon={AlertTriangle} label="Failure rate" value={`${stats.data?.failure_rate ?? 0}%`} tone={stats.data?.failed ? "amber" : "green"} />
                <SafetyCard icon={ShieldCheck} label="Suppression" value={`${stats.data?.suppression_rate ?? 0}%`} tone={stats.data?.skipped ? "amber" : "green"} />
              </div>

              {launchChecklist.data ? (
                <div className={`mt-4 rounded-3xl border p-4 ${launchChecklist.data.can_launch ? "border-emerald-100 bg-emerald-50/70" : "border-amber-100 bg-amber-50/70"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={`text-sm font-black ${launchChecklist.data.can_launch ? "text-emerald-900" : "text-amber-950"}`}>Проверка перед запуском</h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{launchChecklist.data.can_launch ? "готово" : "нужно проверить"}</span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {launchChecklist.data.checks.map((check) => (
                      <div key={check.key} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <span className={`h-2.5 w-2.5 rounded-full ${check.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {check.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {stats.data?.errors?.length ? (
                <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50/70 p-4">
                  <h3 className="text-sm font-black text-amber-950">Причины ошибок и suppression</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stats.data.errors.map((error) => (
                      <span key={error.code} className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-900">
                        {error.label}: {error.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <SafetyCard icon={ShieldCheck} label="Согласия" value={selectedCampaign.require_opt_in ? "Обязательны" : "Не требуются"} tone={selectedCampaign.require_opt_in ? "green" : "amber"} />
                <SafetyCard icon={Users} label="Лимит" value={`${selectedCampaign.rate_limit_per_minute}/мин · batch ${selectedCampaign.batch_size}`} />
                <SafetyCard icon={Clock3} label="Аудитория" value={audienceLabels[selectedCampaign.audience_type]} />
                <SafetyCard
                  icon={AlertTriangle}
                  label="WhatsApp template"
                  value={selectedCampaign.channel === "whatsapp" ? selectedCampaign.whatsapp_template_status : "Не нужен"}
                  tone={selectedCampaign.channel === "whatsapp" && selectedCampaign.whatsapp_template_status !== "approved" ? "amber" : "green"}
                />
              </div>

              <div className="mt-5 rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-midnight">
                  <MessageSquareText size={17} /> Текст сообщения
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{selectedCampaign.message_text}</p>
              </div>

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
                <div className="rounded-3xl border border-slate-100 p-4">
                  <h3 className="font-black text-midnight">Аудитория</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Всего: {audiencePreview.data?.count ?? "..."} · можно отправить: {audiencePreview.data?.eligible_count ?? "..."} · suppression: {audiencePreview.data?.suppressed_count ?? "..."}.
                  </p>
                  <div className="mt-3 space-y-2">
                    {(audiencePreview.data?.clients || []).map((client) => (
                      <div key={client.id} className={`rounded-2xl px-3 py-2 text-sm font-semibold ${client.eligible ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-900"}`}>
                        {client.full_name} · {client.recipient_id}
                        {!client.eligible ? <span className="ml-2 text-xs font-black">({client.suppression_reason})</span> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 p-4">
                  <h3 className="font-black text-midnight">Последние получатели</h3>
                  <div className="mt-3 space-y-2">
                    {(recipients.data || []).slice(0, 6).map((recipient) => (
                      <div key={recipient.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-semibold text-slate-700">{recipient.client_name || recipient.recipient_id}</span>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-black text-slate-500">{recipient.status}</span>
                        {recipient.skipped_reason ? <span className="text-xs font-semibold text-amber-700">{recipient.skipped_reason}</span> : null}
                        {recipient.error_code ? <span className="text-xs font-semibold text-rose-700">{recipient.error_code}</span> : null}
                      </div>
                    ))}
                    {!recipients.isLoading && !(recipients.data || []).length ? <p className="text-sm font-semibold text-slate-500">Очередь появится после подготовки кампании.</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="Выберите кампанию" description="После создания рассылки здесь появятся аудитория, очередь и управление запуском." />
          )}
        </div>
      </section>

      <Modal title="Новая рассылка" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-3xl border border-brand-100 bg-brand-50/70 p-4">
            <p className="text-sm font-black text-brand-900">Боевой порядок запуска</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Создание кампании не отправляет сообщения. Сначала сохраните рассылку, затем подготовьте аудиторию, проверьте checklist и только после этого запускайте отправку.
            </p>
          </div>
          <Input label="Название" value={form.name} onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))} placeholder="Напоминание о свободных окнах" />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Канал"
              value={form.channel}
              onChange={(event) => setForm((state) => ({ ...state, channel: event.target.value }))}
              options={[
                { value: "telegram", label: "Telegram" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
            <Select
              label="Тип кампании"
              value={form.campaign_type}
              onChange={(event) => setForm((state) => ({ ...state, campaign_type: event.target.value }))}
              options={[
                { value: "service", label: "Сервисная" },
                { value: "marketing", label: "Маркетинговая" },
                { value: "transactional", label: "Транзакционная" },
              ]}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Select
              label="Шаблон"
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
                { value: "", label: "Без шаблона" },
                ...channelTemplates.map((template) => ({ value: String(template.id), label: `${template.name}${template.is_approved ? " · approved" : ""}` })),
              ]}
            />
            <Button type="button" variant="secondary" disabled={!canManageOutreach || !form.message_text.trim()} isLoading={createTemplate.isPending} onClick={() => createTemplate.mutate()}>
              Сохранить шаблон
            </Button>
          </div>
          <Input label="Название нового шаблона" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Напоминание о записи" />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Аудитория"
              value={form.audience_type}
              onChange={(event) => setForm((state) => ({ ...state, audience_type: event.target.value }))}
              options={[
                { value: "all_clients", label: "Все клиенты с этим каналом" },
                { value: "segment", label: "Сегмент клиентов" },
                { value: "manual", label: "Ручной список" },
              ]}
            />
            <Select
              label="Согласие клиента"
              value={form.require_opt_in ? "required" : "not_required"}
              onChange={(event) => setForm((state) => ({ ...state, require_opt_in: event.target.value === "required" }))}
              options={[
                { value: "required", label: "Только с opt-in" },
                { value: "not_required", label: "Без проверки opt-in" },
              ]}
            />
          </div>
          {form.audience_type === "segment" ? (
            <Select
              label="Сегмент"
              value={form.segment}
              onChange={(event) => setForm((state) => ({ ...state, segment: event.target.value }))}
              options={[
                { value: "", label: "Выберите сегмент" },
                ...segmentList.map((segment) => ({ value: String(segment.id), label: `${segment.name} (${segment.cached_count})` })),
              ]}
            />
          ) : null}
          {form.channel === "whatsapp" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="WhatsApp template name" value={form.whatsapp_template_name} onChange={(event) => setForm((state) => ({ ...state, whatsapp_template_name: event.target.value }))} placeholder="appointment_recall_ru" />
              <Input label="Язык" value={form.whatsapp_template_language} onChange={(event) => setForm((state) => ({ ...state, whatsapp_template_language: event.target.value }))} placeholder="ru" />
              <Select
                label="Статус template"
                value={form.whatsapp_template_status}
                onChange={(event) => setForm((state) => ({ ...state, whatsapp_template_status: event.target.value }))}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Лимит в минуту" type="number" value={form.rate_limit_per_minute} onChange={(event) => setForm((state) => ({ ...state, rate_limit_per_minute: event.target.value }))} />
            <Input label="Batch за запуск" type="number" value={form.batch_size} onChange={(event) => setForm((state) => ({ ...state, batch_size: event.target.value }))} />
          </div>
          <Input label="Когда отправить" type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm((state) => ({ ...state, scheduled_at: event.target.value }))} />
          <Textarea label="Сообщение" value={form.message_text} onChange={(event) => setForm((state) => ({ ...state, message_text: event.target.value }))} rows={6} />
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-600">
            Переменные шаблона: {"{client_name}"}, {"{phone}"}, {"{email}"}, {"{business_name}"}, {"{channel}"}.
          </div>
          <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold leading-6 text-amber-900">
            Боевой режим: клиенты без opt-in или с opt-out будут пропущены. WhatsApp запуск блокируется, пока template не отмечен как approved.
          </div>
          <Button type="button" disabled={!canManageOutreach || !form.message_text.trim() || (form.audience_type === "segment" && !form.segment)} isLoading={createCampaign.isPending} onClick={() => createCampaign.mutate()}>
            <Send size={16} /> Создать
          </Button>
        </div>
      </Modal>

      <Modal title="Импорт согласий" open={consentOpen} onClose={() => setConsentOpen(false)}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Канал"
              value={consentForm.channel}
              onChange={(event) => setConsentForm((state) => ({ ...state, channel: event.target.value as "telegram" | "whatsapp" }))}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "telegram", label: "Telegram" },
              ]}
            />
            <Select
              label="Статус"
              value={consentForm.status}
              onChange={(event) => setConsentForm((state) => ({ ...state, status: event.target.value as "opted_in" | "opted_out" | "unknown" }))}
              options={[
                { value: "opted_in", label: "Opt-in" },
                { value: "opted_out", label: "Opt-out" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
          </div>
          <Input label="Источник согласия" value={consentForm.source} onChange={(event) => setConsentForm((state) => ({ ...state, source: event.target.value }))} />
          <Textarea
            label="Клиенты"
            value={consentForm.rows}
            onChange={(event) => setConsentForm((state) => ({ ...state, rows: event.target.value }))}
            rows={8}
            placeholder="+77010001010; согласие из анкеты&#10;client@example.com; согласие из сайта"
          />
          <Input type="file" accept=".csv,.xlsx" onChange={(event) => setConsentFile(event.target.files?.[0] || null)} />
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-600">
            Импорт обновляет согласия только у уже существующих клиентов по телефону, email или client_id. Файл может содержать колонки phone, email, client_id, channel, status, source, note.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!consentForm.rows.trim()} isLoading={importConsents.isPending} onClick={() => importConsents.mutate()}>
              <Upload size={16} /> Импортировать текст
            </Button>
            <Button type="button" variant="secondary" disabled={!consentFile} isLoading={importConsentFile.isPending} onClick={() => importConsentFile.mutate()}>
              <Upload size={16} /> Импортировать файл
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
  return (
    <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-black text-midnight">Ручная аудитория</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">Выбрано: {selectedIds.length}. В очередь попадут только клиенты с ID канала и разрешенным consent.</p>
        </div>
        <Input className="md:max-w-xs" placeholder="Поиск клиента" value={search} onChange={(event) => onSearch(event.target.value)} />
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
              className={`rounded-2xl border px-3 py-2 text-left transition ${selected ? "border-brand-200 bg-brand-50 text-brand-900" : "border-slate-100 bg-slate-50 text-slate-700"} ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-brand-100 hover:bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{client.full_name}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold opacity-70">{recipientId || "нет ID канала"}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black">{selected ? "выбран" : channelLabels[campaign.channel]}</span>
              </div>
            </button>
          );
        })}
      </div>
      {!clients.length ? <p className="mt-3 text-sm font-semibold text-slate-500">Клиенты не найдены.</p> : null}
    </div>
  );
}

function SafetyCard({ icon: Icon, label, value, tone = "slate" }: { icon: LucideIcon; label: string; value: string; tone?: "green" | "amber" | "slate" }) {
  const classes = tone === "green" ? "bg-emerald-50 text-emerald-800" : tone === "amber" ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700";
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${classes}`}>
      <Icon size={18} />
      <div>
        <p className="text-xs font-black uppercase opacity-70">{label}</p>
        <p className="mt-0.5 text-sm font-black">{value}</p>
      </div>
    </div>
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
  const iconClass = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-700";
  return (
    <div className="rounded-3xl border border-slate-100 bg-white/95 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-400">{title}</p>
          <p className="mt-1 text-sm font-black text-midnight">{value}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-midnight">{value}</p>
    </div>
  );
}

function MiniCount({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "amber" }) {
  return (
    <div className={`rounded-2xl bg-white px-2 py-2 ${tone === "amber" ? "text-amber-800" : "text-slate-600"}`}>
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-black">{value}</p>
    </div>
  );
}
