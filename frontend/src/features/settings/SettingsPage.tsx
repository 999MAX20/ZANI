import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { billingApi } from "../../api/billing";
import { businessesApi } from "../../api/businesses";
import { getApiErrorMessage } from "../../api/client";
import { customFieldsApi } from "../../api/customFields";
import { importExportApi } from "../../api/importExport";
import { leadFormsApi, leadFormSubmissionsApi } from "../../api/leadForms";
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
import { resourceLabels, scopeLabels } from "../../lib/permissions";
import { useAuth } from "../auth/AuthProvider";
import { DevelopersSection } from "./DevelopersSection";
import type { Business, BusinessMembershipSummary, BusinessRole, CrmEntityType, CustomFieldDefinition, QuickReplyTemplate, RolePermission } from "../../types";

const teamRoleOptions = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
  { value: "marketer", label: "Marketer" },
  { value: "accountant", label: "Accountant" },
  { value: "support", label: "Support" },
  { value: "staff", label: "Staff" },
];

const accessGroups = [
  { key: "sales", label: "Продажи", description: "Заявки, сделки и коммерческая работа.", resources: ["leads", "deals"] },
  { key: "clients", label: "Клиенты", description: "Карточки клиентов и клиентская база.", resources: ["clients"] },
  { key: "chats", label: "Чаты", description: "Диалоги, inbox и ответы клиентам.", resources: ["conversations"] },
  { key: "calendar", label: "Календарь", description: "Записи, расписание и услуги.", resources: ["appointments"] },
  { key: "tasks", label: "Задачи", description: "Задачи, напоминания и follow-up.", resources: ["tasks"] },
  { key: "analytics", label: "Аналитика", description: "Отчеты, команда и показатели бизнеса.", resources: ["analytics"] },
  { key: "settings", label: "Настройки", description: "Бизнес, услуги, ресурсы и график.", resources: ["settings"] },
  { key: "export", label: "Экспорт", description: "Выгрузки и подготовка данных.", resources: ["billing"] },
  { key: "security", label: "Безопасность", description: "Команда, роли и аудит доступа.", resources: ["team", "audit_logs"] },
];

const visibilityOptions = [
  { value: "own", label: "Только своё", description: "Сотрудник видит только назначенные ему объекты." },
  { value: "team", label: "Своя команда", description: "Подходит для тимлида или старшего менеджера." },
  { value: "business", label: "Весь бизнес", description: "Доступ ко всем объектам компании." },
];

const settingsSections = [
  { id: "team-access", label: "Команда" },
  { id: "security-center", label: "Безопасность" },
  { id: "quick-replies", label: "Ответы" },
  { id: "roles", label: "Роли" },
  { id: "data-tools", label: "Импорт" },
  { id: "lead-forms", label: "Формы" },
  { id: "billing", label: "Тариф" },
  { id: "custom-fields", label: "Поля" },
  { id: "business-profile", label: "Бизнес" },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { business, isLoading } = useActiveBusiness();
  const { user } = useAuth();
  const subscription = useQuery({
    queryKey: ["current-subscription"],
    queryFn: billingApi.currentSubscription,
  });
  const usage = useQuery({
    queryKey: ["billing-usage-summary"],
    queryFn: billingApi.usageSummary,
  });
  const entitlements = useQuery({
    queryKey: ["billing-entitlements"],
    queryFn: billingApi.entitlements,
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
    enabled: Boolean(business),
  });
  const teamMembers = useQuery({
    queryKey: ["team-members", business?.id],
    queryFn: teamApi.members,
    enabled: Boolean(business),
  });
  const teamRoles = useQuery({
    queryKey: ["team-roles", business?.id],
    queryFn: teamApi.roles,
    enabled: Boolean(business),
  });
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [advancedAccessOpen, setAdvancedAccessOpen] = useState(false);
  const departments = useQuery({
    queryKey: ["team-departments", business?.id],
    queryFn: teamApi.departments,
    enabled: Boolean(business),
  });
  const [departmentName, setDepartmentName] = useState("");
  const [quickReplyForm, setQuickReplyForm] = useState({
    title: "",
    text: "",
    category: "",
    channel: "all",
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const importJobs = useQuery({
    queryKey: ["import-jobs", business?.id],
    queryFn: importExportApi.importJobs,
    enabled: Boolean(business),
  });
  const leadForms = useQuery({
    queryKey: ["lead-forms", business?.id],
    queryFn: leadFormsApi.list,
    enabled: Boolean(business),
  });
  const leadFormSubmissions = useQuery({
    queryKey: ["lead-form-submissions", business?.id],
    queryFn: leadFormSubmissionsApi.list,
    enabled: Boolean(business),
  });
  const securityRisk = useQuery({
    queryKey: ["security-risk", business?.id],
    queryFn: () => securityApi.riskSummary(business?.id),
    enabled: Boolean(business),
    retry: false,
  });
  const auditLogs = useQuery({
    queryKey: ["security-audit", business?.id],
    queryFn: () => securityApi.audit({ business: business?.id }),
    enabled: Boolean(business),
    retry: false,
  });
  const loginHistory = useQuery({
    queryKey: ["security-login-history", business?.id],
    queryFn: () => securityApi.loginHistory({ business: business?.id }),
    enabled: Boolean(business),
    retry: false,
  });
  const supportGrants = useQuery({
    queryKey: ["security-support-grants", business?.id],
    queryFn: securityApi.supportGrants.list,
    enabled: Boolean(business),
    retry: false,
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
    enabled: Boolean(business),
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
      return importExportApi.uploadClients({ business: business.id, file: importFile });
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
    mutationFn: (entity: "clients" | "leads" | "deals") => {
      if (!business) throw new Error("Business is required.");
      return importExportApi.exportEntity({ business: business.id, entity });
    },
  });
  const createLeadFormMutation = useMutation({
    mutationFn: () => {
      if (!business) throw new Error("Business is required.");
      return leadFormsApi.createTemplate({ business: business.id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead-forms"] }),
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
  const apiOrigin = import.meta.env.VITE_API_URL || window.location.origin;

  function updateMemberRole(memberId: number, roleKey: BusinessMembershipSummary["role"]) {
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

  return (
    <>
      <PageHeader title="Настройки" description="Основные данные бизнеса и контакты для интеграций." />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <Card className="mb-5">
        <CardBody className="p-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {settingsSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-midnight hover:shadow-soft"
              >
                {section.label}
              </a>
            ))}
          </div>
        </CardBody>
      </Card>
      <Card id="team-access" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Team & Access</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">Команда и доступы</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Простые роли для команды: владелец и админ управляют доступом, менеджеры работают с CRM без доступа к billing, integrations и team settings.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              {user?.memberships?.[0]?.role || "role"} · {user?.effective_permissions?.[String(business?.id || "")]?.length || 0} permissions
            </div>
          </div>
          {updateMemberMutation.error || departmentMutation.error ? (
            <div className="mb-4"><ErrorState message={getApiErrorMessage(updateMemberMutation.error || departmentMutation.error)} /></div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-slate-100 p-4">
              <div className="mb-4 flex items-start gap-3 rounded-3xl bg-slate-50 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="font-bold text-midnight">Простая настройка доступа</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Выберите сотрудника, назначьте понятную роль и проверьте область видимости. Новые сотрудники безопасно стартуют как Staff.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <Select
                  label="1. Сотрудник"
                  value={selectedMember?.id ? String(selectedMember.id) : ""}
                  onChange={(event) => setSelectedMemberId(Number(event.target.value))}
                  options={members.map((member) => ({
                    value: String(member.id),
                    label: member.user.full_name || member.user.email,
                  }))}
                />
                <Select
                  label="2. Preset role"
                  value={selectedMember?.role || "staff"}
                  onChange={(event) => selectedMember && updateMemberRole(selectedMember.id, event.target.value as BusinessMembershipSummary["role"])}
                  options={teamRoleOptions}
                />
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">3. Видимость</p>
                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <p className="font-bold text-midnight">{scopeLabels[selectedVisibility] || "Нет доступа"}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{visibilityDescription(selectedVisibility)}</p>
                  </div>
                </div>
              </div>
              {selectedMember ? (
                <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-black text-midnight">{selectedMember.user.full_name || selectedMember.user.email}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedMember.user.email} · {selectedMember.business_role_name || selectedRole?.name || "Staff"}
                      </p>
                    </div>
                    <span className={selectedMember.is_active ? "rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700" : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500"}>
                      {selectedMember.is_active ? "Активен" : "Отключен"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {visibilityOptions.map((option) => (
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
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">Команда появится после добавления сотрудников к бизнесу.</div>
              ) : null}
            </div>
            <div className="rounded-3xl border border-slate-100 p-4">
              <h3 className="text-base font-bold text-midnight">Отделы</h3>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (departmentName.trim()) departmentMutation.mutate();
                }}
              >
                <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Продажи" />
                <Button type="submit" variant="secondary" isLoading={departmentMutation.isPending}>+</Button>
              </form>
              <div className="mt-4 space-y-2">
                {(departments.data || []).map((department) => (
                  <div key={department.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                    <p className="font-semibold text-midnight">{department.name}</p>
                    <p className="text-xs text-slate-500">{department.members_count || 0} members</p>
                  </div>
                ))}
                {!departments.isLoading && !departments.data?.length ? <p className="text-sm text-slate-500">Пока нет отделов.</p> : null}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <DevelopersSection />
      <Card id="security-center" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Security center</p>
                <h2 className="mt-2 text-2xl font-semibold text-midnight">Аудит и контроль доступа</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Владелец видит критичные действия: экспорт, архивирование, роли, support access и входы в аккаунты команды.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-red-50 px-3 py-2">
                  <p className="text-xs font-bold text-red-700">High+</p>
                  <p className="text-xl font-black text-red-800">{(securityRisk.data?.risk_counts.high || 0) + (securityRisk.data?.risk_counts.critical || 0)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-3 py-2">
                  <p className="text-xs font-bold text-amber-700">Failed</p>
                  <p className="text-xl font-black text-amber-800">{securityRisk.data?.failed_logins || 0}</p>
                </div>
                <div className="rounded-2xl bg-brand-50 px-3 py-2">
                  <p className="text-xs font-bold text-brand-700">Support</p>
                  <p className="text-xl font-black text-brand-800">{securityRisk.data?.active_support_grants || 0}</p>
                </div>
              </div>
            </div>
            {securityRisk.error || auditLogs.error || loginHistory.error ? (
              <div className="mb-4 rounded-3xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 text-amber-700" size={20} />
                  <div>
                    <p className="font-bold text-amber-900">Security center скрыт для вашей роли</p>
                    <p className="mt-1 text-sm leading-6 text-amber-800">Нужен доступ `audit_logs.view` или роль owner/admin.</p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-100 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-black text-midnight">Последние risk события</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{auditLogs.data?.length || 0} events</span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {(auditLogs.data || []).slice(0, 8).map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-midnight">{log.action} · {log.entity_type} #{log.entity_id}</p>
                          <p className="mt-1 text-xs text-slate-500">{log.actor_email || "system"} · {new Date(log.created_at).toLocaleString("ru-RU")}</p>
                        </div>
                        <span className={riskClass(log.risk_level)}>{log.risk_level}</span>
                      </div>
                    </div>
                  ))}
                  {!auditLogs.isLoading && !auditLogs.data?.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Аудит-событий пока нет.</p> : null}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <h3 className="font-black text-midnight">Входы</h3>
                  <div className="mt-3 space-y-2">
                    {(loginHistory.data || []).slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-bold text-midnight">{item.email || item.user_email}</p>
                          <p className="text-xs text-slate-500">{item.ip_address || "no ip"} · {new Date(item.created_at).toLocaleString("ru-RU")}</p>
                        </div>
                        <span className={item.status === "success" ? "text-xs font-bold text-green-700" : "text-xs font-bold text-red-700"}>{item.status}</span>
                      </div>
                    ))}
                    {!loginHistory.isLoading && !loginHistory.data?.length ? <p className="text-sm text-slate-500">История входов пока пустая.</p> : null}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <h3 className="font-black text-midnight">Support access</h3>
                  <div className="mt-3 space-y-2">
                    {(supportGrants.data || []).slice(0, 4).map((grant) => (
                      <div key={grant.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-sm font-bold text-midnight">{grant.user_email}</p>
                        <p className="text-xs text-slate-500">{grant.is_active ? "active" : "disabled"} · до {new Date(grant.expires_at).toLocaleString("ru-RU")}</p>
                      </div>
                    ))}
                    {!supportGrants.isLoading && !supportGrants.data?.length ? <p className="text-sm text-slate-500">Активных грантов нет.</p> : null}
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Quick replies</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">Шаблоны быстрых ответов</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Короткие ответы для inbox composer: менеджер выбирает шаблон, текст вставляется в черновик и не отправляется автоматически.
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
            <Input label="Название" value={quickReplyForm.title} onChange={(event) => setQuickReplyForm({ ...quickReplyForm, title: event.target.value })} required />
            <Select
              label="Канал"
              value={quickReplyForm.channel}
              onChange={(event) => setQuickReplyForm({ ...quickReplyForm, channel: event.target.value })}
              options={[
                { value: "all", label: "Все" },
                { value: "website", label: "Website" },
                { value: "telegram", label: "Telegram" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "instagram", label: "Instagram" },
              ]}
            />
            <Input label="Категория" placeholder="Приветствие" value={quickReplyForm.category} onChange={(event) => setQuickReplyForm({ ...quickReplyForm, category: event.target.value })} />
            <Textarea label="Текст" value={quickReplyForm.text} onChange={(event) => setQuickReplyForm({ ...quickReplyForm, text: event.target.value })} required />
            <div className="flex items-end">
              <Button type="submit" isLoading={quickReplyMutation.isPending}>Добавить</Button>
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
                        label="Название"
                        value={quickReplyEditForm.title}
                        onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, title: event.target.value })}
                        required
                      />
                      <Select
                        label="Канал"
                        value={quickReplyEditForm.channel}
                        onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, channel: event.target.value as QuickReplyTemplate["channel"] })}
                        options={[
                          { value: "all", label: "Все" },
                          { value: "website", label: "Website" },
                          { value: "telegram", label: "Telegram" },
                          { value: "whatsapp", label: "WhatsApp" },
                          { value: "instagram", label: "Instagram" },
                          { value: "manual", label: "Manual" },
                        ]}
                      />
                    </div>
                    <Input
                      label="Категория"
                      value={quickReplyEditForm.category}
                      onChange={(event) => setQuickReplyEditForm({ ...quickReplyEditForm, category: event.target.value })}
                    />
                    <Textarea
                      label="Текст"
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
                      Активен в composer
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" isLoading={updateQuickReplyMutation.isPending}>Сохранить</Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingQuickReplyId(null)}>Отмена</Button>
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
                            {template.is_active ? "Активен" : "Отключен"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{template.text}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => startEditingQuickReply(template)}>
                        Редактировать
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
                        {template.is_active ? "Отключить" : "Включить"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => removeQuickReplyMutation.mutate(Number(template.id))}
                        isLoading={removeQuickReplyMutation.isPending}
                      >
                        Удалить
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!quickReplies.isLoading && !quickReplies.data?.length ? (
              <p className="text-sm text-slate-500">Пока нет быстрых ответов. Добавьте приветствие, уточнение или запись на консультацию.</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <Card id="roles" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Roles simple mode</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">Права без сложной матрицы</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                На первом экране показываем бизнес-смысл роли. Технические действия открываются только в advanced mode.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setAdvancedAccessOpen((current) => !current)}>
              <SlidersHorizontal size={17} />
              {advancedAccessOpen ? "Скрыть advanced" : "Открыть advanced"}
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
                <p className="mt-3 text-sm leading-6 text-slate-500">{roleSummary(role)}</p>
                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                  {scopeLabels[roleVisibility(role)] || "Нет доступа"}
                </span>
              </button>
            ))}
            {!teamRoles.isLoading && !roles.length ? (
              <p className="text-sm text-slate-500">Ролевые пресеты появятся после миграции или создания бизнеса.</p>
            ) : null}
          </div>
          {advancedAccessOpen && selectedRole ? (
            <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-4">
                <p className="text-base font-black text-midnight">Advanced: {selectedRole.name}</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Используйте этот блок редко: изменение уровня группы меняет permissions роли для всех сотрудников с этим preset.
                </p>
              </div>
              <div className="space-y-3">
                {accessGroups.map((group) => {
                  const level = groupLevel(selectedRole, group.resources);
                  return (
                    <div key={group.key} className="rounded-3xl bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-bold text-midnight">{group.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{group.description}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {group.resources.map((resource) => resourceLabels[resource] || resource).join(" · ")}
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
                              {scopeLabels[scope]}
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
      <Card id="data-tools" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Import / Export</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">Переезд из Excel, amoCRM или Bitrix24</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Импорт не создаёт данные молча: сначала показываем mapping preview и возможные дубли, затем владелец подтверждает загрузку.
            </p>
          </div>
          {uploadImportMutation.error || confirmImportMutation.error || exportMutation.error ? (
            <div className="mb-4">
              <ErrorState message={getApiErrorMessage(uploadImportMutation.error || confirmImportMutation.error || exportMutation.error)} />
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="font-bold text-midnight">Импорт клиентов</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">CSV/XLSX с колонками full_name, phone, email, source, notes. Дубли показываются до подтверждения.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  onClick={() => uploadImportMutation.mutate()}
                  disabled={!importFile}
                  isLoading={uploadImportMutation.isPending}
                >
                  Preview
                </Button>
              </div>
              {activeImport ? (
                <div className="mt-4 rounded-3xl bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-midnight">{activeImport.original_filename || `Import #${activeImport.id}`}</p>
                      <p className="mt-1 text-sm text-slate-500">{activeImport.total_rows} rows · {activeImport.status}</p>
                    </div>
                    {activeImport.status === "previewed" ? (
                      <Button
                        type="button"
                        onClick={() => confirmImportMutation.mutate(activeImport.id)}
                        isLoading={confirmImportMutation.isPending}
                      >
                        Confirm import
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Mapping</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(activeImport.mapping_json || {}).map(([field, header]) => (
                          <span key={field} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {field} {"<-"} {header}
                          </span>
                        ))}
                        {!Object.keys(activeImport.mapping_json || {}).length ? <span className="text-sm text-slate-500">Mapping не найден.</span> : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Duplicates</p>
                      <p className={activeImport.duplicates_json?.rows?.length ? "mt-2 text-sm font-bold text-amber-700" : "mt-2 text-sm font-bold text-emerald-700"}>
                        {activeImport.duplicates_json?.rows?.length || 0} possible duplicates
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
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">История импорта появится после первой загрузки файла.</p>
              )}
            </div>
            <div className="rounded-3xl border border-slate-100 p-4">
              <h3 className="font-bold text-midnight">Экспорт</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">CSV export проверяет права доступа и пишет audit log.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {(["clients", "leads", "deals"] as const).map((entity) => (
                  <Button
                    key={entity}
                    type="button"
                    variant="secondary"
                    onClick={() => exportMutation.mutate(entity)}
                    isLoading={exportMutation.isPending}
                  >
                    Export {entity}
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
                    <span className="ml-2 text-slate-500">{job.status} · {job.total_rows} rows</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      <Card id="lead-forms" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Lead capture</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">Формы заявок</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Public forms создают клиента и заявку, сохраняют UTM, проверяют дубли и запускают automation lead_created.
              </p>
            </div>
            <Button type="button" onClick={() => createLeadFormMutation.mutate()} isLoading={createLeadFormMutation.isPending}>
              Создать форму
            </Button>
          </div>
          {createLeadFormMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(createLeadFormMutation.error)} /></div> : null}
          <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <div className="space-y-3">
              {(leadForms.data || []).map((form) => {
                const publicUrl = `${apiOrigin}/api/public/forms/${form.public_id}/submit/`;
                const embedCode = `<form method="POST" action="${publicUrl}"><input name="full_name" /><input name="phone" /><button>Send</button></form>`;
                return (
                  <div key={form.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-midnight">{form.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{form.title} · {form.source} · {form.submissions_count || 0} submissions</p>
                      </div>
                      <span className={form.is_active ? "rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500"}>
                        {form.is_active ? "Active" : "Paused"}
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
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Embed code</p>
                      <code className="mt-2 block break-all text-xs leading-5 text-slate-600">{embedCode}</code>
                    </div>
                  </div>
                );
              })}
              {!leadForms.isLoading && !leadForms.data?.length ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Форм пока нет. Создайте первую форму для сайта или лендинга.</p>
              ) : null}
            </div>
            <div className="rounded-3xl border border-slate-100 p-4">
              <h3 className="font-bold text-midnight">Последние отправки</h3>
              <div className="mt-4 space-y-2">
                {(leadFormSubmissions.data || []).slice(0, 6).map((submission) => (
                  <div key={submission.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-semibold text-midnight">{submission.form_name || `Form #${submission.form}`}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Lead #{submission.lead || "-"} · Client #{submission.client || "-"} · {Object.keys(submission.utm_json || {}).join(", ") || "no utm"}
                    </p>
                  </div>
                ))}
                {!leadFormSubmissions.isLoading && !leadFormSubmissions.data?.length ? (
                  <p className="text-sm text-slate-500">Новые заявки с форм появятся здесь.</p>
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
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Текущий тариф</p>
              <h2 className="mt-2 text-2xl font-semibold text-midnight">
                {subscription.isLoading ? "Загрузка..." : currentPlan?.name || "Тариф не назначен"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {hasSubscription
                  ? `${formatPrice(currentPlan?.monthly_price)} · статус: ${subscription.data?.status}`
                  : "Billing foundation подключен, но подписка для бизнеса пока не создана."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Оплата не подключена
            </div>
          </div>
        </CardBody>
      </Card>
      <Card className="mb-5">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Usage</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">Лимиты и использование</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Лимиты проверяются централизованно на backend: пользователи, боты, AI, сообщения, диалоги, автоматизации и storage.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {(entitlements.data || usage.data || []).map((item) => {
              const percent = item.limit ? Math.min(100, Math.round((item.value / item.limit) * 100)) : 0;
              return (
                <div key={item.metric} className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{formatMetric(item.metric)}</p>
                  <p className="mt-2 text-2xl font-black text-midnight">
                    {item.value}
                    <span className="text-sm font-semibold text-slate-400"> / {item.limit ?? "∞"}</span>
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-ai-gradient" style={{ width: `${item.limit ? percent : 8}%` }} />
                  </div>
                  {item.is_over_limit ? <p className="mt-2 text-xs font-semibold text-red-600">Лимит достигнут</p> : null}
                  {"remaining" in item && item.remaining !== null ? <p className="mt-2 text-xs font-semibold text-slate-500">Осталось: {item.remaining}</p> : null}
                </div>
              );
            })}
            {!entitlements.isLoading && !usage.isLoading && !entitlements.data?.length && !usage.data?.length ? (
              <p className="text-sm text-slate-500">Usage counters появятся после AI-запросов, bot messages и conversations.</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
      <Card id="custom-fields" className="mb-5 scroll-mt-24">
        <CardBody>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Custom fields</p>
            <h2 className="mt-2 text-2xl font-semibold text-midnight">Дополнительные поля CRM</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Simple mode: добавьте поле для карточки клиента, заявки, сделки или записи без изменения схемы CRM.
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
              label="Сущность"
              value={fieldForm.entity_type}
              onChange={(event) => setFieldForm({ ...fieldForm, entity_type: event.target.value as CrmEntityType })}
              options={[
                { value: "client", label: "Клиент" },
                { value: "lead", label: "Заявка" },
                { value: "deal", label: "Сделка" },
                { value: "appointment", label: "Запись" },
              ]}
            />
            <Input label="Название" value={fieldForm.label} onChange={(event) => setFieldForm({ ...fieldForm, label: event.target.value })} required />
            <Select
              label="Тип"
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
            <Input label="Варианты" placeholder="A, B, C" value={fieldForm.options} onChange={(event) => setFieldForm({ ...fieldForm, options: event.target.value })} />
            <div className="flex items-end">
              <Button type="submit" isLoading={customFieldMutation.isPending}>Добавить</Button>
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
              <p className="text-sm text-slate-500">Пока нет дополнительных полей. Начните с одного поля для клиента.</p>
            ) : null}
          </div>
        </CardBody>
      </Card>
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

function formatMetric(metric: string) {
  const labels: Record<string, string> = {
    ai_requests: "AI requests",
    bot_messages: "Bot messages",
    users: "Users",
    bots: "Bots",
    automations: "Automations",
    conversations: "Conversations",
    storage_mb: "Storage",
  };
  return labels[metric] || metric;
}

function formatPrice(value?: string) {
  if (!value) return "Цена не указана";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0 ₸/мес";
  return `${numeric.toLocaleString("ru-RU")} ₸/мес`;
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

function visibilityDescription(scope: string) {
  if (scope === "business") return "Роль видит данные всего бизнеса в разрешённых разделах.";
  if (scope === "team") return "Роль ограничена своей командой там, где это поддерживает backend.";
  if (scope === "own") return "Роль работает только со своими объектами и назначениями.";
  return "Роль не получает доступ к рабочим данным.";
}

function roleSummary(role: BusinessRole) {
  const visibleResources = Array.from(
    new Set(role.permissions.filter((permission) => permission.is_allowed).map((permission) => permission.resource)),
  );
  if (!visibleResources.length) return "Роль ничего не видит. Подходит только для временной блокировки.";
  const names = visibleResources.slice(0, 4).map((resource) => resourceLabels[resource] || resource);
  const extra = visibleResources.length > names.length ? ` +${visibleResources.length - names.length}` : "";
  return `Доступ: ${names.join(", ")}${extra}.`;
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
