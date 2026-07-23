import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarCheck2,
  CalendarClock,
  Copy,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import { billingApi } from "../../api/billing";
import { appointmentMessageSettingsApi } from "../../api/appointments";
import { businessesApi } from "../../api/businesses";
import { getApiErrorMessage } from "../../api/client";
import { customFieldsApi } from "../../api/customFields";
import { notificationsApi } from "../../api/notifications";
import { quickRepliesApi } from "../../api/quickReplies";
import { securityApi } from "../../api/security";
import { teamApi } from "../../api/team";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { BusinessSettingsForm } from "../../components/forms/BusinessSettingsForm";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { Textarea } from "../../components/ui/Textarea";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { hasPermission, permissionResourceLabel } from "../../lib/permissions";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../auth/AuthProvider";
import type {
  AppointmentMessageSetting,
  Business,
  BusinessInvitation,
  BusinessMembershipSummary,
  CrmEntityType,
  CustomFieldDefinition,
  Id,
  Notification,
  NotificationPreference,
  QuickReplyTemplate,
  RolePermission,
} from "../../types";
import { SettingsNavigation } from "./components/SettingsNavigation";
import { useSettingsSectionNavigation } from "./hooks/useSettingsSectionNavigation";
import { BillingSection } from "./sections/BillingSection";
import { UsageSection } from "./sections/UsageSection";
import {
  accessGroups,
  appointmentChannelOptions,
  appointmentScenarioLabels,
  notificationCategories,
  roleGuideKeys,
  settingsGroupOrder,
  settingsSectionGroupFallback,
  settingsSections,
  teamRoleOptions,
  visibilityOptions,
} from "./settingsConfig";
import {
  auditEventTitle,
  customFieldSummary,
  entityLabel,
  formatMetric,
  formatPrice,
  groupLevel,
  loginStatusLabel,
  parseRoleList,
  riskClass,
  riskLabel,
  roleSummary,
  roleVisibility,
  slugify,
  translatedVisibilityDescription,
  translatedVisibilityLabel,
} from "./settingsUtils";

export function SettingsPage() {
  const { t, language } = useI18n();
  const confirmAction = useActionConfirm();
  const queryClient = useQueryClient();
  const { business, isLoading } = useActiveBusiness();
  const { user } = useAuth();
  const canViewBilling = hasPermission(user, business?.id, "billing", "view");
  const canManageBilling = hasPermission(
    user,
    business?.id,
    "billing",
    "manage",
  );
  const canViewTeam = hasPermission(user, business?.id, "team", "view");
  const canManageTeam = hasPermission(user, business?.id, "team", "manage");
  const canViewAudit = hasPermission(user, business?.id, "audit_logs", "view");
  const canManageSettings = hasPermission(
    user,
    business?.id,
    "settings",
    "update",
  );
  const canViewNotifications = hasPermission(
    user,
    business?.id,
    "notifications",
    "view",
  );
  const canManageConversations = hasPermission(
    user,
    business?.id,
    "conversations",
    "manage",
  );

  async function confirmDelete(label: string) {
    const result = await confirmAction({
      title: t("settings.delete"),
      description: label
        ? `${t("settings.delete")}: ${label}`
        : t("settings.delete"),
      confirmLabel: t("settings.delete"),
      variant: "danger",
    });
    return result.confirmed;
  }
  const allowedSettingsSections = useMemo(
    () =>
      settingsSections.filter((section) => {
        if (
          section.id === "business-profile" ||
          section.id === "appointment-messages" ||
          section.id === "custom-fields"
        )
          return canManageSettings;
        if (section.id === "team-access") return canViewTeam;
        if (section.id === "roles") return canManageTeam;
        if (section.id === "security-center") return canViewAudit;
        if (section.id === "notification-preferences")
          return canViewNotifications;
        if (section.id === "quick-replies") return canManageConversations;
        if (section.id === "billing" || section.id === "usage")
          return canViewBilling;
        return hasPermission(
          user,
          business?.id,
          section.resource,
          section.action || "view",
        );
      }),
    [
      business?.id,
      canManageConversations,
      canManageSettings,
      canManageTeam,
      canViewAudit,
      canViewBilling,
      canViewNotifications,
      canViewTeam,
      user,
    ],
  );
  const {
    activeSettingsSection,
    allowedSettingsSectionIds,
    openSettingsGroups,
    setActiveSettingsSection,
    setOpenSettingsGroups,
    settingsSectionClass,
  } = useSettingsSectionNavigation(allowedSettingsSections);
  const subscription = useQuery({
    queryKey: ["current-subscription"],
    queryFn: billingApi.currentSubscription,
    enabled: Boolean(canViewBilling),
  });
  const plans = useQuery({
    queryKey: ["billing-plans"],
    queryFn: billingApi.plans,
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
    view_roles: "",
    edit_roles: "",
  });
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<
    number | null
  >(null);
  const [customFieldEditForm, setCustomFieldEditForm] = useState({
    entity_type: "client" as CrmEntityType,
    label: "",
    key: "",
    field_type: "text" as CustomFieldDefinition["field_type"],
    options: "",
    view_roles: "",
    edit_roles: "",
    is_required: false,
    is_active: true,
    sort_order: 0,
  });
  const customFields = useQuery({
    queryKey: ["custom-fields", business?.id],
    queryFn: () => customFieldsApi.list(),
    enabled: Boolean(
      business &&
      canManageSettings &&
      allowedSettingsSectionIds.has("custom-fields"),
    ),
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
    delivery_channel: "whatsapp" as
      "email" | "whatsapp" | "telegram" | "manual",
  });
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [advancedAccessOpen, setAdvancedAccessOpen] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const [lastCreatedInvite, setLastCreatedInvite] =
    useState<BusinessInvitation | null>(null);
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
  const [appointmentMessageDrafts, setAppointmentMessageDrafts] = useState<
    Record<number, Partial<AppointmentMessageSetting>>
  >({});
  const [billingSettingsForm, setBillingSettingsForm] = useState({
    billing_email: "",
    payment_method: "",
    invoice_name: "",
    invoice_tax_id: "",
    invoice_address: "",
  });
  const [selectedPlanId, setSelectedPlanId] = useState("");
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
  const appointmentMessageSettings = useQuery({
    queryKey: ["appointment-message-settings", business?.id],
    queryFn: () =>
      appointmentMessageSettingsApi.list({ business: business?.id }),
    enabled: Boolean(business?.id && canManageSettings),
  });
  const notificationPreferences = useQuery({
    queryKey: ["notification-preferences", business?.id, user?.id],
    queryFn: () => notificationsApi.preferences.list({ user: "me" }),
    enabled: Boolean(business?.id && user?.id),
  });
  const preferenceByCategory = useMemo(
    () =>
      new Map(
        (notificationPreferences.data || []).map((preference) => [
          preference.category,
          preference,
        ]),
      ),
    [notificationPreferences.data],
  );
  useEffect(() => {
    const current = subscription.data;
    if (!current) return;
    const details = current.invoice_details_json || {};
    setBillingSettingsForm({
      billing_email: current.billing_email || business?.invoice_email || "",
      payment_method: current.payment_method || "",
      invoice_name: String(details.name || business?.legal_name || ""),
      invoice_tax_id: String(details.tax_id || business?.tax_id || ""),
      invoice_address: String(details.address || business?.address || ""),
    });
    setSelectedPlanId(
      current.requested_plan
        ? String(current.requested_plan)
        : current.plan?.id
          ? String(current.plan.id)
          : "",
    );
  }, [
    business?.address,
    business?.invoice_email,
    business?.legal_name,
    business?.tax_id,
    subscription.data,
  ]);

  const [editingQuickReplyId, setEditingQuickReplyId] = useState<number | null>(
    null,
  );
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
    enabled: Boolean(business && canManageConversations),
  });
  const notificationPreferenceMutation = useMutation({
    mutationFn: ({
      category,
      enabled,
    }: {
      category: Notification["category"];
      enabled: boolean;
    }) => {
      if (!business || !user) throw new Error(t("account.businessRequired"));
      const existing = (notificationPreferences.data || []).find(
        (preference) => preference.category === category,
      );
      const payload: Partial<NotificationPreference> = {
        business: business.id,
        user: user.id,
        category,
        in_app_enabled: enabled,
      };
      if (existing)
        return notificationsApi.preferences.update({
          id: existing.id,
          payload,
        });
      return notificationsApi.preferences.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });
  const mutation = useMutation({
    mutationFn: (payload: Partial<Business>) =>
      business
        ? businessesApi.update({ id: business.id, payload })
        : businessesApi.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["businesses"] }),
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
        permissions_json: {
          view_roles: parseRoleList(fieldForm.view_roles),
          edit_roles: parseRoleList(fieldForm.edit_roles),
        },
        is_required: false,
        is_active: true,
        sort_order: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      setFieldForm({
        entity_type: "client",
        label: "",
        key: "",
        field_type: "text",
        options: "",
        view_roles: "",
        edit_roles: "",
      });
    },
  });
  const updateCustomFieldMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: Id;
      payload: Partial<CustomFieldDefinition>;
    }) => customFieldsApi.update({ id, payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      setEditingCustomFieldId(null);
    },
  });
  const removeCustomFieldMutation = useMutation({
    mutationFn: (id: Id) => customFieldsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      setEditingCustomFieldId(null);
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
      setInviteForm({
        email: "",
        phone: "",
        telegram: "",
        full_name: "",
        role: "operator",
        delivery_channel: "whatsapp",
      });
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
    },
  });
  const revokeInvitationMutation = useMutation({
    mutationFn: teamApi.revokeInvitation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] }),
  });
  const departmentMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return teamApi.createDepartment({
        business: business.id,
        name: departmentName,
        description: "",
      });
    },
    onSuccess: () => {
      setDepartmentName("");
      queryClient.invalidateQueries({ queryKey: ["team-departments"] });
    },
  });
  const quickReplyMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      if (!canManageConversations)
        throw new Error(
          t("permissions.forbidden", {
            action: t("permissions.action.manage"),
            resource: t("permissions.resource.conversations"),
          }),
        );
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
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<QuickReplyTemplate>;
    }) => {
      if (!canManageConversations)
        throw new Error(
          t("permissions.forbidden", {
            action: t("permissions.action.manage"),
            resource: t("permissions.resource.conversations"),
          }),
        );
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
    mutationFn: (id: number) => {
      if (!canManageConversations)
        throw new Error(
          t("permissions.forbidden", {
            action: t("permissions.action.manage"),
            resource: t("permissions.resource.conversations"),
          }),
        );
      return quickRepliesApi.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-replies"] });
      if (editingQuickReplyId) setEditingQuickReplyId(null);
    },
  });
  const appointmentMessageMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<AppointmentMessageSetting>;
    }) => appointmentMessageSettingsApi.update({ id, payload }),
    onSuccess: () => {
      setAppointmentMessageDrafts({});
      queryClient.invalidateQueries({
        queryKey: ["appointment-message-settings"],
      });
    },
  });
  const billingSettingsMutation = useMutation({
    mutationFn: () =>
      billingApi.updateSettings({
        billing_email: billingSettingsForm.billing_email,
        payment_method: billingSettingsForm.payment_method,
        invoice_details_json: {
          name: billingSettingsForm.invoice_name,
          tax_id: billingSettingsForm.invoice_tax_id,
          address: billingSettingsForm.invoice_address,
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["current-subscription"] }),
  });
  const planChangeMutation = useMutation({
    mutationFn: (plan: Id) => billingApi.requestPlanChange(plan),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["current-subscription"] }),
  });
  const billingStatusMutation = useMutation({
    mutationFn: (action: "pause" | "resume" | "cancel") => billingApi[action](),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["current-subscription"] }),
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

  function startEditingCustomField(field: CustomFieldDefinition) {
    setEditingCustomFieldId(Number(field.id));
    setCustomFieldEditForm({
      entity_type: field.entity_type,
      label: field.label,
      key: field.key,
      field_type: field.field_type,
      options: Array.isArray(field.options_json?.options)
        ? (field.options_json.options as string[]).join(", ")
        : "",
      view_roles: Array.isArray(field.permissions_json?.view_roles)
        ? field.permissions_json.view_roles.join(", ")
        : "",
      edit_roles: Array.isArray(field.permissions_json?.edit_roles)
        ? field.permissions_json.edit_roles.join(", ")
        : "",
      is_required: field.is_required,
      is_active: field.is_active,
      sort_order: field.sort_order,
    });
  }

  function customFieldPayloadFromEdit(): Partial<CustomFieldDefinition> {
    return {
      entity_type: customFieldEditForm.entity_type,
      label: customFieldEditForm.label,
      key: customFieldEditForm.key || slugify(customFieldEditForm.label),
      field_type: customFieldEditForm.field_type,
      options_json: {
        options: customFieldEditForm.options
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
      permissions_json: {
        view_roles: parseRoleList(customFieldEditForm.view_roles),
        edit_roles: parseRoleList(customFieldEditForm.edit_roles),
      },
      is_required: customFieldEditForm.is_required,
      is_active: customFieldEditForm.is_active,
      sort_order: Number(customFieldEditForm.sort_order || 0),
    };
  }

  if (isLoading) return <LoadingState />;

  const currentPlan = subscription.data?.plan;
  const hasSubscription = Boolean(subscription.data && currentPlan);
  const members = teamMembers.data || [];
  const roles = teamRoles.data || [];
  const selectedMember =
    members.find((member) => Number(member.id) === selectedMemberId) ||
    members[0];
  const selectedRole =
    roles.find((role) => Number(role.id) === selectedRoleId) ||
    roles.find(
      (role) => Number(role.id) === Number(selectedMember?.business_role),
    ) ||
    roles.find((role) => role.preset_key === selectedMember?.role) ||
    roles.find((role) => role.preset_key === "staff") ||
    roles[0];
  const selectedVisibility = selectedRole
    ? roleVisibility(selectedRole)
    : "none";
  const translatedTeamRoleOptions = teamRoleOptions.map((option) => ({
    ...option,
    label: t(`settings.role.${option.value}`),
  }));
  const editableTeamRoleOptions = translatedTeamRoleOptions.filter(
    (option) => option.value !== "owner",
  );
  const roleDescription = (role: string) =>
    t(`settings.roleDescription.${role}`);
  const translatedVisibilityOptions = visibilityOptions.map((option) => ({
    ...option,
    label: t(`settings.visibility.${option.value}`),
    description: t(`settings.visibility.${option.value}.text`),
  }));
  const translatedSettingsSections = allowedSettingsSections.map((section) => ({
    ...section,
    label: t(`settings.section.${section.id}`),
    group:
      section.group || settingsSectionGroupFallback[section.id] || "advanced",
  }));
  const translatedSettingsGroups = settingsGroupOrder
    .map((groupKey) => ({
      key: groupKey,
      label: t(`settings.group.${groupKey}`),
      sections: translatedSettingsSections.filter(
        (section) => section.group === groupKey,
      ),
    }))
    .filter((item) => item.sections.length);
  const quickReplyChannelOptions = [
    { value: "all", label: t("settings.channel.all") },
    { value: "website", label: t("settings.channel.website") },
    { value: "telegram", label: "Telegram" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "instagram", label: "Instagram" },
    { value: "manual", label: t("settings.channel.manual") },
  ];
  const locale =
    language === "kk" ? "kk-KZ" : language === "en" ? "en-US" : "ru-RU";
  const appointmentMessages = appointmentMessageSettings.data || [];
  const appointmentMessageValue = <K extends keyof AppointmentMessageSetting>(
    setting: AppointmentMessageSetting,
    key: K,
  ): AppointmentMessageSetting[K] => {
    return (
      (appointmentMessageDrafts[Number(setting.id)]?.[key] as
        AppointmentMessageSetting[K] | undefined) ?? setting[key]
    );
  };
  function updateMemberRole(
    memberId: number,
    roleKey: BusinessMembershipSummary["role"],
  ) {
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

  function applyGroupLevel(
    groupResources: string[],
    level: RolePermission["scope"],
  ) {
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

  function inviteShareUrl(invitation: {
    invite_path: string;
    email: string;
    phone?: string;
    telegram?: string;
    delivery_channel?: string;
  }) {
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

  async function copyInvitation(invitation: {
    id: number;
    invite_path: string;
  }) {
    await navigator.clipboard?.writeText(inviteMessage(invitation.invite_path));
    setCopiedInviteId(invitation.id);
    window.setTimeout(
      () =>
        setCopiedInviteId((current) =>
          current === invitation.id ? null : current,
        ),
      1800,
    );
  }

  return (
    <>
      <section className="mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-zani-text">
            {t("settings.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-zani-subtle">
            {t("settings.description")}
          </p>
        </div>
      </section>
      {mutation.error ? (
        <div className="mb-4">
          <ErrorState message={getApiErrorMessage(mutation.error)} />
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNavigation
          activeSettingsSection={activeSettingsSection}
          navigationTitle={t("settings.navigationTitle")}
          openSettingsGroups={openSettingsGroups}
          setActiveSettingsSection={setActiveSettingsSection}
          setOpenSettingsGroups={setOpenSettingsGroups}
          translatedSettingsGroups={translatedSettingsGroups}
          translatedSettingsSections={translatedSettingsSections}
        />
        <div className="min-w-0 space-y-5">
          <Card
            id="business-profile"
            className={settingsSectionClass("business-profile")}
          >
            <CardBody>
              <BusinessSettingsForm
                initial={business}
                onSubmit={(payload) => mutation.mutateAsync(payload)}
              />
            </CardBody>
          </Card>
          <Card
            id="appointment-messages"
            className={settingsSectionClass("appointment-messages")}
          >
            <CardBody>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    {t("settings.appointmentMessagesEyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                    {t("settings.appointmentMessagesTitle")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                    {t("settings.appointmentMessagesText")}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <CalendarCheck2 size={22} />
                </div>
              </div>
              {appointmentMessageMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(
                      appointmentMessageMutation.error,
                    )}
                  />
                </div>
              ) : null}
              {appointmentMessageSettings.isLoading ? (
                <div className="rounded-card border border-zani-border bg-surface-muted p-5 text-sm font-bold text-zani-subtle">
                  {t("settings.appointmentMessagesLoading")}
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-3">
                  {appointmentMessages.map((setting) => {
                    const meta = appointmentScenarioLabels[setting.scenario];
                    const enabled = Boolean(
                      appointmentMessageValue(setting, "is_enabled"),
                    );
                    const offsetValue = Number(
                      appointmentMessageValue(setting, "offset_minutes"),
                    );
                    const hasDraft = Boolean(
                      appointmentMessageDrafts[Number(setting.id)],
                    );
                    return (
                      <div
                        key={setting.id}
                        className="flex flex-col rounded-card border border-zani-border bg-surface-muted p-4"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-zani-text">
                              {t(meta.titleKey)}
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-5 text-zani-subtle">
                              {t(meta.descriptionKey)}
                            </p>
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
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                              enabled
                                ? "bg-[var(--zani-success-soft)] text-zani-success hover:brightness-95"
                                : "bg-surface-card text-zani-subtle hover:bg-surface-warm"
                            }`}
                          >
                            {enabled
                              ? t("settings.enabled")
                              : t("settings.paused")}
                          </button>
                        </div>
                        <div className="grid gap-3">
                          <Input
                            label={
                              setting.scenario === "thank_you"
                                ? t("settings.appointmentMessages.offsetAfter")
                                : t("settings.appointmentMessages.offsetBefore")
                            }
                            type="number"
                            value={Math.abs(offsetValue)}
                            onChange={(event) => {
                              const raw = Number(event.target.value || 0);
                              const nextValue =
                                setting.scenario === "thank_you"
                                  ? Math.abs(raw)
                                  : -Math.abs(raw);
                              setAppointmentMessageDrafts((current) => ({
                                ...current,
                                [Number(setting.id)]: {
                                  ...current[Number(setting.id)],
                                  offset_minutes: nextValue,
                                },
                              }));
                            }}
                          />
                          <Select
                            label={t(
                              "settings.appointmentMessages.deliveryChannel",
                            )}
                            value={String(
                              appointmentMessageValue(
                                setting,
                                "channel_policy",
                              ),
                            )}
                            onChange={(event) =>
                              setAppointmentMessageDrafts((current) => ({
                                ...current,
                                [Number(setting.id)]: {
                                  ...current[Number(setting.id)],
                                  channel_policy: event.target
                                    .value as AppointmentMessageSetting["channel_policy"],
                                },
                              }))
                            }
                            options={appointmentChannelOptions.map(
                              (option) => ({
                                value: option.value,
                                label: t(option.labelKey),
                              }),
                            )}
                          />
                          <Textarea
                            label={t(
                              "settings.appointmentMessages.templateText",
                            )}
                            rows={6}
                            value={String(
                              appointmentMessageValue(setting, "template_text"),
                            )}
                            onChange={(event) =>
                              setAppointmentMessageDrafts((current) => ({
                                ...current,
                                [Number(setting.id)]: {
                                  ...current[Number(setting.id)],
                                  template_text: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="mt-auto pt-4">
                          <Button
                            className="w-full"
                            variant={hasDraft ? "primary" : "secondary"}
                            disabled={
                              !hasDraft || appointmentMessageMutation.isPending
                            }
                            onClick={() =>
                              appointmentMessageMutation.mutate({
                                id: Number(setting.id),
                                payload:
                                  appointmentMessageDrafts[Number(setting.id)],
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
          <Card
            id="team-access"
            className={settingsSectionClass("team-access")}
          >
            <CardBody>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    {t("settings.teamEyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                    {t("settings.teamTitle")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                    {t("settings.teamText")}
                  </p>
                </div>
                <div className="rounded-2xl border border-zani-border bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-zani-subtle">
                  {user?.memberships?.[0]?.role || "role"} В·{" "}
                  {user?.effective_permissions?.[String(business?.id || "")]
                    ?.length || 0}{" "}
                  {t("settings.permissions")}
                </div>
              </div>
              {updateMemberMutation.error || departmentMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(
                      updateMemberMutation.error || departmentMutation.error,
                    )}
                  />
                </div>
              ) : null}
              {inviteMutation.error || revokeInvitationMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(
                      inviteMutation.error || revokeInvitationMutation.error,
                    )}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-card border border-zani-border bg-surface-card p-4">
                  <div className="mb-4 flex items-start gap-3 rounded-card bg-surface-muted p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-card text-brand-600 shadow-sm">
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <p className="font-bold text-zani-text">
                        {t("settings.accessTitle")}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-zani-subtle">
                        {t("settings.accessText")}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <Select
                      label={t("settings.memberStep")}
                      value={
                        selectedMember?.id ? String(selectedMember.id) : ""
                      }
                      onChange={(event) =>
                        setSelectedMemberId(Number(event.target.value))
                      }
                      disabled={
                        !members.length || updateMemberMutation.isPending
                      }
                      options={members.map((member) => ({
                        value: String(member.id),
                        label: member.user.full_name || member.user.email,
                      }))}
                    />
                    <Select
                      label={t("settings.roleStep")}
                      value={selectedMember?.role || "staff"}
                      onChange={(event) =>
                        selectedMember &&
                        updateMemberRole(
                          selectedMember.id,
                          event.target
                            .value as BusinessMembershipSummary["role"],
                        )
                      }
                      disabled={
                        !selectedMember ||
                        selectedMember.role === "owner" ||
                        updateMemberMutation.isPending
                      }
                      options={
                        selectedMember?.role === "owner"
                          ? translatedTeamRoleOptions.filter(
                              (option) => option.value === "owner",
                            )
                          : editableTeamRoleOptions
                      }
                    />
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zani-subtle">
                        {t("settings.visibilityStep")}
                      </p>
                      <div className="rounded-2xl border border-zani-border bg-surface-card px-4 py-3">
                        <p className="font-bold text-zani-text">
                          {translatedVisibilityLabel(selectedVisibility, t)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zani-subtle">
                          {translatedVisibilityDescription(
                            selectedVisibility,
                            t,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-card border border-zani-border bg-surface-muted p-4">
                    <p className="text-sm font-bold text-zani-text">
                      {t("settings.roleGuideTitle")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zani-subtle">
                      {t("settings.roleGuideText")}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {roleGuideKeys.map((roleKey) => (
                        <button
                          key={roleKey}
                          type="button"
                          className={`rounded-control border p-3 text-left transition hover:bg-surface-card ${
                            inviteForm.role === roleKey
                              ? "border-brand-200 bg-surface-card shadow-sm"
                              : "border-zani-border bg-surface-muted"
                          }`}
                          onClick={() =>
                            setInviteForm((current) => ({
                              ...current,
                              role: roleKey,
                            }))
                          }
                        >
                          <p className="text-sm font-bold text-zani-text">
                            {t(`settings.role.${roleKey}`)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zani-subtle">
                            {roleDescription(roleKey)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedMember ? (
                    <div className="mt-4 rounded-card border border-zani-border bg-surface-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-bold text-zani-text">
                            {selectedMember.user.full_name ||
                              selectedMember.user.email}
                          </p>
                          <p className="mt-1 text-sm text-zani-subtle">
                            {selectedMember.user.email} В·{" "}
                            {translatedTeamRoleOptions.find(
                              (role) => role.value === selectedMember.role,
                            )?.label ||
                              selectedMember.business_role_name ||
                              selectedRole?.name ||
                              t("settings.role.staff")}
                          </p>
                        </div>
                        <span
                          className={
                            selectedMember.is_active
                              ? "rounded-full bg-[var(--zani-success-soft)] px-3 py-1.5 text-xs font-bold text-zani-success"
                              : "rounded-full bg-surface-muted px-3 py-1.5 text-xs font-bold text-zani-subtle"
                          }
                        >
                          {selectedMember.is_active
                            ? t("settings.active")
                            : t("settings.inactive")}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-3">
                        <div className="rounded-2xl border border-zani-border bg-surface-muted p-3 md:col-span-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zani-faint">
                            {t("settings.currentRole")}
                          </p>
                          <p className="mt-1 text-sm font-bold text-zani-text">
                            {translatedTeamRoleOptions.find(
                              (role) => role.value === selectedMember.role,
                            )?.label || selectedMember.role}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-zani-subtle">
                            {roleDescription(selectedMember.role)}
                          </p>
                        </div>
                        {translatedVisibilityOptions.map((option) => (
                          <div
                            key={option.value}
                            className={
                              option.value === selectedVisibility
                                ? "rounded-2xl border border-brand-200 bg-brand-50 p-3"
                                : "rounded-2xl border border-zani-border bg-surface-muted p-3"
                            }
                          >
                            <p className="text-sm font-bold text-zani-text">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-zani-subtle">
                              {option.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!teamMembers.isLoading && !members.length ? (
                    <div className="mt-4 rounded-2xl bg-surface-muted px-4 py-5 text-sm text-zani-subtle">
                      {t("settings.teamEmpty")}
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-card border border-brand-100 bg-brand-50 p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-card text-brand-700 shadow-sm">
                        <Send size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-zani-text">
                          {t("settings.inviteTitle")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-zani-subtle">
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
                        <Input
                          label={t("settings.loginEmail")}
                          type="email"
                          value={inviteForm.email}
                          onChange={(event) =>
                            setInviteForm({
                              ...inviteForm,
                              email: event.target.value,
                            })
                          }
                          required
                        />
                        <p className="mt-1.5 text-xs leading-5 text-zani-subtle">
                          {t("settings.loginEmailHelp")}
                        </p>
                      </div>
                      <Input
                        label={t("settings.fullName")}
                        value={inviteForm.full_name}
                        onChange={(event) =>
                          setInviteForm({
                            ...inviteForm,
                            full_name: event.target.value,
                          })
                        }
                        placeholder={t("settings.fullNamePlaceholder")}
                      />
                      <Select
                        label={t("settings.role")}
                        value={inviteForm.role}
                        onChange={(event) =>
                          setInviteForm({
                            ...inviteForm,
                            role: event.target
                              .value as BusinessMembershipSummary["role"],
                          })
                        }
                        options={editableTeamRoleOptions}
                      />
                      <div className="rounded-control bg-surface-card px-3 py-2 text-xs leading-5 text-zani-subtle">
                        <span className="font-bold text-zani-text">
                          {
                            translatedTeamRoleOptions.find(
                              (role) => role.value === inviteForm.role,
                            )?.label
                          }
                          :
                        </span>{" "}
                        {roleDescription(inviteForm.role)}
                      </div>
                      <Select
                        label={t("settings.delivery")}
                        value={inviteForm.delivery_channel}
                        onChange={(event) =>
                          setInviteForm({
                            ...inviteForm,
                            delivery_channel: event.target
                              .value as typeof inviteForm.delivery_channel,
                          })
                        }
                        options={[
                          { value: "whatsapp", label: "WhatsApp" },
                          { value: "telegram", label: "Telegram" },
                          { value: "email", label: "Email" },
                          { value: "manual", label: t("settings.copyLink") },
                        ]}
                      />
                      <p className="rounded-control bg-surface-card px-3 py-2 text-xs leading-5 text-zani-subtle lg:col-span-2">
                        {t(
                          `settings.deliveryHelp.${inviteForm.delivery_channel}`,
                        )}
                      </p>
                      {inviteForm.delivery_channel === "whatsapp" ? (
                        <Input
                          label={t("settings.whatsappPhone")}
                          value={inviteForm.phone}
                          onChange={(event) =>
                            setInviteForm({
                              ...inviteForm,
                              phone: event.target.value,
                            })
                          }
                          placeholder="+77015550101"
                          required
                        />
                      ) : null}
                      {inviteForm.delivery_channel === "telegram" ? (
                        <Input
                          label="Telegram"
                          value={inviteForm.telegram}
                          onChange={(event) =>
                            setInviteForm({
                              ...inviteForm,
                              telegram: event.target.value,
                            })
                          }
                          placeholder="@username"
                          required
                        />
                      ) : null}
                      <div className="flex items-end lg:col-span-2">
                        <Button
                          type="submit"
                          className="min-h-[52px] w-full lg:w-auto"
                          isLoading={inviteMutation.isPending}
                        >
                          {t("settings.createInvite")}
                        </Button>
                      </div>
                    </form>
                    {lastCreatedInvite ? (
                      <div className="mt-4 rounded-card border border-[rgba(21,128,61,0.18)] bg-[var(--zani-success-soft)] p-4">
                        <p className="font-semibold text-zani-success">
                          {t("settings.inviteCreatedTitle")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-zani-success">
                          {t("settings.inviteCreatedText", {
                            email: lastCreatedInvite.email,
                            role:
                              translatedTeamRoleOptions.find(
                                (role) => role.value === lastCreatedInvite.role,
                              )?.label || lastCreatedInvite.role,
                          })}
                        </p>
                        <div className="mt-3 grid gap-2 min-[420px]:grid-cols-2">
                          <a
                            href={inviteShareUrl(lastCreatedInvite)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center justify-center rounded-full bg-zani-success px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
                          >
                            {t("settings.sendInviteNow")}
                          </a>
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-11 rounded-full px-4 text-sm"
                            onClick={() => copyInvitation(lastCreatedInvite)}
                          >
                            <Copy size={14} />
                            {copiedInviteId === lastCreatedInvite.id
                              ? t("settings.copied")
                              : t("settings.copy")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-2">
                      {(invitations.data || [])
                        .slice(0, 4)
                        .map((invitation) => (
                          <div
                            key={invitation.id}
                            className="rounded-2xl bg-surface-card px-3 py-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-bold text-zani-text">
                                  {invitation.full_name || invitation.email}
                                </p>
                                <p className="text-xs text-zani-subtle">
                                  {invitation.email} В·{" "}
                                  {translatedTeamRoleOptions.find(
                                    (role) => role.value === invitation.role,
                                  )?.label || invitation.role}{" "}
                                  В· {t(`status.${invitation.status}`)}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap">
                                <a
                                  href={inviteShareUrl(invitation)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-zani-text px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
                                >
                                  {t("settings.send")}
                                </a>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="min-h-11 rounded-full px-4 text-sm"
                                  onClick={() => copyInvitation(invitation)}
                                >
                                  <Copy size={14} />
                                  {copiedInviteId === invitation.id
                                    ? t("settings.copied")
                                    : t("settings.copy")}
                                </Button>
                                {invitation.status === "pending" ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="min-h-11 rounded-full px-4 text-sm"
                                    onClick={() =>
                                      revokeInvitationMutation.mutate(
                                        invitation.id,
                                      )
                                    }
                                    isLoading={
                                      revokeInvitationMutation.isPending
                                    }
                                  >
                                    {t("settings.revoke")}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      {!invitations.isLoading && !invitations.data?.length ? (
                        <p className="text-sm text-zani-subtle">
                          {t("settings.noInvites")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-card border border-zani-border bg-surface-card p-4">
                  <h3 className="text-base font-bold text-zani-text">
                    {t("settings.departments")}
                  </h3>
                  <form
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (departmentName.trim()) departmentMutation.mutate();
                    }}
                  >
                    <Input
                      value={departmentName}
                      onChange={(event) =>
                        setDepartmentName(event.target.value)
                      }
                      placeholder={t("settings.departmentPlaceholder")}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      className="min-h-[48px] px-5"
                      isLoading={departmentMutation.isPending}
                    >
                      +
                    </Button>
                  </form>
                  <div className="mt-4 space-y-2">
                    {(departments.data || []).map((department) => (
                      <div
                        key={department.id}
                        className="rounded-2xl bg-surface-muted px-3 py-2"
                      >
                        <p className="font-semibold text-zani-text">
                          {department.name}
                        </p>
                        <p className="text-xs text-zani-subtle">
                          {department.members_count || 0}{" "}
                          {t("settings.members")}
                        </p>
                      </div>
                    ))}
                    {!departments.isLoading && !departments.data?.length ? (
                      <p className="text-sm text-zani-subtle">
                        {t("settings.noDepartments")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card
            id="security-center"
            className={settingsSectionClass("security-center")}
          >
            <CardBody>
              <div className="mb-4">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zani-danger">
                      {t("settings.securityEyebrow")}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                      {t("settings.securityTitle")}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                      {t("settings.securityText")}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-control bg-[var(--zani-danger-soft)] px-3 py-2">
                      <p className="text-xs font-semibold text-zani-danger">
                        {t("settings.highRisk")}
                      </p>
                      <p className="text-xl font-semibold text-zani-danger">
                        {(securityRisk.data?.risk_counts.high || 0) +
                          (securityRisk.data?.risk_counts.critical || 0)}
                      </p>
                    </div>
                    <div className="rounded-control bg-[var(--zani-warning-soft)] px-3 py-2">
                      <p className="text-xs font-semibold text-zani-warning">
                        {t("settings.failedLogins")}
                      </p>
                      <p className="text-xl font-semibold text-zani-warning">
                        {securityRisk.data?.failed_logins || 0}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-50 px-3 py-2">
                      <p className="text-xs font-bold text-brand-700">
                        {t("settings.support")}
                      </p>
                      <p className="text-xl font-semibold text-brand-800">
                        {securityRisk.data?.active_support_grants || 0}
                      </p>
                    </div>
                  </div>
                </div>
                {securityRisk.error || auditLogs.error || loginHistory.error ? (
                  <div className="mb-4 rounded-card border border-[rgba(151,90,22,0.24)] bg-[var(--zani-warning-soft)] p-4">
                    <div className="flex gap-3">
                      <ShieldAlert
                        className="mt-0.5 text-zani-warning"
                        size={20}
                      />
                      <div>
                        <p className="font-semibold text-zani-warning">
                          {t("settings.securityHidden")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-zani-warning">
                          {t("settings.securityHiddenText")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-card border border-zani-border bg-surface-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-zani-text">
                        {t("settings.riskEvents")}
                      </h3>
                      <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-zani-subtle">
                        {auditLogs.data?.length || 0} {t("settings.events")}
                      </span>
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto">
                      {(auditLogs.data || []).slice(0, 8).map((log) => (
                        <div
                          key={log.id}
                          className="rounded-2xl border border-zani-border bg-surface-muted p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-zani-text">
                                {auditEventTitle(
                                  log.action,
                                  log.entity_type,
                                  t,
                                )}
                              </p>
                              <p className="mt-1 text-xs text-zani-subtle">
                                {log.actor_email || "system"} В·{" "}
                                {new Date(log.created_at).toLocaleString(
                                  locale,
                                )}
                              </p>
                            </div>
                            <span className={riskClass(log.risk_level)}>
                              {riskLabel(log.risk_level, t)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {!auditLogs.isLoading && !auditLogs.data?.length ? (
                        <p className="rounded-2xl bg-surface-muted p-4 text-sm text-zani-subtle">
                          {t("settings.noAuditEvents")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-card border border-zani-border bg-surface-card p-4">
                      <h3 className="font-bold text-zani-text">
                        {t("settings.logins")}
                      </h3>
                      <div className="mt-3 space-y-2">
                        {(loginHistory.data || []).slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-2xl bg-surface-muted px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-bold text-zani-text">
                                {item.email || item.user_email}
                              </p>
                              <p className="text-xs text-zani-subtle">
                                {item.ip_address || t("settings.noIp")} В·{" "}
                                {new Date(item.created_at).toLocaleString(
                                  locale,
                                )}
                              </p>
                            </div>
                            <span
                              className={
                                item.status === "success"
                                  ? "text-xs font-bold text-zani-success"
                                  : "text-xs font-semibold text-zani-danger"
                              }
                            >
                              {loginStatusLabel(item.status, t)}
                            </span>
                          </div>
                        ))}
                        {!loginHistory.isLoading &&
                        !loginHistory.data?.length ? (
                          <p className="text-sm text-zani-subtle">
                            {t("settings.noLoginHistory")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-card border border-zani-border bg-surface-card p-4">
                      <h3 className="font-bold text-zani-text">
                        {t("settings.supportAccess")}
                      </h3>
                      <div className="mt-3 space-y-2">
                        {(supportGrants.data || []).slice(0, 4).map((grant) => (
                          <div
                            key={grant.id}
                            className="rounded-2xl bg-surface-muted px-3 py-2"
                          >
                            <p className="text-sm font-bold text-zani-text">
                              {grant.user_email}
                            </p>
                            <p className="text-xs text-zani-subtle">
                              {grant.is_active
                                ? t("settings.active")
                                : t("settings.inactive")}{" "}
                              В· {t("settings.until")}{" "}
                              {new Date(grant.expires_at).toLocaleString(
                                locale,
                              )}
                            </p>
                          </div>
                        ))}
                        {!supportGrants.isLoading &&
                        !supportGrants.data?.length ? (
                          <p className="text-sm text-zani-subtle">
                            {t("settings.noSupportGrants")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card
            id="notification-preferences"
            className={settingsSectionClass("notification-preferences")}
          >
            <CardBody>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    {t("settings.notificationsEyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                    {t("settings.notificationsTitle")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                    {t("settings.notificationsText")}
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                  <Bell size={22} />
                </div>
              </div>
              {notificationPreferenceMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(
                      notificationPreferenceMutation.error,
                    )}
                  />
                </div>
              ) : null}
              {!business?.id ? (
                <p className="rounded-2xl bg-surface-muted p-4 text-sm font-semibold text-zani-subtle">
                  {t("account.notificationsNoBusiness")}
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {notificationCategories.map((item) => {
                    const preference = preferenceByCategory.get(item.category);
                    const enabled = preference?.in_app_enabled !== false;
                    return (
                      <div
                        key={item.category}
                        className="rounded-card border border-zani-border bg-surface-muted p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-bold text-zani-text">
                              {t(item.titleKey)}
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-5 text-zani-subtle">
                              {t(item.descriptionKey)}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={notificationPreferenceMutation.isPending}
                            onClick={() =>
                              notificationPreferenceMutation.mutate({
                                category: item.category,
                                enabled: !enabled,
                              })
                            }
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                              enabled
                                ? "bg-[var(--zani-success-soft)] text-zani-success hover:brightness-95"
                                : "bg-surface-card text-zani-subtle hover:bg-surface-warm"
                            }`}
                          >
                            {enabled
                              ? t("settings.enabled")
                              : t("settings.disabled")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
          <Card
            id="quick-replies"
            className={settingsSectionClass("quick-replies")}
          >
            <CardBody>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                  {t("settings.quickRepliesEyebrow")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                  {t("settings.quickRepliesTitle")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                  {t("settings.quickRepliesText")}
                </p>
              </div>
              {quickReplyMutation.error ||
              updateQuickReplyMutation.error ||
              removeQuickReplyMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(
                      quickReplyMutation.error ||
                        updateQuickReplyMutation.error ||
                        removeQuickReplyMutation.error,
                    )}
                  />
                </div>
              ) : null}
              <form
                className="grid gap-3 lg:grid-cols-[180px_150px_180px_minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  quickReplyMutation.mutate();
                }}
              >
                <Input
                  label={t("settings.templateTitle")}
                  value={quickReplyForm.title}
                  onChange={(event) =>
                    setQuickReplyForm({
                      ...quickReplyForm,
                      title: event.target.value,
                    })
                  }
                  required
                />
                <Select
                  label={t("settings.channel")}
                  value={quickReplyForm.channel}
                  onChange={(event) =>
                    setQuickReplyForm({
                      ...quickReplyForm,
                      channel: event.target.value,
                    })
                  }
                  options={quickReplyChannelOptions.filter(
                    (option) => option.value !== "manual",
                  )}
                />
                <Input
                  label={t("settings.category")}
                  placeholder={t("settings.categoryPlaceholder")}
                  value={quickReplyForm.category}
                  onChange={(event) =>
                    setQuickReplyForm({
                      ...quickReplyForm,
                      category: event.target.value,
                    })
                  }
                />
                <Textarea
                  label={t("settings.templateText")}
                  value={quickReplyForm.text}
                  onChange={(event) =>
                    setQuickReplyForm({
                      ...quickReplyForm,
                      text: event.target.value,
                    })
                  }
                  required
                />
                <div className="flex items-end">
                  <Button
                    type="submit"
                    isLoading={quickReplyMutation.isPending}
                  >
                    {t("settings.add")}
                  </Button>
                </div>
              </form>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(quickReplies.data || []).map((template) => (
                  <div
                    key={template.id}
                    className="rounded-card border border-zani-border bg-surface-muted p-4"
                  >
                    {editingQuickReplyId === Number(template.id) ? (
                      <form
                        className="space-y-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (editingQuickReplyId) {
                            updateQuickReplyMutation.mutate({
                              id: editingQuickReplyId,
                              payload: quickReplyEditForm,
                            });
                          }
                        }}
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label={t("settings.templateTitle")}
                            value={quickReplyEditForm.title}
                            onChange={(event) =>
                              setQuickReplyEditForm({
                                ...quickReplyEditForm,
                                title: event.target.value,
                              })
                            }
                            required
                          />
                          <Select
                            label={t("settings.channel")}
                            value={quickReplyEditForm.channel}
                            onChange={(event) =>
                              setQuickReplyEditForm({
                                ...quickReplyEditForm,
                                channel: event.target
                                  .value as QuickReplyTemplate["channel"],
                              })
                            }
                            options={quickReplyChannelOptions}
                          />
                        </div>
                        <Input
                          label={t("settings.category")}
                          value={quickReplyEditForm.category}
                          onChange={(event) =>
                            setQuickReplyEditForm({
                              ...quickReplyEditForm,
                              category: event.target.value,
                            })
                          }
                        />
                        <Textarea
                          label={t("settings.templateText")}
                          value={quickReplyEditForm.text}
                          onChange={(event) =>
                            setQuickReplyEditForm({
                              ...quickReplyEditForm,
                              text: event.target.value,
                            })
                          }
                          required
                        />
                        <label className="flex items-center gap-2 text-sm font-semibold text-zani-text">
                          <input
                            type="checkbox"
                            checked={quickReplyEditForm.is_active}
                            onChange={(event) =>
                              setQuickReplyEditForm({
                                ...quickReplyEditForm,
                                is_active: event.target.checked,
                              })
                            }
                          />
                          {t("settings.activeInComposer")}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            isLoading={updateQuickReplyMutation.isPending}
                          >
                            {t("settings.save")}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingQuickReplyId(null)}
                          >
                            {t("settings.cancel")}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-zani-text">
                              {template.title}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-zani-subtle">
                                {template.channel}
                              </span>
                              {template.category ? (
                                <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-zani-subtle">
                                  {template.category}
                                </span>
                              ) : null}
                              <span
                                className={
                                  template.is_active
                                    ? "rounded-full bg-[var(--zani-success-soft)] px-2.5 py-1 text-xs font-bold text-zani-success"
                                    : "rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-zani-subtle"
                                }
                              >
                                {template.is_active
                                  ? t("settings.active")
                                  : t("settings.inactive")}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zani-subtle">
                          {template.text}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => startEditingQuickReply(template)}
                          >
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
                              updateQuickReplyMutation.mutate({
                                id: Number(template.id),
                                payload,
                              });
                            }}
                            isLoading={
                              updateQuickReplyMutation.isPending &&
                              editingQuickReplyId === Number(template.id)
                            }
                          >
                            {template.is_active
                              ? t("settings.disable")
                              : t("settings.enable")}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={async () => {
                              if (await confirmDelete(template.title))
                                removeQuickReplyMutation.mutate(
                                  Number(template.id),
                                );
                            }}
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
                  <p className="text-sm text-zani-subtle">
                    {t("settings.noQuickReplies")}
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
          <Card id="roles" className={settingsSectionClass("roles")}>
            <CardBody>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                    {t("settings.rolesEyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                    {t("settings.rolesTitle")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                    {t("settings.rolesText")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdvancedAccessOpen((current) => !current)}
                >
                  <SlidersHorizontal size={17} />
                  {advancedAccessOpen
                    ? t("settings.hideAdvanced")
                    : t("settings.openAdvanced")}
                </Button>
              </div>
              {updatePermissionMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(updatePermissionMutation.error)}
                  />
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(Number(role.id))}
                    className={
                      Number(selectedRole?.id) === Number(role.id)
                        ? "rounded-card border border-brand-200 bg-brand-50 p-4 text-left shadow-card"
                        : "rounded-card border border-zani-border bg-surface-muted p-4 text-left transition hover:bg-surface-card"
                    }
                  >
                    <p className="font-bold text-zani-text">{role.name}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-zani-faint">
                      {role.preset_key || "custom"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-zani-subtle">
                      {roleSummary(role, t)}
                    </p>
                    <span className="mt-3 inline-flex rounded-full bg-surface-card px-3 py-1 text-xs font-bold text-zani-subtle">
                      {translatedVisibilityLabel(roleVisibility(role), t)}
                    </span>
                  </button>
                ))}
                {!teamRoles.isLoading && !roles.length ? (
                  <p className="text-sm text-zani-subtle">
                    {t("settings.noRoles")}
                  </p>
                ) : null}
              </div>
              {advancedAccessOpen && selectedRole ? (
                <div className="mt-5 rounded-card border border-zani-border bg-surface-muted p-4">
                  <div className="mb-4">
                    <p className="text-base font-bold text-zani-text">
                      {t("settings.advancedFor", { name: selectedRole.name })}
                    </p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-zani-subtle">
                      {t("settings.advancedText")}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {accessGroups.map((group) => {
                      const level = groupLevel(selectedRole, group.resources);
                      return (
                        <div
                          key={group.key}
                          className="rounded-card bg-surface-card p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-bold text-zani-text">
                                {t(`settings.accessGroup.${group.key}`)}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-zani-subtle">
                                {t(`settings.accessGroup.${group.key}.text`)}
                              </p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-zani-faint">
                                {group.resources
                                  .map((resource) =>
                                    permissionResourceLabel(resource, t),
                                  )
                                  .join(" В· ")}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(
                                [
                                  "none",
                                  "own",
                                  "team",
                                  "business",
                                ] as RolePermission["scope"][]
                              ).map((scope) => (
                                <Button
                                  key={scope}
                                  type="button"
                                  variant={
                                    level === scope ? "primary" : "secondary"
                                  }
                                  className="min-h-9 rounded-full px-3 text-xs"
                                  onClick={() =>
                                    applyGroupLevel(group.resources, scope)
                                  }
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
          <BillingSection
            billingSettingsForm={billingSettingsForm}
            canManageBilling={canManageBilling}
            className={settingsSectionClass("billing")}
            currentPlan={currentPlan}
            error={
              billingSettingsMutation.error ||
              planChangeMutation.error ||
              billingStatusMutation.error
            }
            formatPrice={formatPrice}
            hasSubscription={hasSubscription}
            isBillingStatusPending={billingStatusMutation.isPending}
            isPlanChangePending={planChangeMutation.isPending}
            isSavingBillingSettings={billingSettingsMutation.isPending}
            locale={locale}
            onRequestPlanChange={(plan) => planChangeMutation.mutate(plan)}
            onSaveBillingSettings={() => billingSettingsMutation.mutate()}
            onSubscriptionStatusAction={(action) =>
              billingStatusMutation.mutate(action)
            }
            plans={plans.data || []}
            selectedPlanId={selectedPlanId}
            setBillingSettingsForm={setBillingSettingsForm}
            setSelectedPlanId={setSelectedPlanId}
            subscription={subscription.data}
            subscriptionIsLoading={subscription.isLoading}
            t={t}
          />
          <UsageSection
            className={settingsSectionClass("usage")}
            formatMetric={formatMetric}
            isLoading={entitlements.isLoading || usage.isLoading}
            items={entitlements.data || usage.data || []}
            t={t}
          />
          <Card
            id="custom-fields"
            className={settingsSectionClass("custom-fields")}
          >
            <CardBody>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
                  {t("settings.customFieldsEyebrow")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-zani-text">
                  {t("settings.customFieldsTitle")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zani-subtle">
                  {t("settings.customFieldsText")}
                </p>
              </div>
              {customFieldMutation.error ||
              updateCustomFieldMutation.error ||
              removeCustomFieldMutation.error ? (
                <div className="mb-4">
                  <ErrorState
                    message={getApiErrorMessage(
                      customFieldMutation.error ||
                        updateCustomFieldMutation.error ||
                        removeCustomFieldMutation.error,
                    )}
                  />
                </div>
              ) : null}
              <div className="mb-4 rounded-card border border-[rgba(151,90,22,0.24)] bg-[var(--zani-warning-soft)] p-4">
                <p className="font-semibold text-zani-warning">
                  {t("settings.customFieldsGuardTitle")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-zani-warning">
                  {t("settings.customFieldsGuardText")}
                </p>
              </div>
              <form
                className="grid gap-3 lg:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  customFieldMutation.mutate();
                }}
              >
                <Select
                  label={t("settings.entity")}
                  value={fieldForm.entity_type}
                  onChange={(event) =>
                    setFieldForm({
                      ...fieldForm,
                      entity_type: event.target.value as CrmEntityType,
                    })
                  }
                  options={[
                    { value: "client", label: t("settings.client") },
                    { value: "lead", label: t("settings.lead") },
                    { value: "deal", label: t("settings.deal") },
                    { value: "appointment", label: t("settings.appointment") },
                  ]}
                />
                <Input
                  label={t("settings.templateTitle")}
                  value={fieldForm.label}
                  onChange={(event) =>
                    setFieldForm({ ...fieldForm, label: event.target.value })
                  }
                  required
                />
                <Select
                  label={t("settings.type")}
                  value={fieldForm.field_type}
                  onChange={(event) =>
                    setFieldForm({
                      ...fieldForm,
                      field_type: event.target
                        .value as CustomFieldDefinition["field_type"],
                    })
                  }
                  options={[
                    {
                      value: "text",
                      label: t("settings.customFieldType.text"),
                    },
                    {
                      value: "textarea",
                      label: t("settings.customFieldType.textarea"),
                    },
                    {
                      value: "number",
                      label: t("settings.customFieldType.number"),
                    },
                    {
                      value: "date",
                      label: t("settings.customFieldType.date"),
                    },
                    {
                      value: "select",
                      label: t("settings.customFieldType.select"),
                    },
                    {
                      value: "boolean",
                      label: t("settings.customFieldType.boolean"),
                    },
                    {
                      value: "phone",
                      label: t("settings.customFieldType.phone"),
                    },
                    { value: "email", label: "Email" },
                    { value: "url", label: t("settings.customFieldType.url") },
                  ]}
                />
                <Input
                  label={t("settings.options")}
                  placeholder="A, B, C"
                  value={fieldForm.options}
                  onChange={(event) =>
                    setFieldForm({ ...fieldForm, options: event.target.value })
                  }
                />
                <Input
                  label="View roles"
                  placeholder="owner, admin, manager"
                  value={fieldForm.view_roles}
                  onChange={(event) =>
                    setFieldForm({
                      ...fieldForm,
                      view_roles: event.target.value,
                    })
                  }
                />
                <Input
                  label="Edit roles"
                  placeholder="owner, admin"
                  value={fieldForm.edit_roles}
                  onChange={(event) =>
                    setFieldForm({
                      ...fieldForm,
                      edit_roles: event.target.value,
                    })
                  }
                />
                <div className="flex items-end">
                  <Button
                    type="submit"
                    isLoading={customFieldMutation.isPending}
                  >
                    {t("settings.add")}
                  </Button>
                </div>
              </form>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {(customFields.data || []).map((field) => (
                  <div
                    key={field.id}
                    className="rounded-card border border-zani-border bg-surface-muted p-4"
                  >
                    {editingCustomFieldId === Number(field.id) ? (
                      <form
                        className="grid gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          updateCustomFieldMutation.mutate({
                            id: Number(field.id),
                            payload: customFieldPayloadFromEdit(),
                          });
                        }}
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Select
                            label={t("settings.entity")}
                            value={customFieldEditForm.entity_type}
                            onChange={(event) =>
                              setCustomFieldEditForm({
                                ...customFieldEditForm,
                                entity_type: event.target
                                  .value as CrmEntityType,
                              })
                            }
                            options={[
                              { value: "client", label: t("settings.client") },
                              { value: "lead", label: t("settings.lead") },
                              { value: "deal", label: t("settings.deal") },
                              {
                                value: "appointment",
                                label: t("settings.appointment"),
                              },
                            ]}
                          />
                          <Select
                            label={t("settings.type")}
                            value={customFieldEditForm.field_type}
                            onChange={(event) =>
                              setCustomFieldEditForm({
                                ...customFieldEditForm,
                                field_type: event.target
                                  .value as CustomFieldDefinition["field_type"],
                              })
                            }
                            options={[
                              {
                                value: "text",
                                label: t("settings.customFieldType.text"),
                              },
                              {
                                value: "textarea",
                                label: t("settings.customFieldType.textarea"),
                              },
                              {
                                value: "number",
                                label: t("settings.customFieldType.number"),
                              },
                              { value: "money", label: "Money" },
                              {
                                value: "date",
                                label: t("settings.customFieldType.date"),
                              },
                              { value: "datetime", label: "Datetime" },
                              {
                                value: "select",
                                label: t("settings.customFieldType.select"),
                              },
                              { value: "multiselect", label: "Multiselect" },
                              {
                                value: "boolean",
                                label: t("settings.customFieldType.boolean"),
                              },
                              {
                                value: "phone",
                                label: t("settings.customFieldType.phone"),
                              },
                              { value: "email", label: "Email" },
                              {
                                value: "url",
                                label: t("settings.customFieldType.url"),
                              },
                            ]}
                          />
                        </div>
                        <Input
                          label={t("settings.templateTitle")}
                          value={customFieldEditForm.label}
                          onChange={(event) =>
                            setCustomFieldEditForm({
                              ...customFieldEditForm,
                              label: event.target.value,
                            })
                          }
                          required
                        />
                        <Input
                          label="Key"
                          value={customFieldEditForm.key}
                          onChange={(event) =>
                            setCustomFieldEditForm({
                              ...customFieldEditForm,
                              key: event.target.value,
                            })
                          }
                        />
                        <Input
                          label={t("settings.options")}
                          placeholder="A, B, C"
                          value={customFieldEditForm.options}
                          onChange={(event) =>
                            setCustomFieldEditForm({
                              ...customFieldEditForm,
                              options: event.target.value,
                            })
                          }
                        />
                        <Input
                          label="View roles"
                          placeholder="owner, admin, manager"
                          value={customFieldEditForm.view_roles}
                          onChange={(event) =>
                            setCustomFieldEditForm({
                              ...customFieldEditForm,
                              view_roles: event.target.value,
                            })
                          }
                        />
                        <Input
                          label="Edit roles"
                          placeholder="owner, admin"
                          value={customFieldEditForm.edit_roles}
                          onChange={(event) =>
                            setCustomFieldEditForm({
                              ...customFieldEditForm,
                              edit_roles: event.target.value,
                            })
                          }
                        />
                        <Input
                          label="Sort order"
                          type="number"
                          value={customFieldEditForm.sort_order}
                          onChange={(event) =>
                            setCustomFieldEditForm({
                              ...customFieldEditForm,
                              sort_order: Number(event.target.value || 0),
                            })
                          }
                        />
                        <div className="flex flex-wrap gap-4 text-sm font-semibold text-zani-text">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={customFieldEditForm.is_required}
                              onChange={(event) =>
                                setCustomFieldEditForm({
                                  ...customFieldEditForm,
                                  is_required: event.target.checked,
                                })
                              }
                            />
                            {t("settings.customFieldRequired")}
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={customFieldEditForm.is_active}
                              onChange={(event) =>
                                setCustomFieldEditForm({
                                  ...customFieldEditForm,
                                  is_active: event.target.checked,
                                })
                              }
                            />
                            {t("settings.customFieldActive")}
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            isLoading={updateCustomFieldMutation.isPending}
                          >
                            {t("settings.save")}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEditingCustomFieldId(null)}
                          >
                            {t("settings.cancel")}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-zani-text">
                              {field.label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zani-subtle">
                              {customFieldSummary(field, t)}
                            </p>
                          </div>
                          <span
                            className={
                              field.is_active
                                ? "rounded-full bg-[var(--zani-success-soft)] px-2.5 py-1 text-xs font-bold text-zani-success"
                                : "rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-zani-subtle"
                            }
                          >
                            {field.is_active
                              ? t("settings.active")
                              : t("settings.inactive")}
                          </span>
                        </div>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.12em] text-zani-faint">
                            {t("settings.technicalDetails")}
                          </summary>
                          <p className="mt-2 rounded-2xl bg-surface-card px-3 py-2 text-xs font-semibold text-zani-subtle">
                            {field.entity_type} В· {field.field_type} В·{" "}
                            {field.key} В· #{field.sort_order}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-zani-subtle">
                            View:{" "}
                            {Array.isArray(
                              field.permissions_json?.view_roles,
                            ) && field.permissions_json.view_roles.length
                              ? field.permissions_json.view_roles.join(", ")
                              : "all"}{" "}
                            В· Edit:{" "}
                            {Array.isArray(
                              field.permissions_json?.edit_roles,
                            ) && field.permissions_json.edit_roles.length
                              ? field.permissions_json.edit_roles.join(", ")
                              : "all"}
                          </p>
                        </details>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => startEditingCustomField(field)}
                          >
                            {t("settings.edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              updateCustomFieldMutation.mutate({
                                id: Number(field.id),
                                payload: { is_active: !field.is_active },
                              })
                            }
                            isLoading={
                              updateCustomFieldMutation.isPending &&
                              editingCustomFieldId === Number(field.id)
                            }
                          >
                            {field.is_active
                              ? t("settings.disable")
                              : t("settings.enable")}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={async () => {
                              if (await confirmDelete(field.label))
                                removeCustomFieldMutation.mutate(
                                  Number(field.id),
                                );
                            }}
                            isLoading={removeCustomFieldMutation.isPending}
                          >
                            {t("settings.delete")}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {!customFields.isLoading && !customFields.data?.length ? (
                  <p className="text-sm text-zani-subtle">
                    {t("settings.noCustomFields")}
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
