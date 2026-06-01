import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck2, CalendarClock, Copy, Send, ShieldAlert, ShieldCheck, SlidersHorizontal, Stethoscope, UsersRound, Workflow } from "lucide-react";
import { Link } from "react-router-dom";

import { billingApi } from "../../api/billing";
import { appointmentMessageSettingsApi } from "../../api/appointments";
import { businessesApi } from "../../api/businesses";
import { getApiErrorMessage } from "../../api/client";
import { customFieldsApi } from "../../api/customFields";
import { importExportApi, type ImportEntity } from "../../api/importExport";
import { leadFormsApi, leadFormSubmissionsApi } from "../../api/leadForms";
import { notificationsApi } from "../../api/notifications";
import { quickRepliesApi } from "../../api/quickReplies";
import { securityApi } from "../../api/security";
import { teamApi } from "../../api/team";
import { BusinessSettingsForm } from "../../components/forms/BusinessSettingsForm";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { hasPermission, permissionResourceLabel } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../auth/AuthProvider";
import { DevelopersSection } from "./DevelopersSection";
import type { AppointmentMessageSetting, Business, BusinessInvitation, BusinessMembershipSummary, BusinessRole, CrmEntityType, CustomFieldDefinition, Notification, NotificationPreference, QuickReplyTemplate, RolePermission } from "../../types";

const teamRoleOptions = [
  { value: "owner" },
  { value: "admin" },
  { value: "manager" },
  { value: "operator" },
  { value: "marketer" },
  { value: "accountant" },
  { value: "support" },
  { value: "staff" },
];

const accessGroups = [
  { key: "sales", resources: ["leads", "deals"] },
  { key: "clients", resources: ["clients"] },
  { key: "chats", resources: ["conversations"] },
  { key: "calendar", resources: ["appointments"] },
  { key: "tasks", resources: ["tasks"] },
  { key: "analytics", resources: ["analytics"] },
  { key: "settings", resources: ["settings"] },
  { key: "export", resources: ["billing"] },
  { key: "security", resources: ["team", "audit_logs"] },
];

const visibilityOptions = [
  { value: "own" },
  { value: "team" },
  { value: "business" },
];

const roleGuideKeys = ["manager", "operator", "staff", "accountant"] as const;
const notificationCategories: Array<{ category: Notification["category"]; titleKey: string; descriptionKey: string }> = [
  { category: "sales", titleKey: "settings.notifications.category.sales", descriptionKey: "settings.notifications.category.sales.text" },
  { category: "tasks", titleKey: "settings.notifications.category.tasks", descriptionKey: "settings.notifications.category.tasks.text" },
  { category: "outreach", titleKey: "settings.notifications.category.outreach", descriptionKey: "settings.notifications.category.outreach.text" },
  { category: "ai_alerts", titleKey: "settings.notifications.category.aiAlerts", descriptionKey: "settings.notifications.category.aiAlerts.text" },
  { category: "system", titleKey: "settings.notifications.category.system", descriptionKey: "settings.notifications.category.system.text" },
  { category: "finance", titleKey: "settings.notifications.category.finance", descriptionKey: "settings.notifications.category.finance.text" },
];

const settingsGroupOrder = ["business", "team", "communication", "setup", "advanced"] as const;

type SettingsGroupKey = (typeof settingsGroupOrder)[number];

const settingsSections: Array<{ id: string; group?: SettingsGroupKey }> = [
  { id: "business-profile", group: "business" },
  { id: "team-access", group: "team" },
  { id: "roles", group: "team" },
  { id: "security-center", group: "team" },
  { id: "appointment-messages" },
  { id: "notification-preferences", group: "communication" },
  { id: "quick-replies", group: "communication" },
  { id: "operations-setup", group: "setup" },
  { id: "data-tools", group: "setup" },
  { id: "lead-forms", group: "setup" },
  { id: "billing", group: "setup" },
  { id: "custom-fields", group: "advanced" },
  { id: "automations", group: "advanced" },
  { id: "developer", group: "advanced" },
];

const settingsSectionGroupFallback: Record<string, SettingsGroupKey> = {
  "appointment-messages": "communication",
};

const appointmentScenarioLabels: Record<AppointmentMessageSetting["scenario"], { titleKey: string; descriptionKey: string }> = {
  confirmation: {
    titleKey: "settings.appointmentMessages.scenario.confirmation",
    descriptionKey: "settings.appointmentMessages.scenario.confirmation.text",
  },
  reminder: {
    titleKey: "settings.appointmentMessages.scenario.reminder",
    descriptionKey: "settings.appointmentMessages.scenario.reminder.text",
  },
  thank_you: {
    titleKey: "settings.appointmentMessages.scenario.thankYou",
    descriptionKey: "settings.appointmentMessages.scenario.thankYou.text",
  },
};

const appointmentChannelOptions = [
  { value: "auto", labelKey: "settings.appointmentMessages.channel.auto" },
  { value: "telegram", labelKey: "settings.appointmentMessages.channel.telegram" },
  { value: "whatsapp", labelKey: "settings.appointmentMessages.channel.whatsapp" },
  { value: "email", labelKey: "settings.appointmentMessages.channel.email" },
  { value: "sms", labelKey: "settings.appointmentMessages.channel.sms" },
  { value: "system", labelKey: "settings.appointmentMessages.channel.system" },
];

export function SettingsPage() {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const { business, isLoading } = useActiveBusiness();
  const { user } = useAuth();
  const canViewBilling = hasPermission(user, business?.id, "billing", "view");
  const canViewTeam = hasPermission(user, business?.id, "team", "view");
  const canManageTeam = hasPermission(user, business?.id, "team", "manage");
  const canViewAudit = hasPermission(user, business?.id, "audit_logs", "view");
  const canViewSettings = hasPermission(user, business?.id, "settings", "view");
  const canViewNotifications = hasPermission(user, business?.id, "notifications", "view");
  const subscription = useQuery({
    queryKey: ["current-subscription"],
    queryFn: billingApi.currentSubscription,
    enabled: Boolean(canViewBilling),
  });
  const usage = useQuery({
    queryKey: ["billing-usage-summary"],
    queryFn: billingApi.usageSummary,
    enabled: Boolean(canViewBilling),
  });
  const entitlements = useQuery({
    queryKey: ["billing-entitlements"],
    queryFn: billingApi.entitlements,
    enabled: Boolean(canViewBilling),
  });
  const [fieldForm, setFieldForm] = useState({
    entity_type: "client" as CrmEntityType,
    label: "",
    key: "",
    field_type: "text" as CustomFieldDefinition["field_type"],
    options: "",
  });
  const customFields = useQuery({
    queryKey: ["custom-fields", business?.id],
    queryFn: () => customFieldsApi.list(),
    enabled: Boolean(business && canViewSettings),
  });
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business && canViewTeam),
  });
  const teamRoles = useQuery({
    queryKey: ["team-roles", business?.id],
    queryFn: teamApi.roles,
    enabled: Boolean(business && canViewTeam),
  });
  const invitations = useQuery({
    queryKey: ["team-invitations", business?.id],
    queryFn: teamApi.invitations,
    enabled: Boolean(business && canManageTeam),
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    phone: "",
    telegram: "",
    full_name: "",
    role: "operator" as BusinessMembershipSummary["role"],
    delivery_channel: "whatsapp" as "email" | "whatsapp" | "telegram" | "manual",
  });
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [advancedAccessOpen, setAdvancedAccessOpen] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<BusinessInvitation | null>(null);
  const departments = useQuery({
    queryKey: ["team-departments", business?.id],
    queryFn: teamApi.departments,
    enabled: Boolean(business && canViewTeam),
  });
  const [departmentName, setDepartmentName] = useState("");
  const [quickReplyForm, setQuickReplyForm] = useState({
    title: "",
    text: "",
    category: "",
    channel: "all",
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEntity, setImportEntity] = useState<ImportEntity>("clients");
  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [manualSaleForm, setManualSaleForm] = useState({ external_id: "", client_name: "", item_name: "", amount: "", source: "manual" });
  const [manualCatalogForm, setManualCatalogForm] = useState({ item_type: "service", sku: "", name: "", duration_minutes: "30", price_from: "", stock_quantity: "", source: "manual" });
  const [appointmentMessageDrafts, setAppointmentMessageDrafts] = useState<Record<number, Partial<AppointmentMessageSetting>>>({});
  const importJobs = useQuery({
    queryKey: ["import-jobs", business?.id],
    queryFn: () => importExportApi.importJobs(business?.id),
    enabled: Boolean(business && canViewSettings),
  });
  const leadForms = useQuery({
    queryKey: ["lead-forms", business?.id],
    queryFn: leadFormsApi.list,
    enabled: Boolean(business && canViewSettings),
  });
  const leadFormSubmissions = useQuery({
    queryKey: ["lead-form-submissions", business?.id],
    queryFn: leadFormSubmissionsApi.list,
    enabled: Boolean(business && canViewSettings),
  });
  const securityRisk = useQuery({
    queryKey: ["security-risk", business?.id],
    queryFn: () => securityApi.riskSummary(business?.id),
    enabled: Boolean(business && canViewAudit),
    retry: false,
  });
  const auditLogs = useQuery({
    queryKey: ["security-audit", business?.id],
    queryFn: () => securityApi.audit({ business: business?.id }),
    enabled: Boolean(business && canViewAudit),
    retry: false,
  });
  const loginHistory = useQuery({
    queryKey: ["security-login-history", business?.id],
    queryFn: () => securityApi.loginHistory({ business: business?.id }),
    enabled: Boolean(business && canViewAudit),
    retry: false,
  });
  const supportGrants = useQuery({
    queryKey: ["security-support-grants", business?.id],
    queryFn: securityApi.supportGrants.list,
    enabled: Boolean(business && canViewAudit),
    retry: false,
  });
  const notificationPreferences = useQuery({
    queryKey: ["notification-preferences", business?.id, user?.id],
    queryFn: () => notificationsApi.preferences.list({ user: "me" }),
    enabled: Boolean(business?.id && user?.id && canViewNotifications),
  });
  const appointmentMessageSettings = useQuery({
    queryKey: ["appointment-message-settings", business?.id],
    queryFn: () => appointmentMessageSettingsApi.list({ business: business?.id }),
    enabled: Boolean(business?.id && canViewSettings),
  });
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<number | null>(null);
  const [quickReplyEditForm, setQuickReplyEditForm] = useState({
    title: "",
    text: "",
    category: "",
    channel: "all" as QuickReplyTemplate["channel"],
    is_active: true,
  });
  const quickReplies = useQuery({
    queryKey: ["quick-replies", business?.id],
    queryFn: quickRepliesApi.list,
    enabled: Boolean(business && canViewNotifications),
  });
  const mutation = useMutation({
    mutationFn: (payload: Partial<Business>) =>
      business ? businessesApi.update({ id: business.id, payload }) : businessesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["businesses"] }),
  });
  const customFieldMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return customFieldsApi.create({
        business: business.id,
        entity_type: fieldForm.entity_type,
        key: fieldForm.key || slugify(fieldForm.label),
        label: fieldForm.label,
        field_type: fieldForm.field_type,
        options_json: {
          options: fieldForm.options
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        is_required: false,
        is_active: true,
        sort_order: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      setFieldForm({ entity_type: "client", label: "", key: "", field_type: "text", options: "" });
    },
  });
  const updateMemberMutation = useMutation({
    mutationFn: teamApi.updateMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });
  const updatePermissionMutation = useMutation({
    mutationFn: teamApi.updatePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
  });
  const inviteMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return teamApi.createInvitation({
        business: business.id,
        email: inviteForm.email,
        phone: inviteForm.phone,
        telegram: inviteForm.telegram,
        full_name: inviteForm.full_name,
        role: inviteForm.role,
        delivery_channel: inviteForm.delivery_channel,
      });
    },
    onSuccess: (invitation) => {
      setLastCreatedInvite(invitation);
      setInviteForm({ email: "", phone: "", telegram: "", full_name: "", role: "operator", delivery_channel: "whatsapp" });
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
    },
  });
  const revokeInvitationMutation = useMutation({
    mutationFn: teamApi.revokeInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-invitations"] }),
  });
  const departmentMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return teamApi.createDepartment({ business: business.id, name: departmentName, description: "" });
    },
    onSuccess: () => {
      setDepartmentName("");
      queryClient.invalidateQueries({ queryKey: ["team-departments"] });
    },
  });
  const quickReplyMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return quickRepliesApi.create({
        business: business.id,
        title: quickReplyForm.title,
        text: quickReplyForm.text,
        category: quickReplyForm.category,
        channel: quickReplyForm.channel as QuickReplyTemplate["channel"],
        sort_order: 0,
        is_active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies"] });
      setQuickReplyForm({ title: "", text: "", category: "", channel: "all" });
    },
  });
  const updateQuickReplyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<QuickReplyTemplate> }) => {
      return quickRepliesApi.update({
        id,
        payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies"] });
      setEditingQuickReplyId(null);
    },
  });
  const removeQuickReplyMutation = useMutation({
    mutationFn: (id: number) => quickRepliesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies"] });
      if (editingQuickReplyId) setEditingQuickReplyId(null);
    },
  });
  const uploadImportMutation = useMutation({
    mutationFn: () => {
      if (!business || !importFile) throw new Error("Business and file are required.");
      return importExportApi.upload({ business: business.id, entity: importEntity, file: importFile });
    },
    onSuccess: (job) => {
      setActiveImportId(Number(job.id));
      setImportFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
  });
  const confirmImportMutation = useMutation({
    mutationFn: importExportApi.confirm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
  const exportMutation = useMutation({
    mutationFn: (entity: "clients" | "leads" | "deals" | "sales" | "catalog") => {
      if (!business) throw new Error("Business is required.");
      return importExportApi.exportEntity({ business: business.id, entity });
    },
  });
  const templateMutation = useMutation({
    mutationFn: importExportApi.downloadTemplate,
  });
  const manualSaleMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return importExportApi.createManualSale({ business: business.id, ...manualSaleForm });
    },
    onSuccess: () => {
      setManualSaleForm({ external_id: "", client_name: "", item_name: "", amount: "", source: "manual" });
      queryClient.invalidateQueries({ queryKey: ["owner-dashboard"] });
    },
  });
  const manualCatalogMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return importExportApi.createManualCatalogItem({ business: business.id, ...manualCatalogForm });
    },
    onSuccess: () => {
      setManualCatalogForm({ item_type: "service", sku: "", name: "", duration_minutes: "30", price_from: "", stock_quantity: "", source: "manual" });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
  const createLeadFormMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return leadFormsApi.createTemplate({ business: business.id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-forms"] }),
  });
  const notificationPreferenceMutation = useMutation({
    mutationFn: ({ category, enabled }: { category: Notification["category"]; enabled: boolean }) => {
      if (!business || !user) throw new Error("Business and user are required.");
      const existing = (notificationPreferences.data || []).find((preference) => preference.category === category);
      const payload: Partial<NotificationPreference> = {
        business: business.id,
        user: user.id,
        category,
        in_app_enabled: enabled,
      };
      if (existing) return notificationsApi.preferences.update({ id: existing.id, payload });
      return notificationsApi.preferences.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const appointmentMessageMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AppointmentMessageSetting> }) => appointmentMessageSettingsApi.update({ id, payload }),
    onSuccess: () => {
      setAppointmentMessageDrafts({});
      queryClient.invalidateQueries({ queryKey: ["appointment-message-settings"] });
    },
  });

  function startEditingQuickReply(template: QuickReplyTemplate) {
    setEditingQuickReplyId(Number(template.id));
    setQuickReplyEditForm({
      title: template.title,
      text: template.text,
      category: template.category || "",
      channel: template.channel,
      is_active: template.is_active,
    });
  }

  if (isLoading) return <LoadingState />;

  const currentPlan = subscription.data?.plan;
  const hasSubscription = Boolean(subscription.data && currentPlan);
  const members = teamMembers.data || [];
  const roles = teamRoles.data || [];
  const selectedMember = members.find((member) => Number(member.id) === selectedMemberId) || members[0];
  const selectedRole =
    roles.find((role) => Number(role.id) === selectedRoleId) ||
    roles.find((role) => Number(role.id) === Number(selectedMember?.business_role)) ||
    roles.find((role) => role.preset_key === selectedMember?.role) ||
    roles.find((role) => role.preset_key === "staff") ||
    roles[0];
  const selectedVisibility = selectedRole ? roleVisibility(selectedRole) : "none";
  const jobs = importJobs.data || [];
  const activeImport = jobs.find((job) => Number(job.id) === activeImportId) || jobs[0];
  const importSummary = activeImport?.summary_json || activeImport?.preview_json?.import_summary;
  const apiOrigin = import.meta.env.VITE_API_URL || window.location.origin;
  const translatedTeamRoleOptions = teamRoleOptions.map((option) => ({
    ...option,
    label: t(`settings.role.${option.value}`),
  }));
  const editableTeamRoleOptions = translatedTeamRoleOptions.filter((option) => option.value !== "owner");
  const roleDescription = (role: string) => t(`settings.roleDescription.${role}`);
  const translatedVisibilityOptions = visibilityOptions.map((option) => ({
    ...option,
    label: t(`settings.visibility.${option.value}`),
    description: t(`settings.visibility.${option.value}.text`),
  }));
  const translatedSettingsSections = settingsSections.map((section) => ({
    ...section,
    label: t(`settings.section.${section.id}`),
    group: section.group || settingsSectionGroupFallback[section.id] || "advanced",
  }));
  const translatedSettingsGroups = settingsGroupOrder.map((groupKey) => ({
    key: groupKey,
    label: t(`settings.group.${groupKey}`),
    sections: translatedSettingsSections.filter((section) => section.group === groupKey),
  })).filter((item) => item.sections.length);
  const quickReplyChannelOptions = [
    { value: "all", label: t("settings.channel.all") },
    { value: "website", label: t("settings.channel.website") },
    { value: "telegram", label: "Telegram" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "instagram", label: "Instagram" },
    { value: "manual", label: t("settings.channel.manual") },
  ];
  const importEntityOptions = [
    { value: "clients", label: t("settings.entity.clients") },
    { value: "sales", label: t("settings.entity.sales") },
    { value: "catalog", label: t("settings.entity.catalog") },
  ];
  const locale = language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  const operationsSetup = [
    { key: "services", href: "/dashboard/services", icon: Stethoscope },
    { key: "resources", href: "/dashboard/resources", icon: UsersRound },
    { key: "working-hours", href: "/dashboard/working-hours", icon: CalendarClock },
  ];
  const preferenceByCategory = new Map((notificationPreferences.data || []).map((preference) => [preference.category, preference]));
  const appointmentMessages = appointmentMessageSettings.data || [];
  const appointmentMessageValue = <K extends keyof AppointmentMessageSetting>(setting: AppointmentMessageSetting, key: K): AppointmentMessageSetting[K] => {
    return (appointmentMessageDrafts[Number(setting.id)]?.[key] as AppointmentMessageSetting[K] | undefined) ?? setting[key];
  };

  function updateMemberRole(memberId: number, roleKey: BusinessMembershipSummary["role"]) {
    if (roleKey === "owner") return;
    const role = roles.find((item) => item.preset_key === roleKey);
    updateMemberMutation.mutate({
      id: memberId,
      payload: {
        role: roleKey,
        business_role: role?.id || null,
      },
    });
  }

  function applyGroupLevel(groupResources: string[], level: RolePermission["scope"]) {
    if (!selectedRole) return;
    selectedRole.permissions
      .filter((permission) => groupResources.includes(permission.resource))
      .forEach((permission) => {
        updatePermissionMutation.mutate({
          id: permission.id,
          payload: {
            is_allowed: level !== "none",
            scope: level,
          },
        });
      });
  }

  function inviteUrl(path: string) {
    return `${window.location.origin}${path}`;
  }

  function inviteMessage(path: string) {
    return t("settings.inviteMessage", { url: inviteUrl(path) });
  }

  function inviteShareUrl(invitation: { invite_path: string; email: string; phone?: string; telegram?: string; delivery_channel?: string }) {
    const message = encodeURIComponent(inviteMessage(invitation.invite_path));
    if (invitation.delivery_channel === "email") {
      return `mailto:${invitation.email}?subject=${encodeURIComponent(t("settings.inviteSubject"))}&body=${message}`;
    }
    if (invitation.delivery_channel === "whatsapp" && invitation.phone) {
      const phone = invitation.phone.replace(/\D/g, "");
      return `https://wa.me/${phone}?text=${message}`;
    }
    if (invitation.delivery_channel === "telegram") {
      return `https://t.me/share/url?url=${encodeURIComponent(inviteUrl(invitation.invite_path))}&text=${encodeURIComponent(t("settings.inviteSubject"))}`;
    }
    return inviteUrl(invitation.invite_path);
  }

  async function copyInvitation(invitation: { id: number; invite_path: string }) {
    await navigator.clipboard?.writeText(inviteMessage(invitation.invite_path));
    setCopiedInviteId(invitation.id);
    window.setTimeout(() => setCopiedInviteId((current) => (current === invitation.id ? null : current)), 1800);
  }

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <Card className="mb-5">
        <CardBody className="p-3">
          <Select
            className="min-h-12 rounded-2xl sm:hidden"
            value={window.location.hash.replace("#", "") || translatedSettingsSections[0]?.id || ""}
            onChange={(event) => {
              window.location.hash = event.target.value;
            }}
            options={translatedSettingsSections.map((section) => ({ value: section.id, label: section.label }))}
          />
          <div className="hidden gap-4 overflow-x-auto sm:flex">
            {translatedSettingsGroups.map((groupItem) => (
              <div key={groupItem.key} className="min-w-max">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{groupItem.label}</p>
                <div className="flex gap-2">
                  {groupItem.sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="shrink-0 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-midnight hover:shadow-sm"
                    >
                      {section.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card id="appointment-messages" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.appointmentMessagesEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.appointmentMessagesTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {t("settings.appointmentMessagesText")}
              </p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <CalendarCheck2 size={22} />
            </div>
          </div>
          {appointmentMessageMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(appointmentMessageMutation.error)} /></div> : null}
          {appointmentMessageSettings.isLoading ? (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-bold text-slate-500">{t("settings.appointmentMessagesLoading")}</div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {appointmentMessages.map((setting) => {
                const meta = appointmentScenarioLabels[setting.scenario];
                const enabled = Boolean(appointmentMessageValue(setting, "is_enabled"));
                const offsetValue = Number(appointmentMessageValue(setting, "offset_minutes"));
                const hasDraft = Boolean(appointmentMessageDrafts[Number(setting.id)]);
                return (
                  <div key={setting.id} className="flex flex-col rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-midnight">{t(meta.titleKey)}</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{t(meta.descriptionKey)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={appointmentMessageMutation.isPending}
                        onClick={() =>
                          appointmentMessageMutation.mutate({
                            id: Number(setting.id),
                            payload: { is_enabled: !enabled },
                          })
                        }
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                          enabled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                      >
                        {enabled ? t("settings.enabled") : t("settings.paused")}
                      </button>
                    </div>
                    <div className="grid gap-3">
                      <Input
                        label={setting.scenario === "thank_you" ? t("settings.appointmentMessages.offsetAfter") : t("settings.appointmentMessages.offsetBefore")}
                        type="number"
                        value={Math.abs(offsetValue)}
                        onChange={(event) => {
                          const raw = Number(event.target.value || 0);
                          const nextValue = setting.scenario === "thank_you" ? Math.abs(raw) : -Math.abs(raw);
                          setAppointmentMessageDrafts((current) => ({
                            ...current,
                            [Number(setting.id)]: { ...current[Number(setting.id)], offset_minutes: nextValue },
                          }));
                        }}
                      />
                      <Select
                        label={t("settings.appointmentMessages.deliveryChannel")}
                        value={String(appointmentMessageValue(setting, "channel_policy"))}
                        onChange={(event) =>
                          setAppointmentMessageDrafts((current) => ({
                            ...current,
                            [Number(setting.id)]: { ...current[Number(setting.id)], channel_policy: event.target.value as AppointmentMessageSetting["channel_policy"] },
                          }))
                        }
                        options={appointmentChannelOptions.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                      />
                      <Textarea
                        label={t("settings.appointmentMessages.templateText")}
                        rows={6}
                        value={String(appointmentMessageValue(setting, "template_text"))}
                        onChange={(event) =>
                          setAppointmentMessageDrafts((current) => ({
                            ...current,
                            [Number(setting.id)]: { ...current[Number(setting.id)], template_text: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="mt-auto pt-4">
                      <Button
                        className="w-full"
                        variant={hasDraft ? "primary" : "secondary"}
                        disabled={!hasDraft || appointmentMessageMutation.isPending}
                        onClick={() =>
                          appointmentMessageMutation.mutate({
                            id: Number(setting.id),
                            payload: appointmentMessageDrafts[Number(setting.id)],
                          })
                        }
                      >
                        {t("settings.appointmentMessages.saveScenario")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
      <Card id="notification-preferences" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.notificationsEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.notificationsTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {t("settings.notificationsText")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              {t("settings.notificationsDisabledCount", { count: notificationPreferences.data?.filter((item) => item.in_app_enabled === false).length || 0 })}
            </div>
          </div>
          {notificationPreferenceMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(notificationPreferenceMutation.error)} /></div> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {notificationCategories.map((item) => {
              const preference = preferenceByCategory.get(item.category);
              const enabled = preference?.in_app_enabled !== false;
              return (
                <div key={item.category} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-midnight">{t(item.titleKey)}</p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{t(item.descriptionKey)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={notificationPreferenceMutation.isPending}
                      onClick={() => notificationPreferenceMutation.mutate({ category: item.category, enabled: !enabled })}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${
                        enabled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      {enabled ? t("settings.enabled") : t("settings.disabled")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
      <Card id="team-access" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.teamEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.teamTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {t("settings.teamText")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              {user?.memberships?.[0]?.role || "role"} · {user?.effective_permissions?.[String(business?.id || "")]?.length || 0} {t("settings.permissions")}
            </div>
          </div>
          {updateMemberMutation.error || departmentMutation.error ? (
            <div className="mb-4"><ErrorState message={getApiErrorMessage(updateMemberMutation.error || departmentMutation.error)} /></div>
          ) : null}
          {inviteMutation.error || revokeInvitationMutation.error ? (
            <div className="mb-4"><ErrorState message={getApiErrorMessage(inviteMutation.error || revokeInvitationMutation.error)} /></div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-slate-100 p-4">
              <div className="mb-4 flex items-start gap-3 rounded-3xl bg-slate-50 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="font-bold text-midnight">{t("settings.accessTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {t("settings.accessText")}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <Select
                  label={t("settings.memberStep")}
                  value={selectedMember?.id ? String(selectedMember.id) : ""}
                  onChange={(event) => setSelectedMemberId(Number(event.target.value))}
                  disabled={!members.length || updateMemberMutation.isPending}
                  options={members.map((member) => ({
                    value: String(member.id),
                    label: member.user.full_name || member.user.email,
                  }))}
                />
                <Select
                  label={t("settings.roleStep")}
                  value={selectedMember?.role || "staff"}
                  onChange={(event) => selectedMember && updateMemberRole(selectedMember.id, event.target.value as BusinessMembershipSummary["role"])}
                  disabled={!selectedMember || selectedMember.role === "owner" || updateMemberMutation.isPending}
                  options={selectedMember?.role === "owner" ? translatedTeamRoleOptions.filter((option) => option.value === "owner") : editableTeamRoleOptions}
                />
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t("settings.visibilityStep")}</p>
                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <p className="font-bold text-midnight">{translatedVisibilityLabel(selectedVisibility, t)}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{translatedVisibilityDescription(selectedVisibility, t)}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-sm font-black text-midnight">{t("settings.roleGuideTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{t("settings.roleGuideText")}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {roleGuideKeys.map((roleKey) => (
                    <button
                      key={roleKey}
                      type="button"
                      className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft ${
                        inviteForm.role === roleKey ? "border-brand-200 bg-white shadow-sm" : "border-white bg-white/70"
                      }`}
                      onClick={() => setInviteForm((current) => ({ ...current, role: roleKey }))}
                    >
                      <p className="text-sm font-black text-midnight">{t(`settings.role.${roleKey}`)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{roleDescription(roleKey)}</p>
                    </button>
                  ))}
                </div>
              </div>
              {selectedMember ? (
                <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-black text-midnight">{selectedMember.user.full_name || selectedMember.user.email}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedMember.user.email} · {translatedTeamRoleOptions.find((role) => role.value === selectedMember.role)?.label || selectedMember.business_role_name || selectedRole?.name || t("settings.role.staff")}
                      </p>
                    </div>
                    <span className={selectedMember.is_active ? "rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700" : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500"}>
                      {selectedMember.is_active ? t("settings.active") : t("settings.inactive")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 md:col-span-3">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{t("settings.currentRole")}</p>
                      <p className="mt-1 text-sm font-bold text-midnight">{translatedTeamRoleOptions.find((role) => role.value === selectedMember.role)?.label || selectedMember.role}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{roleDescription(selectedMember.role)}</p>
                    </div>
                    {translatedVisibilityOptions.map((option) => (
                      <div
                        key={option.value}
                        className={option.value === selectedVisibility ? "rounded-2xl border border-brand-200 bg-brand-50 p-3" : "rounded-2xl border border-slate-100 bg-slate-50 p-3"}
                      >
                        <p className="text-sm font-bold text-midnight">{option.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {!teamMembers.isLoading && !members.length ? (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">{t("settings.teamEmpty")}</div>
              ) : null}
              <div className="mt-4 rounded-3xl border border-brand-100 bg-brand-50/50 p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
                    <Send size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-midnight">{t("settings.inviteTitle")}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {t("settings.inviteText")}
                    </p>
                  </div>
                </div>
                <form
                  className="grid gap-3 lg:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    inviteMutation.mutate();
                  }}
                >
                  <div>
                    <Input label={t("settings.loginEmail")} type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} required />
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">{t("settings.loginEmailHelp")}</p>
                  </div>
                  <Input label={t("settings.fullName")} value={inviteForm.full_name} onChange={(event) => setInviteForm({ ...inviteForm, full_name: event.target.value })} placeholder={t("settings.fullNamePlaceholder")} />
                  <Select
                    label={t("settings.role")}
                    value={inviteForm.role}
                    onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as BusinessMembershipSummary["role"] })}
                    options={editableTeamRoleOptions}
                  />
                  <div className="rounded-2xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-500">
                    <span className="font-bold text-slate-700">{translatedTeamRoleOptions.find((role) => role.value === inviteForm.role)?.label}:</span>{" "}
                    {roleDescription(inviteForm.role)}
                  </div>
                  <Select
                    label={t("settings.delivery")}
                    value={inviteForm.delivery_channel}
                    onChange={(event) => setInviteForm({ ...inviteForm, delivery_channel: event.target.value as typeof inviteForm.delivery_channel })}
                    options={[
                      { value: "whatsapp", label: "WhatsApp" },
                      { value: "telegram", label: "Telegram" },
                      { value: "email", label: "Email" },
                      { value: "manual", label: t("settings.copyLink") },
                    ]}
                  />
                  <p className="rounded-2xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-500 lg:col-span-2">
                    {t(`settings.deliveryHelp.${inviteForm.delivery_channel}`)}
                  </p>
                  {inviteForm.delivery_channel === "whatsapp" ? (
                    <Input label={t("settings.whatsappPhone")} value={inviteForm.phone} onChange={(event) => setInviteForm({ ...inviteForm, phone: event.target.value })} placeholder="+77015550101" required />
                  ) : null}
                  {inviteForm.delivery_channel === "telegram" ? (
                    <Input label="Telegram" value={inviteForm.telegram} onChange={(event) => setInviteForm({ ...inviteForm, telegram: event.target.value })} placeholder="@username" required />
                  ) : null}
                  <div className="flex items-end lg:col-span-2">
                    <Button type="submit" className="min-h-[52px] w-full lg:w-auto" isLoading={inviteMutation.isPending}>{t("settings.createInvite")}</Button>
                  </div>
                </form>
                {lastCreatedInvite ? (
                  <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="font-bold text-emerald-950">{t("settings.inviteCreatedTitle")}</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      {t("settings.inviteCreatedText", {
                        email: lastCreatedInvite.email,
                        role: translatedTeamRoleOptions.find((role) => role.value === lastCreatedInvite.role)?.label || lastCreatedInvite.role,
                      })}
                    </p>
                    <div className="mt-3 grid gap-2 min-[420px]:grid-cols-2">
                      <a href={inviteShareUrl(lastCreatedInvite)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-emerald-800">
                        {t("settings.sendInviteNow")}
                      </a>
                      <Button type="button" variant="secondary" className="min-h-11 rounded-full px-4 text-sm" onClick={() => copyInvitation(lastCreatedInvite)}>
                        <Copy size={14} />
                        {copiedInviteId === lastCreatedInvite.id ? t("settings.copied") : t("settings.copy")}
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 space-y-2">
                  {(invitations.data || []).slice(0, 4).map((invitation) => (
                    <div key={invitation.id} className="rounded-2xl bg-white px-3 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-midnight">{invitation.full_name || invitation.email}</p>
                          <p className="text-xs text-slate-500">
                            {invitation.email} · {translatedTeamRoleOptions.find((role) => role.value === invitation.role)?.label || invitation.role} · {t(`status.${invitation.status}`)}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap">
                          <a href={inviteShareUrl(invitation)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">
                            {t("settings.send")}
                          </a>
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-11 rounded-full px-4 text-sm"
                            onClick={() => copyInvitation(invitation)}
                          >
                            <Copy size={14} />
                            {copiedInviteId === invitation.id ? t("settings.copied") : t("settings.copy")}
                          </Button>
                          {invitation.status === "pending" ? (
                            <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 text-sm" onClick={() => revokeInvitationMutation.mutate(invitation.id)} isLoading={revokeInvitationMutation.isPending}>
                              {t("settings.revoke")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!invitations.isLoading && !invitations.data?.length ? <p className="text-sm text-slate-500">{t("settings.noInvites")}</p> : null}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 p-4">
              <h3 className="text-base font-bold text-midnight">{t("settings.departments")}</h3>
              <form
                className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (departmentName.trim()) departmentMutation.mutate();
                }}
              >
                <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder={t("settings.departmentPlaceholder")} />
                <Button type="submit" variant="secondary" className="min-h-[48px] px-5" isLoading={departmentMutation.isPending}>+</Button>
              </form>
              <div className="mt-4 space-y-2">
                {(departments.data || []).map((department) => (
                  <div key={department.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                    <p className="font-semibold text-midnight">{department.name}</p>
                    <p className="text-xs text-slate-500">{department.members_count || 0} {t("settings.members")}</p>
                  </div>
                ))}
                {!departments.isLoading && !departments.data?.length ? <p className="text-sm text-slate-500">{t("settings.noDepartments")}</p> : null}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card id="security-center" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">{t("settings.securityEyebrow")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.securityTitle")}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  {t("settings.securityText")}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-red-50 px-3 py-2">
                  <p className="text-xs font-bold text-red-700">{t("settings.highRisk")}</p>
                  <p className="text-xl font-black text-red-800">{(securityRisk.data?.risk_counts.high || 0) + (securityRisk.data?.risk_counts.critical || 0)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-3 py-2">
                  <p className="text-xs font-bold text-amber-700">{t("settings.failedLogins")}</p>
                  <p className="text-xl font-black text-amber-800">{securityRisk.data?.failed_logins || 0}</p>
                </div>
                <div className="rounded-2xl bg-brand-50 px-3 py-2">
                  <p className="text-xs font-bold text-brand-700">{t("settings.support")}</p>
                  <p className="text-xl font-black text-brand-800">{securityRisk.data?.active_support_grants || 0}</p>
                </div>
              </div>
            </div>
            {securityRisk.error || auditLogs.error || loginHistory.error ? (
              <div className="mb-4 rounded-3xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 text-amber-700" size={20} />
                  <div>
                    <p className="font-bold text-amber-900">{t("settings.securityHidden")}</p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">{t("settings.securityHiddenText")}</p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-100 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-black text-midnight">{t("settings.riskEvents")}</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{auditLogs.data?.length || 0} {t("settings.events")}</span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {(auditLogs.data || []).slice(0, 8).map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-midnight">{log.action} · {log.entity_type} #{log.entity_id}</p>
                          <p className="mt-1 text-xs text-slate-500">{log.actor_email || "system"} · {new Date(log.created_at).toLocaleString(locale)}</p>
                        </div>
                        <span className={riskClass(log.risk_level)}>{log.risk_level}</span>
                      </div>
                    </div>
                  ))}
                  {!auditLogs.isLoading && !auditLogs.data?.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{t("settings.noAuditEvents")}</p> : null}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <h3 className="font-black text-midnight">{t("settings.logins")}</h3>
                  <div className="mt-3 space-y-2">
                    {(loginHistory.data || []).slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-bold text-midnight">{item.email || item.user_email}</p>
                          <p className="text-xs text-slate-500">{item.ip_address || "no ip"} · {new Date(item.created_at).toLocaleString(locale)}</p>
                        </div>
                        <span className={item.status === "success" ? "text-xs font-bold text-green-700" : "text-xs font-bold text-red-700"}>{item.status}</span>
                      </div>
                    ))}
                    {!loginHistory.isLoading && !loginHistory.data?.length ? <p className="text-sm text-slate-500">{t("settings.noLoginHistory")}</p> : null}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <h3 className="font-black text-midnight">{t("settings.supportAccess")}</h3>
                  <div className="mt-3 space-y-2">
                    {(supportGrants.data || []).slice(0, 4).map((grant) => (
                      <div key={grant.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-sm font-bold text-midnight">{grant.user_email}</p>
                        <p className="text-xs text-slate-500">{grant.is_active ? t("settings.active") : t("settings.inactive")} · {t("settings.until")} {new Date(grant.expires_at).toLocaleString(locale)}</p>
                      </div>
                    ))}
                    {!supportGrants.isLoading && !supportGrants.data?.length ? <p className="text-sm text-slate-500">{t("settings.noSupportGrants")}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card id="quick-replies" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.quickRepliesEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.quickRepliesTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {t("settings.quickRepliesText")}
            </p>
          </div>
          {quickReplyMutation.error || updateQuickReplyMutation.error || removeQuickReplyMutation.error ? (
            <div className="mb-4">
              <ErrorState message={getApiErrorMessage(quickReplyMutation.error || updateQuickReplyMutation.error || removeQuickReplyMutation.error)} />
            </div>
          ) : null}
          <form
            className="grid gap-3 lg:grid-cols-[180px_150px_180px_minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              quickReplyMutation.mutate();
            }}
          >
            <Input label={t("settings.templateTitle")} value={quickReplyForm.title} onChange={(event) => setQuickReplyForm({ ...quickReplyForm, title: event.target.value })} required />
            <Select
              label={t("settings.channel")}
              value={quickReplyForm.channel}
              onChange={(event) => setQuickReplyForm({ ...quickReplyForm, channel: event.target.value })}
              options={quickReplyChannelOptions.filter((option) => option.value !== "manual")}
            />
            <Input label={t("settings.category")} placeholder={t("settings.categoryPlaceholder")} value={quickReplyForm.category} onChange={(event) => setQuickReplyForm({ ...quickReplyForm, category: event.target.value })} />
            <Textarea label={t("settings.templateText")} value={quickReplyForm.text} onChange={(event) => setQuickReplyForm({ ...quickReplyForm, text: event.target.value })} required />
            <div className="flex items-end">
              <Button type="submit" isLoading={quickReplyMutation.isPending}>{t("settings.add")}</Button>
            </div>
          </form>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(quickReplies.data || []).map((template) => (
              <div key={template.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                {editingQuickReplyId === Number(template.id) ? (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (editingQuickReplyId) {
                        updateQuickReplyMutation.mutate({ id: editingQuickReplyId, payload: quickReplyEditForm });
                      }
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={t("settings.templateTitle")}
                        value={quickReplyEditForm.title}
                        onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, title: event.target.value })}
                        required
                      />
                      <Select
                        label={t("settings.channel")}
                        value={quickReplyEditForm.channel}
                        onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, channel: event.target.value as QuickReplyTemplate["channel"] })}
                        options={quickReplyChannelOptions}
                      />
                    </div>
                    <Input
                      label={t("settings.category")}
                      value={quickReplyEditForm.category}
                      onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, category: event.target.value })}
                    />
                    <Textarea
                      label={t("settings.templateText")}
                      value={quickReplyEditForm.text}
                      onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, text: event.target.value })}
                      required
                    />
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={quickReplyEditForm.is_active}
                        onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, is_active: event.target.checked })}
                      />
                      {t("settings.activeInComposer")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" isLoading={updateQuickReplyMutation.isPending}>{t("settings.save")}</Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingQuickReplyId(null)}>{t("settings.cancel")}</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-midnight">{template.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{template.channel}</span>
                          {template.category ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{template.category}</span> : null}
                          <span className={template.is_active ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500"}>
                            {template.is_active ? t("settings.active") : t("settings.inactive")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{template.text}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => startEditingQuickReply(template)}>
                        {t("settings.edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          const payload = {
                            title: template.title,
                            text: template.text,
                            category: template.category || "",
                            channel: template.channel,
                            is_active: !template.is_active,
                          };
                          setEditingQuickReplyId(Number(template.id));
                          setQuickReplyEditForm(payload);
                          updateQuickReplyMutation.mutate({ id: Number(template.id), payload });
                        }}
                        isLoading={updateQuickReplyMutation.isPending && editingQuickReplyId === Number(template.id)}
                      >
                        {template.is_active ? t("settings.disable") : t("settings.enable")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => removeQuickReplyMutation.mutate(Number(template.id))}
                        isLoading={removeQuickReplyMutation.isPending}
                      >
                        {t("settings.delete")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!quickReplies.isLoading && !quickReplies.data?.length ? (
              <p className="text-sm text-slate-500">{t("settings.noQuickReplies")}</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <Card id="roles" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.rolesEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.rolesTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {t("settings.rolesText")}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setAdvancedAccessOpen((current) => !current)}>
              <SlidersHorizontal size={17} />
              {advancedAccessOpen ? t("settings.hideAdvanced") : t("settings.openAdvanced")}
            </Button>
          </div>
          {updatePermissionMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(updatePermissionMutation.error)} /></div> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(Number(role.id))}
                className={Number(selectedRole?.id) === Number(role.id) ? "rounded-3xl border border-brand-200 bg-brand-50 p-4 text-left shadow-soft" : "rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-soft"}
              >
                <p className="font-bold text-midnight">{role.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{role.preset_key || "custom"}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500">{roleSummary(role, t)}</p>
                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                  {translatedVisibilityLabel(roleVisibility(role), t)}
                </span>
              </button>
            ))}
            {!teamRoles.isLoading && !roles.length ? (
              <p className="text-sm text-slate-500">{t("settings.noRoles")}</p>
            ) : null}
          </div>
          {advancedAccessOpen && selectedRole ? (
            <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-4">
                <p className="text-base font-black text-midnight">{t("settings.advancedFor", { name: selectedRole.name })}</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  {t("settings.advancedText")}
                </p>
              </div>
              <div className="space-y-3">
                {accessGroups.map((group) => {
                  const level = groupLevel(selectedRole, group.resources);
                  return (
                    <div key={group.key} className="rounded-3xl bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-bold text-midnight">{t(`settings.accessGroup.${group.key}`)}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{t(`settings.accessGroup.${group.key}.text`)}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {group.resources.map((resource) => permissionResourceLabel(resource, t)).join(" · ")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(["none", "own", "team", "business"] as RolePermission["scope"][]).map((scope) => (
                            <Button
                              key={scope}
                              type="button"
                              variant={level === scope ? "primary" : "secondary"}
                              className="min-h-9 rounded-full px-3 text-xs"
                              onClick={() => applyGroupLevel(group.resources, scope)}
                              isLoading={updatePermissionMutation.isPending}
                            >
                              {translatedVisibilityLabel(scope, t)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <Card id="operations-setup" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.operationsEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.operationsTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t("settings.operationsText")}</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-3 md:grid-cols-3">
              {operationsSetup.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon size={20} />
                      </div>
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">{index + 1}</span>
                    </div>
                    <p className="mt-4 font-black text-midnight">{t(`settings.operations.${item.key}.title`)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{t(`settings.operations.${item.key}.text`)}</p>
                    <span className="mt-4 inline-flex text-sm font-black text-brand-700">{t("settings.openSection")}</span>
                  </Link>
                );
              })}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-midnight">{t("settings.operations.orderTitle")}</p>
              <div className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
                <p>{t("settings.operations.orderStep1")}</p>
                <p>{t("settings.operations.orderStep2")}</p>
                <p>{t("settings.operations.orderStep3")}</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card id="data-tools" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.dataToolsEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.dataToolsTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {t("settings.dataToolsText")}
            </p>
          </div>
          {uploadImportMutation.error || confirmImportMutation.error || exportMutation.error || templateMutation.error || manualSaleMutation.error || manualCatalogMutation.error ? (
            <div className="mb-4">
              <ErrorState message={getApiErrorMessage(uploadImportMutation.error || confirmImportMutation.error || exportMutation.error || templateMutation.error || manualSaleMutation.error || manualCatalogMutation.error)} />
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-bold text-midnight">{t("settings.importTitle")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {t("settings.importText")}
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-[180px_1fr_auto_auto]">
                <Select
                  value={importEntity}
                  onChange={(event) => setImportEntity(event.target.value as ImportEntity)}
                  options={importEntityOptions}
                />
                <Input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => templateMutation.mutate(importEntity)}
                  isLoading={templateMutation.isPending}
                >
                  {t("settings.template")}
                </Button>
                <Button
                  type="button"
                  onClick={() => uploadImportMutation.mutate()}
                  disabled={!importFile}
                  isLoading={uploadImportMutation.isPending}
                >
                  {t("settings.preview")}
                </Button>
              </div>
              {activeImport ? (
                <div className="mt-4 rounded-3xl bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-midnight">{activeImport.original_filename || t("settings.importNumber", { id: activeImport.id })}</p>
                      <p className="mt-1 text-sm text-slate-500">{activeImport.entity_type} · {activeImport.total_rows} {t("settings.rows")} · {activeImport.status}</p>
                    </div>
                    {activeImport.status === "previewed" && !(activeImport.errors_json?.rows || []).length ? (
                      <Button
                        type="button"
                        onClick={() => confirmImportMutation.mutate(activeImport.id)}
                        isLoading={confirmImportMutation.isPending}
                      >
                        {t("settings.confirmImport")}
                      </Button>
                    ) : null}
                  </div>
                  {importSummary ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {[
                        { label: t("settings.importCreated"), value: importSummary.created || 0 },
                        { label: t("settings.importUpdated"), value: importSummary.updated || 0 },
                        { label: t("settings.importSkipped"), value: importSummary.skipped || 0 },
                        { label: t("settings.importErrors"), value: importSummary.errors || 0 },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                          <p className="mt-1 text-lg font-black text-midnight">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {(activeImport.errors_json?.rows || []).length ? (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3">
                      <p className="text-sm font-black text-red-800">{t("settings.importFixFile")}</p>
                      <div className="mt-2 space-y-1">
                        {(activeImport.errors_json?.rows || []).slice(0, 4).map((error, index) => (
                          <p key={`${error.row}-${error.field}-${index}`} className="text-xs font-semibold text-red-700">
                            Row {error.row}, {error.field}: {error.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("settings.mapping")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(activeImport.mapping_json || {}).map(([field, header]) => (
                          <span key={field} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {field} {"<-"} {header}
                          </span>
                        ))}
                        {!Object.keys(activeImport.mapping_json || {}).length ? <span className="text-sm text-slate-500">{t("settings.noMapping")}</span> : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("settings.duplicates")}</p>
                      <p className={activeImport.duplicates_json?.rows?.length ? "mt-2 text-sm font-bold text-amber-700" : "mt-2 text-sm font-bold text-emerald-700"}>
                        {t("settings.duplicatesCount", { count: activeImport.duplicates_json?.rows?.length || 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                    {(activeImport.preview_json?.rows || []).slice(0, 3).map((row, index) => (
                      <div key={index} className="border-b border-slate-100 px-3 py-2 text-xs text-slate-600 last:border-b-0">
                        {Object.entries(row).slice(0, 5).map(([key, value]) => `${key}: ${value || "-"}`).join(" · ")}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">{t("settings.importHistoryEmpty")}</p>
              )}
            </div>
            <div className="rounded-3xl border border-slate-100 p-4">
              <h3 className="font-bold text-midnight">{t("settings.exportTitle")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{t("settings.exportText")}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {(["clients", "leads", "deals", "sales", "catalog"] as const).map((entity) => (
                  <Button
                    key={entity}
                    type="button"
                    variant="secondary"
                    onClick={() => exportMutation.mutate(entity)}
                    isLoading={exportMutation.isPending}
                  >
                    {t("settings.exportEntity", { entity: entityLabel(entity, t) })}
                  </Button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {jobs.slice(0, 5).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setActiveImportId(Number(job.id))}
                    className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm transition hover:bg-slate-100"
                  >
                    <span className="font-bold text-midnight">#{job.id} {job.entity_type}</span>
                    <span className="ml-2 text-slate-500">{job.status} · {job.total_rows} {t("settings.rows")}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <form
              className="rounded-3xl border border-slate-100 bg-white p-4"
              onSubmit={(event) => {
                event.preventDefault();
                manualSaleMutation.mutate();
              }}
            >
              <h3 className="font-bold text-midnight">{t("settings.manualSaleTitle")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{t("settings.manualSaleText")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input label={t("settings.number")} value={manualSaleForm.external_id} onChange={(event) => setManualSaleForm({ ...manualSaleForm, external_id: event.target.value })} />
                <Input label={t("settings.amount")} value={manualSaleForm.amount} onChange={(event) => setManualSaleForm({ ...manualSaleForm, amount: event.target.value })} required />
                <Input label={t("settings.client")} value={manualSaleForm.client_name} onChange={(event) => setManualSaleForm({ ...manualSaleForm, client_name: event.target.value })} />
                <Input label={t("settings.item")} value={manualSaleForm.item_name} onChange={(event) => setManualSaleForm({ ...manualSaleForm, item_name: event.target.value })} />
              </div>
              <div className="mt-4">
                <Button type="submit" isLoading={manualSaleMutation.isPending}>{t("settings.saveSale")}</Button>
              </div>
            </form>
            <form
              className="rounded-3xl border border-slate-100 bg-white p-4"
              onSubmit={(event) => {
                event.preventDefault();
                manualCatalogMutation.mutate();
              }}
            >
              <h3 className="font-bold text-midnight">{t("settings.catalogTitle")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{t("settings.catalogText")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Select
                  label={t("settings.type")}
                  value={manualCatalogForm.item_type}
                  onChange={(event) => setManualCatalogForm({ ...manualCatalogForm, item_type: event.target.value })}
                  options={[
                    { value: "service", label: t("settings.service") },
                    { value: "product", label: t("settings.product") },
                  ]}
                />
                <Input label="SKU" value={manualCatalogForm.sku} onChange={(event) => setManualCatalogForm({ ...manualCatalogForm, sku: event.target.value })} />
                <Input label={t("settings.templateTitle")} value={manualCatalogForm.name} onChange={(event) => setManualCatalogForm({ ...manualCatalogForm, name: event.target.value })} required />
                <Input label={t("settings.price")} value={manualCatalogForm.price_from} onChange={(event) => setManualCatalogForm({ ...manualCatalogForm, price_from: event.target.value })} />
                <Input label={t("settings.durationMinutes")} value={manualCatalogForm.duration_minutes} onChange={(event) => setManualCatalogForm({ ...manualCatalogForm, duration_minutes: event.target.value })} />
                <Input label={t("settings.stock")} value={manualCatalogForm.stock_quantity} onChange={(event) => setManualCatalogForm({ ...manualCatalogForm, stock_quantity: event.target.value })} />
              </div>
              <div className="mt-4">
                <Button type="submit" isLoading={manualCatalogMutation.isPending}>{t("settings.saveCatalogItem")}</Button>
              </div>
            </form>
          </div>
        </CardBody>
      </Card>
      <Card id="lead-forms" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.leadFormsEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.leadFormsTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {t("settings.leadFormsText")}
              </p>
            </div>
            <Button type="button" onClick={() => createLeadFormMutation.mutate()} isLoading={createLeadFormMutation.isPending}>
              {t("settings.createForm")}
            </Button>
          </div>
          {createLeadFormMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(createLeadFormMutation.error)} /></div> : null}
          <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <div className="space-y-3">
              {(leadForms.data || []).map((form) => {
                const publicUrl = `${apiOrigin}/api/public/forms/${form.public_id}/submit/`;
                const embedCode = `<form method="POST" action="${publicUrl}"><input name="full_name" /><input name="phone" /><button>${t("settings.send")}</button></form>`;
                return (
                  <div key={form.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-midnight">{form.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{form.title} · {form.source} · {form.submissions_count || 0} {t("settings.submissions")}</p>
                      </div>
                      <span className={form.is_active ? "rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"}>
                        {form.is_active ? t("settings.active") : t("settings.paused")}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {form.fields.map((field) => (
                        <span key={field.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                          {field.label}{field.is_required ? " *" : ""}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("settings.embedCode")}</p>
                      <code className="mt-2 block break-all text-xs leading-5 text-slate-600">{embedCode}</code>
                    </div>
                  </div>
                );
              })}
              {!leadForms.isLoading && !leadForms.data?.length ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{t("settings.noLeadForms")}</p>
              ) : null}
            </div>
            <div className="rounded-3xl border border-slate-100 p-4">
              <h3 className="font-bold text-midnight">{t("settings.latestSubmissions")}</h3>
              <div className="mt-4 space-y-2">
                {(leadFormSubmissions.data || []).slice(0, 6).map((submission) => (
                  <div key={submission.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-semibold text-midnight">{submission.form_name || `Form #${submission.form}`}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {t("settings.lead")} #{submission.lead || "-"} · {t("settings.client")} #{submission.client || "-"} · {Object.keys(submission.utm_json || {}).join(", ") || "no utm"}
                    </p>
                  </div>
                ))}
                {!leadFormSubmissions.isLoading && !leadFormSubmissions.data?.length ? (
                  <p className="text-sm text-slate-500">{t("settings.noSubmissions")}</p>
                ) : null}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card id="billing" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.currentPlan")}</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">
                {subscription.isLoading ? t("settings.loading") : currentPlan?.name || t("settings.noPlan")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {hasSubscription
                  ? `${formatPrice(currentPlan?.monthly_price, t, locale)} · ${t("settings.status")}: ${subscription.data?.status}`
                  : t("settings.billingNoSubscription")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              {t("settings.paymentsNotConnected")}
            </div>
          </div>
        </CardBody>
      </Card>
      <Card className="mb-5">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.usageEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.usageTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {t("settings.usageText")}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {(entitlements.data || usage.data || []).map((item) => {
              const percent = item.limit ? Math.min(100, Math.round((item.value / item.limit) * 100)) : 0;
              return (
                <div key={item.metric} className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{formatMetric(item.metric, t)}</p>
                  <p className="mt-2 text-2xl font-black text-midnight">
                    {item.value}
                    <span className="text-sm font-semibold text-slate-400"> / {item.limit ?? "∞"}</span>
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-ai-gradient" style={{ width: `${item.limit ? percent : 8}%` }} />
                  </div>
                  {item.is_over_limit ? <p className="mt-2 text-xs font-semibold text-red-600">{t("settings.limitReached")}</p> : null}
                  {"remaining" in item && item.remaining !== null ? <p className="mt-2 text-xs font-semibold text-slate-500">{t("settings.remaining", { count: item.remaining })}</p> : null}
                </div>
              );
            })}
            {!entitlements.isLoading && !usage.isLoading && !entitlements.data?.length && !usage.data?.length ? (
              <p className="text-sm text-slate-500">{t("settings.noUsage")}</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <Card id="custom-fields" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.customFieldsEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">{t("settings.customFieldsTitle")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {t("settings.customFieldsText")}
            </p>
          </div>
          {customFieldMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(customFieldMutation.error)} /></div> : null}
          <form
            className="grid gap-3 lg:grid-cols-[160px_1fr_180px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              customFieldMutation.mutate();
            }}
          >
            <Select
              label={t("settings.entity")}
              value={fieldForm.entity_type}
              onChange={(event) => setFieldForm({ ...fieldForm, entity_type: event.target.value as CrmEntityType })}
              options={[
                { value: "client", label: t("settings.client") },
                { value: "lead", label: t("settings.lead") },
                { value: "deal", label: t("settings.deal") },
                { value: "appointment", label: t("settings.appointment") },
              ]}
            />
            <Input label={t("settings.templateTitle")} value={fieldForm.label} onChange={(event) => setFieldForm({ ...fieldForm, label: event.target.value })} required />
            <Select
              label={t("settings.type")}
              value={fieldForm.field_type}
              onChange={(event) => setFieldForm({ ...fieldForm, field_type: event.target.value as CustomFieldDefinition["field_type"] })}
              options={[
                { value: "text", label: "Text" },
                { value: "textarea", label: "Textarea" },
                { value: "number", label: "Number" },
                { value: "date", label: "Date" },
                { value: "select", label: "Select" },
                { value: "boolean", label: "Boolean" },
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
                { value: "url", label: "URL" },
              ]}
            />
            <Input label={t("settings.options")} placeholder="A, B, C" value={fieldForm.options} onChange={(event) => setFieldForm({ ...fieldForm, options: event.target.value })} />
            <div className="flex items-end">
              <Button type="submit" isLoading={customFieldMutation.isPending}>{t("settings.add")}</Button>
            </div>
          </form>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(customFields.data || []).map((field) => (
              <div key={field.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-bold text-midnight">{field.label}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {field.entity_type} · {field.field_type} · {field.key}
                </p>
              </div>
            ))}
            {!customFields.isLoading && !customFields.data?.length ? (
              <p className="text-sm text-slate-500">{t("settings.noCustomFields")}</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <Card id="automations" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Workflow size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("settings.automationsEyebrow")}</p>
                <h2 className="mt-1 text-2xl font-semibold text-midnight">{t("settings.automationsTitle")}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t("settings.automationsText")}</p>
              </div>
            </div>
            <Link to="/dashboard/automations">
              <Button type="button" variant="secondary">{t("settings.openSection")}</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
      <details id="developer" className="mb-5 scroll-mt-24 rounded-3xl border border-slate-100 bg-white/80 p-4 shadow-soft">
        <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.16em] text-slate-500">
          {t("settings.developerConnections")}
        </summary>
        <div className="mt-4">
          <DevelopersSection />
        </div>
      </details>
      <Card id="business-profile" className="scroll-mt-24">
        <CardBody>
          <BusinessSettingsForm initial={business} onSubmit={(payload) => mutation.mutateAsync(payload)} />
        </CardBody>
      </Card>
    </>
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function formatMetric(metric: string, t: Translate) {
  const labels: Record<string, string> = {
    ai_requests: t("settings.metric.ai_requests"),
    bot_messages: t("settings.metric.bot_messages"),
    users: t("settings.metric.users"),
    bots: t("settings.metric.bots"),
    automations: t("settings.metric.automations"),
    conversations: t("settings.metric.conversations"),
    storage_mb: t("settings.metric.storage_mb"),
  };
  return labels[metric] || metric;
}

function formatPrice(value: string | undefined, t: Translate, locale: string) {
  if (!value) return t("settings.noPrice");
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return t("settings.freePrice");
  return t("settings.monthPrice", { amount: numeric.toLocaleString(locale) });
}

function roleVisibility(role: BusinessRole) {
  const allowedScopes = role.permissions
    .filter((permission) => permission.is_allowed)
    .map((permission) => permission.scope);
  if (allowedScopes.includes("business")) return "business";
  if (allowedScopes.includes("team")) return "team";
  if (allowedScopes.includes("own")) return "own";
  return "none";
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function translatedVisibilityLabel(scope: string, t: Translate) {
  if (scope === "business" || scope === "team" || scope === "own") return t(`settings.visibility.${scope}`);
  return t("settings.noAccess");
}

function translatedVisibilityDescription(scope: string, t: Translate) {
  if (scope === "business" || scope === "team" || scope === "own") return t(`settings.visibility.${scope}.text`);
  return t("settings.noAccessText");
}

function roleSummary(role: BusinessRole, t: Translate) {
  const visibleResources = Array.from(
    new Set(role.permissions.filter((permission) => permission.is_allowed).map((permission) => permission.resource)),
  );
  if (!visibleResources.length) return t("settings.roleSummaryNone");
  const names = visibleResources.slice(0, 4).map((resource) => permissionResourceLabel(resource, t));
  const extra = visibleResources.length > names.length ? ` +${visibleResources.length - names.length}` : "";
  return t("settings.roleSummary", { names: `${names.join(", ")}${extra}` });
}

function entityLabel(entity: string, t: Translate) {
  if (entity === "clients") return t("settings.entity.clients");
  if (entity === "leads") return t("settings.lead");
  if (entity === "deals") return t("settings.deal");
  if (entity === "sales") return t("settings.entity.sales");
  if (entity === "catalog") return t("settings.entity.catalog");
  return entity;
}

function groupLevel(role: BusinessRole, resources: string[]) {
  const permissions = role.permissions.filter((permission) => resources.includes(permission.resource));
  if (!permissions.length || permissions.every((permission) => !permission.is_allowed)) return "none";
  const scopes = permissions.filter((permission) => permission.is_allowed).map((permission) => permission.scope);
  if (scopes.includes("business")) return "business";
  if (scopes.includes("team")) return "team";
  if (scopes.includes("own")) return "own";
  return "none";
}

function riskClass(risk: string) {
  const classes: Record<string, string> = {
    low: "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600",
    medium: "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700",
    high: "rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700",
    critical: "rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700",
  };
  return classes[risk] || classes.low;
}
