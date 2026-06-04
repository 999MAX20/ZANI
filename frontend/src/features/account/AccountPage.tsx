import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock3, KeyRound, Languages, Link2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { changePassword, getCurrentUserLoginHistory, updateCurrentUser } from "../../api/auth";
import { getApiErrorMessage } from "../../api/client";
import { notificationsApi } from "../../api/notifications";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/StateViews";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { formatDateTime } from "../../lib/format";
import { useI18n, type Language } from "../../lib/i18n";
import { businessRoleLabel } from "../../lib/permissions";
import { useAuth } from "../auth/AuthProvider";
import type { Notification, NotificationPreference } from "../../types";

const notificationCategories: Array<{ category: Notification["category"]; titleKey: string; descriptionKey: string }> = [
  { category: "sales", titleKey: "settings.notifications.category.sales", descriptionKey: "settings.notifications.category.sales.text" },
  { category: "tasks", titleKey: "settings.notifications.category.tasks", descriptionKey: "settings.notifications.category.tasks.text" },
  { category: "outreach", titleKey: "settings.notifications.category.outreach", descriptionKey: "settings.notifications.category.outreach.text" },
  { category: "ai_alerts", titleKey: "settings.notifications.category.aiAlerts", descriptionKey: "settings.notifications.category.aiAlerts.text" },
  { category: "system", titleKey: "settings.notifications.category.system", descriptionKey: "settings.notifications.category.system.text" },
  { category: "finance", titleKey: "settings.notifications.category.finance", descriptionKey: "settings.notifications.category.finance.text" },
];

export function AccountPage() {
  const { t, language, setLanguage } = useI18n();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const { business } = useActiveBusiness();
  const activeMembership = user?.memberships?.find((membership) => String(membership.business) === String(business?.id) && membership.is_active);
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
  });
  const [preferenceForm, setPreferenceForm] = useState({
    language: user?.preferences?.language || language,
    timezone: user?.preferences?.timezone || "Asia/Almaty",
    start_page: user?.preferences?.start_page || "dashboard",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const notificationPreferences = useQuery({
    queryKey: ["notification-preferences", business?.id, user?.id],
    queryFn: () => notificationsApi.preferences.list({ user: "me" }),
    enabled: Boolean(business?.id && user?.id),
  });
  const loginHistory = useQuery({
    queryKey: ["account-login-history", user?.id],
    queryFn: getCurrentUserLoginHistory,
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    setProfileForm({
      full_name: user?.full_name || "",
      phone: user?.phone || "",
    });
    if (user?.preferences) {
      setPreferenceForm({
        language: user.preferences.language,
        timezone: user.preferences.timezone,
        start_page: user.preferences.start_page,
      });
      if (user.preferences.language !== language) setLanguage(user.preferences.language);
    }
  }, [language, setLanguage, user]);
  const preferenceByCategory = useMemo(
    () => new Map((notificationPreferences.data || []).map((preference) => [preference.category, preference])),
    [notificationPreferences.data],
  );

  const profileMutation = useMutation({
    mutationFn: () => updateCurrentUser({ ...profileForm, preferences: preferenceForm }),
    onSuccess: async () => {
      setProfileSaved(true);
      setLanguage(preferenceForm.language as Language);
      await refreshUser();
      window.setTimeout(() => setProfileSaved(false), 2600);
    },
  });
  const passwordMutation = useMutation({
    mutationFn: () => {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error(t("account.passwordMismatch"));
      }
      return changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
    },
    onSuccess: () => {
      setPasswordSaved(true);
      setPasswordModalOpen(false);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      window.setTimeout(() => setPasswordSaved(false), 2600);
    },
  });
  const notificationPreferenceMutation = useMutation({
    mutationFn: ({ category, enabled }: { category: Notification["category"]; enabled: boolean }) => {
      if (!business || !user) throw new Error(t("account.businessRequired"));
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
      queryClient.invalidateQueries({ queryKey: ["notifications-summary"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white px-5 py-5 shadow-soft sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-midnight text-lg font-black text-white">
            {(user?.full_name || user?.email || "ZA").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">{t("account.eyebrow")}</p>
            <h1 className="mt-1 truncate text-2xl font-black text-midnight md:text-3xl">{user?.full_name || user?.email}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {user?.email} · {activeMembership ? businessRoleLabel(activeMembership.role, t) : user?.role || t("header.role")}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          {business?.name || t("account.noBusiness")}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardBody>
            <SectionHeader icon={UserRound} eyebrow={t("account.profileEyebrow")} title={t("account.profileTitle")} text={t("account.profileText")} />
            {profileMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(profileMutation.error)} /></div> : null}
            {profileSaved ? <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{t("account.saved")}</p> : null}
            {passwordSaved ? <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{t("account.passwordSaved")}</p> : null}
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                profileMutation.mutate();
              }}
            >
              <Input label={t("account.fullName")} value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} />
              <Input label={t("account.phone")} value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
              <Input label="Email" value={user?.email || ""} disabled />
              <div className="flex flex-wrap items-end gap-2">
                <Button type="submit" isLoading={profileMutation.isPending}>{t("account.saveProfile")}</Button>
                <Button type="button" variant="secondary" onClick={() => setPasswordModalOpen(true)}>
                  <KeyRound size={17} />
                  {t("account.changePassword")}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader icon={Languages} eyebrow={t("account.preferencesEyebrow")} title={t("account.preferencesTitle")} text={t("account.preferencesText")} />
            <div className="grid gap-4">
              <Select
                label={t("common.language")}
                value={preferenceForm.language}
                onChange={(event) => setPreferenceForm((current) => ({ ...current, language: event.target.value as Language }))}
                options={[
                  { value: "ru", label: "Русский" },
                  { value: "kk", label: "Қазақша" },
                  { value: "en", label: "English" },
                ]}
              />
              <Input
                label={t("account.timezone")}
                value={preferenceForm.timezone}
                onChange={(event) => setPreferenceForm((current) => ({ ...current, timezone: event.target.value }))}
                placeholder="Asia/Almaty"
              />
              <Select
                label={t("account.startPage")}
                value={preferenceForm.start_page}
                onChange={(event) => setPreferenceForm((current) => ({ ...current, start_page: event.target.value as typeof current.start_page }))}
                options={[
                  { value: "dashboard", label: t("nav.dashboard") },
                  { value: "conversations", label: t("nav.conversations") },
                  { value: "tasks", label: t("nav.tasks") },
                  { value: "calendar", label: t("nav.calendar") },
                  { value: "leads", label: t("nav.leads") },
                ]}
              />
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-black text-midnight">{t("account.businessAccessTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {activeMembership ? t("account.businessAccessText", { role: businessRoleLabel(activeMembership.role, t) }) : t("account.businessAccessEmpty")}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardBody>
            <SectionHeader icon={Link2} eyebrow={t("account.connectedEyebrow")} title={t("account.connectedTitle")} text={t("account.connectedText")} />
            <div className="space-y-2">
              {(user?.social_identities || []).map((identity) => (
                <div key={`${identity.provider}-${identity.email}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-black capitalize text-midnight">{identity.provider}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{identity.email}</p>
                  </div>
                  <span className={identity.email_verified ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600"}>
                    {identity.email_verified ? t("account.verified") : t("account.notVerified")}
                  </span>
                </div>
              ))}
              {!user?.social_identities?.length ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">{t("account.noConnectedAccounts")}</p>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader icon={Clock3} eyebrow={t("account.loginHistoryEyebrow")} title={t("account.loginHistoryTitle")} text={t("account.loginHistoryText")} />
            {loginHistory.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(loginHistory.error)} /></div> : null}
            <div className="space-y-2">
              {(loginHistory.data || []).slice(0, 5).map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-midnight">{formatDateTime(item.created_at)}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{item.ip_address || t("account.noIp")} · {item.user_agent || t("account.noDevice")}</p>
                  </div>
                  <span className={item.status === "success" ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"}>
                    {t(`status.${item.status}`)}
                  </span>
                </div>
              ))}
              {!loginHistory.isLoading && !loginHistory.data?.length ? (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">{t("account.noLoginHistory")}</p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card id="notifications" className="scroll-mt-24">
        <CardBody>
          <SectionHeader icon={Bell} eyebrow={t("account.notificationsEyebrow")} title={t("account.notificationsTitle")} text={t("account.notificationsText")} />
          {notificationPreferenceMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(notificationPreferenceMutation.error)} /></div> : null}
          {!business?.id ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{t("account.notificationsNoBusiness")}</p>
          ) : (
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
          )}
        </CardBody>
      </Card>

      <Modal
        title={t("account.changePassword")}
        open={passwordModalOpen}
        onClose={() => {
          if (passwordMutation.isPending) return;
          setPasswordModalOpen(false);
          setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
        }}
      >
        <div className="rounded-3xl bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <KeyRound size={21} />
            </div>
            <div>
              <p className="text-sm font-black text-midnight">{t("account.securityTitle")}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{t("account.securityText")}</p>
            </div>
          </div>
          {passwordMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(passwordMutation.error)} /></div> : null}
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              passwordMutation.mutate();
            }}
          >
            <Input label={t("account.currentPassword")} type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} required />
            <Input label={t("account.newPassword")} type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))} required />
            <Input label={t("account.confirmPassword")} type="password" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))} required />
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={passwordMutation.isPending} onClick={() => setPasswordModalOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" isLoading={passwordMutation.isPending}>{t("account.changePassword")}</Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
  text,
}: {
  icon: typeof UserRound;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon size={21} />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black text-midnight">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{text}</p>
      </div>
    </div>
  );
}
