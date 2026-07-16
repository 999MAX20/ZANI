import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionRow } from "../components/ActionRow";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { MetricTile } from "../components/MetricTile";
import { MOBILE_DEVICE } from "../config";
import {
  approveMobileApprovalRequest,
  assignMobileTaskToMeWithKey,
  cancelMobileAppointmentWithKey,
  cancelMobileTaskWithKey,
  confirmMobileAppointmentWithKey,
  completeMobileTaskWithKey,
  createMobileIdempotencyKey,
  getMobileActions,
  getMobileAppointmentDetail,
  getMobileAppointments,
  getMobileBootstrap,
  getMobileClientDetail,
  getMobileClients,
  getMobileConversationDetail,
  getMobileDevices,
  getMobileHome,
  getMobileInbox,
  getMobileLeadDetail,
  getMobileLeads,
  getMobileNotificationPreferences,
  getMobileNotifications,
  getMobileTaskDetail,
  getMobileTasks,
  getMobileToday,
  markMobileNotificationReadWithKey,
  mobileLogout,
  qualifyMobileLeadWithKey,
  rejectMobileApprovalRequest,
  replayQueuedMobileActions,
  replyMobileInboxConversationWithKey,
  rescheduleMobileAppointmentWithKey,
  revokeMobileDevice,
  snoozeMobileTaskWithKey,
  updateMobileNotificationPreference,
} from "../api/mobile";
import { MobileApiError } from "../api/client";
import { enqueueOfflineAction, getOfflineActionQueue, setOfflineActionQueue } from "../offline/actionQueue";
import type { OfflineAction } from "../offline/actionQueue";
import { clearSession, getRefreshToken } from "../storage/session";
import { registerForMobilePush } from "../push/register";
import { translate } from "../i18n/dictionaries";
import type { MobileDeepLinkTarget } from "../navigation/deepLinks";
import type {
  AppLanguage,
  MobileActions,
  MobileAppointmentDetail,
  MobileAppointments,
  MobileBootstrap,
  MobileClientDetail,
  MobileClients,
  MobileConversationDetail,
  MobileDevices,
  MobileHome,
  MobileInbox,
  MobileLeadDetail,
  MobileLeads,
  MobileNotificationPreference,
  MobileNotificationPreferences,
  MobileNotifications,
  MobileTasks,
  MobileTaskDetail,
  MobileToday,
  MobileHomeItem,
} from "../types/mobile";
import type { ZaniTheme } from "../theme/tokens";
import { isAppVersionSupported } from "../version";

type Props = {
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  theme: ZaniTheme;
  onLogout: () => void;
  deepLinkTarget?: MobileDeepLinkTarget | null;
  onDeepLinkHandled?: () => void;
};

type MobileTab = "home" | "today" | "actions" | "inbox" | "leads" | "clients" | "tasks" | "calendar" | "alerts" | "devices";

type DetailState =
  | { type: "client"; data: MobileClientDetail }
  | { type: "lead"; data: MobileLeadDetail }
  | { type: "task"; data: MobileTaskDetail }
  | { type: "appointment"; data: MobileAppointmentDetail }
  | { type: "conversation"; data: MobileConversationDetail };

export function HomeScreen({ language, onLanguageChange, theme, onLogout, deepLinkTarget, onDeepLinkHandled }: Props) {
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [home, setHome] = useState<MobileHome | null>(null);
  const [today, setToday] = useState<MobileToday | null>(null);
  const [actions, setActions] = useState<MobileActions | null>(null);
  const [inbox, setInbox] = useState<MobileInbox | null>(null);
  const [leads, setLeads] = useState<MobileLeads | null>(null);
  const [clients, setClients] = useState<MobileClients | null>(null);
  const [tasks, setTasks] = useState<MobileTasks | null>(null);
  const [appointments, setAppointments] = useState<MobileAppointments | null>(null);
  const [notifications, setNotifications] = useState<MobileNotifications | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<MobileNotificationPreferences | null>(null);
  const [devices, setDevices] = useState<MobileDevices | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>("home");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [processingLeadId, setProcessingLeadId] = useState<number | null>(null);
  const [confirmingAppointmentId, setConfirmingAppointmentId] = useState<number | null>(null);
  const [decidingApprovalId, setDecidingApprovalId] = useState<number | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);
  const [updatingPreferenceCategory, setUpdatingPreferenceCategory] = useState<string | null>(null);
  const [replyingConversationId, setReplyingConversationId] = useState<number | null>(null);
  const [replyConversation, setReplyConversation] = useState<MobileHomeItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  const [offlineConflicts, setOfflineConflicts] = useState(0);
  const [offlineConflictActions, setOfflineConflictActions] = useState<OfflineAction[]>([]);
  const [error, setError] = useState("");
  const pushRegistrationBusinesses = useRef(new Set<number>());
  const t = (key: string) => translate(language, key);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const nextBootstrap = await getMobileBootstrap();
      const nextBusinessId = resolveBusinessId(nextBootstrap);
      const nextHome = await getMobileHome(nextBusinessId);
      setBootstrap(nextBootstrap);
      setSelectedBusinessId(nextBusinessId);
      setHome(nextHome);
      await replayOfflineQueue(nextBusinessId);
      void registerPushForBusiness(nextBusinessId, nextBootstrap);
      if (activeTab !== "home") {
        await loadTab(activeTab, nextBusinessId, isRefresh);
      }
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function logout() {
    const refresh = await getRefreshToken();
    await mobileLogout(refresh);
    await clearSession();
    onLogout();
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!bootstrap) return;
    void loadTab(activeTab, selectedBusinessId || bootstrap.active_business.id);
  }, [activeTab, selectedBusinessId]);

  useEffect(() => {
    if (!bootstrap || !deepLinkTarget) return;
    void handleDeepLinkTarget(deepLinkTarget);
  }, [bootstrap, deepLinkTarget, selectedBusinessId]);

  function resolveBusinessId(nextBootstrap: MobileBootstrap) {
    const fallback = nextBootstrap.active_business.id;
    if (!selectedBusinessId) return fallback;
    return nextBootstrap.businesses.some((business) => business.id === selectedBusinessId) ? selectedBusinessId : fallback;
  }

  function clearBusinessScopedData() {
    setHome(null);
    setToday(null);
    setActions(null);
    setInbox(null);
    setLeads(null);
    setClients(null);
    setTasks(null);
    setAppointments(null);
    setNotifications(null);
    setNotificationPreferences(null);
    setDevices(null);
  }

  async function switchBusiness(businessId: number) {
    if (businessId === selectedBusinessId) return;
    setSelectedBusinessId(businessId);
    setDetail(null);
    clearBusinessScopedData();
    setLoading(true);
    setError("");
    try {
      setHome(await getMobileHome(businessId));
      if (bootstrap) {
        void registerPushForBusiness(businessId, bootstrap);
      }
      if (activeTab !== "home") {
        await loadTab(activeTab, businessId, true);
      }
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  async function loadTab(tab: MobileTab, businessId: number, force = false) {
    if (tab === "today" && (force || !today)) {
      setToday(await getMobileToday(businessId));
    }
    if (tab === "actions" && (force || !actions)) {
      setActions(await getMobileActions(businessId));
    }
    if (tab === "inbox" && (force || !inbox)) {
      setInbox(await getMobileInbox(businessId));
    }
    if (tab === "leads" && (force || !leads)) {
      setLeads(await getMobileLeads(businessId));
    }
    if (tab === "clients" && (force || !clients)) {
      setClients(await getMobileClients(businessId));
    }
    if (tab === "tasks" && (force || !tasks)) {
      setTasks(await getMobileTasks(businessId));
    }
    if (tab === "calendar" && (force || !appointments)) {
      setAppointments(await getMobileAppointments(businessId));
    }
    if (tab === "alerts" && (force || !notifications)) {
      setNotifications(await getMobileNotifications(businessId));
    }
    if (tab === "devices" && (force || !devices)) {
      const [nextDevices, nextPreferences] = await Promise.all([
        getMobileDevices(businessId),
        getMobileNotificationPreferences(businessId)
      ]);
      setDevices(nextDevices);
      setNotificationPreferences(nextPreferences);
    }
  }

  async function replayOfflineQueue(businessId: number) {
    const result = await replayQueuedMobileActions().catch(() => null);
    const queue = await getOfflineActionQueue();
    setOfflineQueueSize(queue.length);
    setOfflineConflictActions(queue.filter((item) => item.conflict));
    setOfflineConflicts(queue.filter((item) => item.conflict).length);
    if (result && result.replayed > 0) {
      const [nextHome, nextToday, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileToday(businessId).catch(() => today),
        getMobileActions(businessId).catch(() => actions)
      ]);
      setHome(nextHome);
      if (nextToday) setToday(nextToday);
      if (nextActions) setActions(nextActions);
    }
  }

  async function queueOfflineWrite(params: {
    businessId: number;
    endpoint: string;
    idempotencyKey: string;
    body: Record<string, unknown>;
    fallbackError: string;
    error: unknown;
  }) {
    if (params.error instanceof MobileApiError) {
      if (params.error.status === 409) {
        setOfflineConflicts((value) => value + 1);
      }
      setError(mobileApiErrorMessage(params.error, t, params.fallbackError));
      return;
    }
    await enqueueOfflineAction({
      businessId: params.businessId,
      endpoint: params.endpoint,
      method: "POST",
      idempotencyKey: params.idempotencyKey,
      body: params.body,
      maxAttempts: 5,
    });
    const queue = await getOfflineActionQueue();
    setOfflineQueueSize(queue.length);
    setOfflineConflictActions(queue.filter((item) => item.conflict));
    setOfflineConflicts(queue.filter((item) => item.conflict).length);
    setError(params.fallbackError);
  }

  async function clearOfflineConflicts() {
    const queue = await getOfflineActionQueue();
    const active = queue.filter((item) => !item.conflict);
    await setOfflineActionQueue(active);
    setOfflineQueueSize(active.length);
    setOfflineConflicts(0);
    setOfflineConflictActions([]);
  }

  async function handleDeepLinkTarget(target: MobileDeepLinkTarget) {
    const tab = target.tab === "alerts" ? "alerts" : target.tab;
    setActiveTab(tab);
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId) return;
    await loadTab(tab, businessId, true);
    if ("id" in target && target.id) {
      if (target.tab === "inbox") {
        await openDetail("conversation", { id: target.id, href: "" });
      } else if (target.tab === "leads") {
        await openDetail("lead", { id: target.id, href: "" });
      } else if (target.tab === "clients") {
        await openDetail("client", { id: target.id, href: "" });
      } else if (target.tab === "tasks") {
        await openDetail("task", { id: target.id, href: "" });
      } else if (target.tab === "calendar") {
        await openDetail("appointment", { id: target.id, href: "" });
      }
    }
    onDeepLinkHandled?.();
  }

  async function revokeDevice(deviceId: number) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId) return;
    await revokeMobileDevice(businessId, deviceId);
    setDevices(await getMobileDevices(businessId));
  }

  async function updatePreference(category: MobileNotificationPreference["category"], payload: Partial<Pick<MobileNotificationPreference, "push_enabled" | "privacy_mode">>) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || updatingPreferenceCategory) return;
    setUpdatingPreferenceCategory(category);
    setError("");
    try {
      setNotificationPreferences(await updateMobileNotificationPreference(businessId, category, payload));
    } catch {
      setError(t("notifications.preferenceError"));
    } finally {
      setUpdatingPreferenceCategory(null);
    }
  }

  async function openDetail(type: DetailState["type"], item: MobileHomeItem) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id || loadingDetail) return;
    setLoadingDetail(true);
    setError("");
    try {
      if (type === "client") {
        setDetail({ type, data: await getMobileClientDetail(businessId, item.id) });
      } else if (type === "lead") {
        setDetail({ type, data: await getMobileLeadDetail(businessId, item.id) });
      } else if (type === "task") {
        setDetail({ type, data: await getMobileTaskDetail(businessId, item.id) });
      } else if (type === "appointment") {
        setDetail({ type, data: await getMobileAppointmentDetail(businessId, item.id) });
      } else {
        setDetail({ type, data: await getMobileConversationDetail(businessId, item.id) });
      }
    } catch {
      setError(t("detail.loadError"));
    } finally {
      setLoadingDetail(false);
    }
  }

  async function completeTaskFromMobile(item: MobileHomeItem) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id || !isCompletableTask(item)) return;
    setCompletingTaskId(item.id);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey("task-complete");
    try {
      await completeMobileTaskWithKey(businessId, item.id, idempotencyKey, item.updated_at);
      const [nextHome, nextTasks, nextToday, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileTasks(businessId),
        getMobileToday(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setTasks(nextTasks);
      setToday(nextToday);
      setActions(nextActions);
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint: `/api/mobile/v1/tasks/${item.id}/complete/`,
        idempotencyKey,
        body: withExpectedUpdatedAt({ business: businessId }, item.updated_at),
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("tasks.completeError")));
    } finally {
      setCompletingTaskId(null);
    }
  }

  function showTaskActions(item: MobileHomeItem) {
    if (!item.id || completingTaskId === item.id || !isCompletableTask(item)) return;
    Alert.alert(t("tasks.actionsTitle"), item.title || t("tab.tasks"), [
      { text: t("approval.cancel"), style: "cancel" },
      { text: t("tasks.assignToMe"), onPress: () => void updateTaskFromMobile(item, "assign") },
      { text: t("tasks.snoozeTomorrow"), onPress: () => void updateTaskFromMobile(item, "snooze") },
      { text: t("tasks.cancel"), style: "destructive", onPress: () => void updateTaskFromMobile(item, "cancel") },
      { text: t("action.complete_task"), onPress: () => void completeTaskFromMobile(item) }
    ]);
  }

  async function updateTaskFromMobile(item: MobileHomeItem, action: "assign" | "snooze" | "cancel") {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id || !isCompletableTask(item)) return;
    setCompletingTaskId(item.id);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey(`task-${action}`);
    const endpoint =
      action === "assign"
        ? `/api/mobile/v1/tasks/${item.id}/assign-to-me/`
        : action === "snooze"
          ? `/api/mobile/v1/tasks/${item.id}/snooze/`
          : `/api/mobile/v1/tasks/${item.id}/cancel/`;
    const snoozedUntil = nextBusinessMorningIso();
    const taskCancelReason = t("tasks.cancelReason");
    const body: Record<string, unknown> =
      action === "assign"
        ? withExpectedUpdatedAt({ business: businessId }, item.updated_at)
        : action === "snooze"
          ? withExpectedUpdatedAt({ business: businessId, snoozed_until: snoozedUntil }, item.updated_at)
          : withExpectedUpdatedAt({ business: businessId, reason: taskCancelReason }, item.updated_at);
    try {
      if (action === "assign") {
        await assignMobileTaskToMeWithKey(businessId, item.id, idempotencyKey, item.updated_at);
      } else if (action === "snooze") {
        await snoozeMobileTaskWithKey(businessId, item.id, snoozedUntil, idempotencyKey, item.updated_at);
      } else {
        await cancelMobileTaskWithKey(businessId, item.id, taskCancelReason, idempotencyKey, item.updated_at);
      }
      const [nextHome, nextTasks, nextToday, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileTasks(businessId),
        getMobileToday(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setTasks(nextTasks);
      setToday(nextToday);
      setActions(nextActions);
      if (detail?.type === "task" && detail.data.task.id === item.id) {
        setDetail({ type: "task", data: await getMobileTaskDetail(businessId, item.id) });
      }
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint,
        idempotencyKey,
        body,
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("tasks.updateError")));
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function processLeadFromMobile(item: MobileHomeItem) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id || !isProcessableLead(item)) return;
    setProcessingLeadId(item.id);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey("lead-qualify");
    try {
      await qualifyMobileLeadWithKey(businessId, item.id, idempotencyKey, item.updated_at);
      const [nextHome, nextLeads, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileLeads(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setLeads(nextLeads);
      setActions(nextActions);
      if (detail?.type === "lead" && detail.data.lead.id === item.id) {
        setDetail({ type: "lead", data: await getMobileLeadDetail(businessId, item.id) });
      }
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint: `/api/mobile/v1/leads/${item.id}/qualify/`,
        idempotencyKey,
        body: withExpectedUpdatedAt({ business: businessId }, item.updated_at),
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("leads.processError")));
    } finally {
      setProcessingLeadId(null);
    }
  }

  async function markNotificationRead(item: { id: number; updated_at?: string }) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id) return;
    const notificationId = item.id;
    setMarkingNotificationId(notificationId);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey("notification-read");
    try {
      await markMobileNotificationReadWithKey(businessId, notificationId, idempotencyKey, item.updated_at);
      const [nextNotifications, nextHome] = await Promise.all([
        getMobileNotifications(businessId),
        getMobileHome(businessId)
      ]);
      setNotifications(nextNotifications);
      setHome(nextHome);
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint: `/api/mobile/v1/notifications/${notificationId}/mark-read/`,
        idempotencyKey,
        body: withExpectedUpdatedAt({ business: businessId }, item.updated_at),
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("alerts.markReadError")));
    } finally {
      setMarkingNotificationId(null);
    }
  }

  async function confirmAppointmentFromMobile(item: MobileHomeItem) {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id || !isConfirmableAppointment(item)) return;
    setConfirmingAppointmentId(item.id);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey("appointment-confirm");
    try {
      await confirmMobileAppointmentWithKey(businessId, item.id, idempotencyKey, item.updated_at);
      const [nextHome, nextToday, nextAppointments, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileToday(businessId),
        getMobileAppointments(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setToday(nextToday);
      setAppointments(nextAppointments);
      setActions(nextActions);
      if (detail?.type === "appointment" && detail.data.appointment.id === item.id) {
        setDetail({ type: "appointment", data: await getMobileAppointmentDetail(businessId, item.id) });
      }
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint: `/api/mobile/v1/appointments/${item.id}/confirm/`,
        idempotencyKey,
        body: withExpectedUpdatedAt({ business: businessId }, item.updated_at),
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("calendar.confirmError")));
    } finally {
      setConfirmingAppointmentId(null);
    }
  }

  function showAppointmentActions(item: MobileHomeItem) {
    if (!item.id || confirmingAppointmentId === item.id) return;
    Alert.alert(t("calendar.actionsTitle"), item.title || t("tab.calendar"), [
      { text: t("approval.cancel"), style: "cancel" },
      ...(isConfirmableAppointment(item) ? [{ text: t("action.confirm_appointment"), onPress: () => void confirmAppointmentFromMobile(item) }] : []),
      { text: t("calendar.rescheduleTomorrow"), onPress: () => void updateAppointmentFromMobile(item, "reschedule") },
      { text: t("calendar.cancel"), style: "destructive", onPress: () => void updateAppointmentFromMobile(item, "cancel") }
    ]);
  }

  async function updateAppointmentFromMobile(item: MobileHomeItem, action: "cancel" | "reschedule") {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id) return;
    setConfirmingAppointmentId(item.id);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey(`appointment-${action}`);
    const endpoint =
      action === "cancel"
        ? `/api/mobile/v1/appointments/${item.id}/cancel/`
        : `/api/mobile/v1/appointments/${item.id}/reschedule/`;
    const nextStartAt = nextAppointmentDayIso(item.start_at);
    const rescheduleReason = t("calendar.rescheduleReason");
    const body: Record<string, unknown> =
      action === "cancel"
        ? withExpectedUpdatedAt({ business: businessId }, item.updated_at)
        : withExpectedUpdatedAt({ business: businessId, start_at: nextStartAt, resource: undefined, reason: rescheduleReason }, item.updated_at);
    try {
      if (action === "cancel") {
        await cancelMobileAppointmentWithKey(businessId, item.id, idempotencyKey, item.updated_at);
      } else {
        await rescheduleMobileAppointmentWithKey(businessId, item.id, nextStartAt, undefined, rescheduleReason, idempotencyKey, item.updated_at);
      }
      const [nextHome, nextToday, nextAppointments, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileToday(businessId),
        getMobileAppointments(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setToday(nextToday);
      setAppointments(nextAppointments);
      setActions(nextActions);
      if (detail?.type === "appointment" && detail.data.appointment.id === item.id) {
        setDetail({ type: "appointment", data: await getMobileAppointmentDetail(businessId, item.id) });
      }
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint,
        idempotencyKey,
        body,
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("calendar.updateError")));
    } finally {
      setConfirmingAppointmentId(null);
    }
  }

  function openReplyComposer(item: MobileHomeItem) {
    if (!item.id || replyingConversationId === item.id) return;
    setReplyConversation(item);
    setReplyText("");
  }

  async function sendConversationReply() {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    const conversationId = replyConversation?.id;
    const text = replyText.trim();
    if (!businessId || !conversationId || !text) return;
    setReplyingConversationId(conversationId);
    setError("");
    const idempotencyKey = createMobileIdempotencyKey("inbox-reply");
    try {
      await replyMobileInboxConversationWithKey(businessId, conversationId, text, idempotencyKey, replyConversation.updated_at);
      const [nextHome, nextInbox, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileInbox(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setInbox(nextInbox);
      setActions(nextActions);
      if (detail?.type === "conversation" && detail.data.conversation.id === conversationId) {
        setDetail({ type: "conversation", data: await getMobileConversationDetail(businessId, conversationId) });
      }
      setReplyConversation(null);
      setReplyText("");
    } catch (caught) {
      await queueOfflineWrite({
        businessId,
        endpoint: `/api/mobile/v1/inbox/${conversationId}/reply/`,
        idempotencyKey,
        body: withExpectedUpdatedAt({ business: businessId, text }, replyConversation.updated_at),
        fallbackError: t("offline.queued"),
        error: caught,
      }).catch(() => setError(t("inbox.replyError")));
    } finally {
      setReplyingConversationId(null);
    }
  }

  function confirmApprovalFromMobile(item: MobileHomeItem) {
    if (!item.id || decidingApprovalId === item.id) return;
    Alert.alert(t("approval.confirmTitle"), item.title || t("action.approve_ai_request"), [
      { text: t("approval.cancel"), style: "cancel" },
      { text: t("approval.reject"), style: "destructive", onPress: () => void decideApprovalFromMobile(item, "reject") },
      { text: t("approval.approve"), onPress: () => void decideApprovalFromMobile(item, "approve") }
    ]);
  }

  async function decideApprovalFromMobile(item: MobileHomeItem, decision: "approve" | "reject") {
    const businessId = selectedBusinessId || bootstrap?.active_business.id;
    if (!businessId || !item.id) return;
    setDecidingApprovalId(item.id);
    setError("");
    try {
      if (decision === "approve") {
        await approveMobileApprovalRequest(businessId, item.id);
      } else {
        await rejectMobileApprovalRequest(businessId, item.id);
      }
      const [nextHome, nextActions] = await Promise.all([
        getMobileHome(businessId),
        getMobileActions(businessId)
      ]);
      setHome(nextHome);
      setActions(nextActions);
    } catch {
      setError(t("approval.decisionError"));
    } finally {
      setDecidingApprovalId(null);
    }
  }

  async function registerPushForBusiness(businessId: number, nextBootstrap: MobileBootstrap) {
    if (!nextBootstrap.feature_flags.push_registration || pushRegistrationBusinesses.current.has(businessId)) return;
    pushRegistrationBusinesses.current.add(businessId);
    try {
      await registerForMobilePush(businessId);
    } catch {
      pushRegistrationBusinesses.current.delete(businessId);
    }
  }

  const attentionRows = useMemo(() => home?.attention.items || [], [home]);
  const activeBusiness = useMemo(() => {
    if (!bootstrap) return null;
    return bootstrap.businesses.find((business) => business.id === selectedBusinessId) || bootstrap.active_business;
  }, [bootstrap, selectedBusinessId]);
  const versionPolicy = bootstrap?.version_policy;
  const updateUrl = versionPolicy ? (Platform.OS === "android" ? versionPolicy.update_urls.android : versionPolicy.update_urls.ios) : "";
  const updateRequired = versionPolicy ? !isAppVersionSupported(MOBILE_DEVICE.appVersion, versionPolicy.min_supported_version) : false;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.page }]}>
        <ActivityIndicator color={theme.primary} />
        <Text style={[styles.centerText, { color: theme.muted }]}>{t("state.loading")}</Text>
      </View>
    );
  }

  if (updateRequired) {
    return (
      <View style={[styles.updateRoot, { backgroundColor: theme.page }]}>
        <View style={[styles.updateCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <View style={[styles.updateIcon, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.updateIconText, { color: theme.primary }]}>Z</Text>
          </View>
          <Text style={[styles.updateTitle, { color: theme.text }]}>{t("update.title")}</Text>
          <Text style={[styles.updateSubtitle, { color: theme.muted }]}>
            {t("update.subtitle")}
          </Text>
          <Text style={[styles.updateVersion, { color: theme.muted }]}>
            {MOBILE_DEVICE.appVersion}{" -> "}{versionPolicy?.latest_version || versionPolicy?.min_supported_version}
          </Text>
          <View style={styles.updateActions}>
            <Pressable
              onPress={() => {
                if (updateUrl) void Linking.openURL(updateUrl);
              }}
              disabled={!updateUrl}
              style={[styles.updatePrimaryButton, { backgroundColor: theme.primary, opacity: updateUrl ? 1 : 0.5 }]}
            >
              <Text style={styles.updatePrimaryText}>{t("update.action")}</Text>
            </Pressable>
            <Pressable onPress={logout} style={[styles.updateSecondaryButton, { borderColor: theme.border }]}>
              <Text style={[styles.updateSecondaryText, { color: theme.text }]}>{t("home.logout")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (detail) {
    return (
      <DetailScreen
        detail={detail}
        theme={theme}
        t={t}
        onClose={() => setDetail(null)}
        onReply={(item) => {
          openReplyComposer(item);
          setDetail(null);
        }}
        onProcessLead={(item) => void processLeadFromMobile(item)}
        onTaskActions={showTaskActions}
        onAppointmentActions={showAppointmentActions}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.page }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.business, { color: theme.muted }]}>{activeBusiness?.name || t("app.name")}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{t("home.title")}</Text>
        </View>
        <LanguageSwitch language={language} onChange={onLanguageChange} theme={theme} />
      </View>

      {(bootstrap?.businesses.length || 0) > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.businessTabs}>
          {(bootstrap?.businesses || []).map((business) => {
            const active = business.id === selectedBusinessId;
            return (
              <Pressable
                key={business.id}
                onPress={() => void switchBusiness(business.id)}
                style={[
                  styles.businessTab,
                  {
                    backgroundColor: active ? theme.primarySoft : theme.panel,
                    borderColor: active ? theme.primary : theme.border
                  }
                ]}
              >
                <Text style={[styles.businessTabText, { color: active ? theme.primary : theme.text }]} numberOfLines={1}>
                  {business.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { backgroundColor: theme.panelSoft, borderColor: theme.border }]}>
        {(["home", "today", "actions", "inbox", "leads", "clients", "tasks", "calendar", "alerts", "devices"] as MobileTab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, active && { backgroundColor: theme.panel }]}
            >
              <Text style={[styles.tabText, { color: active ? theme.text : theme.muted }]}>{t(`tab.${tab}`)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <Pressable onPress={() => void load()} style={[styles.errorCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Text style={[styles.retry, { color: theme.primary }]}>{t("state.retry")}</Text>
        </Pressable>
      ) : null}

      {offlineQueueSize > 0 ? (
        <Pressable onPress={() => selectedBusinessId ? void replayOfflineQueue(selectedBusinessId) : undefined} style={[styles.offlineCard, { backgroundColor: theme.panel, borderColor: offlineConflicts ? theme.danger : theme.border }]}>
          <Text style={[styles.offlineTitle, { color: theme.text }]}>
            {offlineConflicts ? t("offline.conflictTitle") : t("offline.queueTitle")}
          </Text>
          <Text style={[styles.offlineMeta, { color: theme.muted }]}>
            {offlineConflicts ? t("offline.conflictMeta") : `${t("offline.queueMeta")} ${offlineQueueSize}`}
          </Text>
        </Pressable>
      ) : null}

      {offlineConflictActions.length ? (
        <Section title={t("offline.conflictTitle")} theme={theme}>
          <View style={styles.stack}>
            {offlineConflictActions.slice(0, 5).map((item) => (
              <View key={item.id} style={[styles.offlineConflictRow, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                <Text style={[styles.offlineTitle, { color: theme.text }]}>{item.endpoint}</Text>
                <Text style={[styles.offlineMeta, { color: theme.muted }]}>{item.lastError || t("offline.conflictMeta")}</Text>
              </View>
            ))}
            <Pressable onPress={() => void clearOfflineConflicts()} style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.panel }]}>
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t("offline.clearConflicts")}</Text>
            </Pressable>
          </View>
        </Section>
      ) : null}

      {activeTab === "home" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              {(home?.kpis || []).map((kpi) => (
                <MetricTile key={kpi.key} label={t(`kpi.${kpi.key}`)} value={kpi.value} theme={theme} />
              ))}
            </View>
          </Section>

          <Section title={t("home.attention")} theme={theme}>
            {attentionRows.length ? (
              <View style={styles.stack}>
                {attentionRows.map((item) => (
                  <ActionRow
                    key={item.key}
                    label={t(`attention.${item.key}`)}
                    value={item.count}
                    tone={item.priority <= 15 ? "danger" : "warning"}
                    theme={theme}
                  />
                ))}
              </View>
            ) : (
              <Text style={[styles.empty, { color: theme.muted }]}>{t("home.empty")}</Text>
            )}
          </Section>

          <Section title={t("home.actions")} theme={theme}>
            <View style={styles.stack}>
              {(home?.quick_actions || []).map((action) => (
                <ActionRow key={action.key} label={t(`action.${action.key}`)} theme={theme} />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "today" ? (
        <>
          <Section title={t("today.tasks")} theme={theme}>
            <View style={styles.stack}>
              {(today?.sections.tasks?.items || []).map((item) => (
                <ActionRow
                  key={`task-${item.id}`}
                  label={item.title || ""}
                  value={completingTaskId === item.id ? t("tasks.completing") : item.status}
                  theme={theme}
                  disabled={completingTaskId === item.id || !isCompletableTask(item)}
                  onPress={() => void openDetail("task", item)}
                />
              ))}
            </View>
          </Section>
          <Section title={t("today.appointments")} theme={theme}>
            <View style={styles.stack}>
              {(today?.sections.appointments?.items || []).map((item) => (
                <ActionRow
                  key={`appointment-${item.id}`}
                  label={item.title || ""}
                  value={confirmingAppointmentId === item.id ? t("calendar.confirming") : item.status}
                  theme={theme}
                  disabled={confirmingAppointmentId === item.id}
                  onPress={() => void openDetail("appointment", item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "actions" ? (
        <Section title={t("tab.actions")} theme={theme}>
          <View style={styles.stack}>
            {(actions?.items || []).map((item, index) => (
              <ActionRow
                key={`${item.key}-${item.entity.id || index}`}
                label={t(`action.${item.key}`)}
                value={actionRowValue(item, processingLeadId, completingTaskId, confirmingAppointmentId, decidingApprovalId, t)}
                tone={item.priority <= 15 ? "danger" : "warning"}
                theme={theme}
                disabled={isActionDisabled(item, processingLeadId, completingTaskId, confirmingAppointmentId, decidingApprovalId)}
                onPress={actionRowPress(item, processLeadFromMobile, completeTaskFromMobile, confirmAppointmentFromMobile, confirmApprovalFromMobile, (entity) => void openDetail("conversation", entity))}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {activeTab === "inbox" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("inbox.open")} value={inbox?.summary.open || 0} theme={theme} />
              <MetricTile label={t("inbox.unread")} value={inbox?.summary.unread || 0} theme={theme} />
              <MetricTile label={t("inbox.handoff")} value={inbox?.summary.handoff_required || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.inbox")} theme={theme}>
            <View style={styles.stack}>
              {(inbox?.items || []).map((item) => (
                <ActionRow
                  key={`inbox-${item.id}`}
                  label={item.title || ""}
                  value={item.last_message_preview?.text || item.channel}
                  tone={item.handoff_required ? "danger" : "default"}
                  theme={theme}
                  disabled={replyingConversationId === item.id}
                  onPress={() => void openDetail("conversation", item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "leads" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("leads.total")} value={leads?.summary.total || 0} theme={theme} />
              <MetricTile label={t("leads.new")} value={leads?.summary.new || 0} theme={theme} />
              <MetricTile label={t("leads.unassigned")} value={leads?.summary.unassigned || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.leads")} theme={theme}>
            <View style={styles.stack}>
              {(leads?.items || []).map((item) => (
                <ActionRow
                  key={`lead-${item.id}`}
                  label={item.client?.name || item.title || ""}
                  value={processingLeadId === item.id ? t("leads.processing") : item.status}
                  tone={item.status === "new" ? "warning" : "default"}
                  theme={theme}
                  disabled={processingLeadId === item.id || !isProcessableLead(item)}
                  onPress={() => void openDetail("lead", item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "alerts" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("inbox.unread")} value={notifications?.summary.unread || 0} theme={theme} />
              <MetricTile label={t("alerts.urgent")} value={notifications?.summary.urgent || 0} theme={theme} />
              <MetricTile label={t("alerts.failed")} value={notifications?.summary.failed || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.alerts")} theme={theme}>
            <View style={styles.stack}>
              {(notifications?.items || []).map((item) => (
                <ActionRow
                  key={`alert-${item.id}`}
                  label={item.text}
                  value={markingNotificationId === item.id ? t("alerts.markingRead") : item.priority}
                  tone={item.priority === "urgent" ? "danger" : "default"}
                  theme={theme}
                  disabled={markingNotificationId === item.id}
                  onPress={() => void markNotificationRead(item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "clients" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("clients.total")} value={clients?.summary.total || 0} theme={theme} />
              <MetricTile label={t("clients.withPhone")} value={clients?.summary.with_phone || 0} theme={theme} />
              <MetricTile label={t("clients.withEmail")} value={clients?.summary.with_email || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.clients")} theme={theme}>
            <View style={styles.stack}>
              {(clients?.items || []).map((item) => (
                <ActionRow
                  key={`client-${item.id}`}
                  label={item.title || ""}
                  value={item.phone || item.email || item.source}
                  theme={theme}
                  onPress={() => void openDetail("client", item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "tasks" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("tasks.open")} value={tasks?.summary.open || 0} theme={theme} />
              <MetricTile label={t("tasks.today")} value={tasks?.summary.today || 0} theme={theme} />
              <MetricTile label={t("tasks.overdue")} value={tasks?.summary.overdue || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.tasks")} theme={theme}>
            <View style={styles.stack}>
              {(tasks?.items || []).map((item) => (
                <ActionRow
                  key={`task-list-${item.id}`}
                  label={item.title || ""}
                  value={completingTaskId === item.id ? t("tasks.completing") : item.status}
                  tone={item.priority === "urgent" ? "danger" : "default"}
                  theme={theme}
                  disabled={completingTaskId === item.id || !isCompletableTask(item)}
                  onPress={() => void openDetail("task", item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "calendar" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("calendar.today")} value={appointments?.summary.today || 0} theme={theme} />
              <MetricTile label={t("calendar.upcoming")} value={appointments?.summary.upcoming || 0} theme={theme} />
              <MetricTile label={t("calendar.needsConfirmation")} value={appointments?.summary.needs_confirmation || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.calendar")} theme={theme}>
            <View style={styles.stack}>
              {(appointments?.items || []).map((item) => (
                <ActionRow
                  key={`appointment-list-${item.id}`}
                  label={item.title || ""}
                  value={confirmingAppointmentId === item.id ? t("calendar.confirming") : item.status}
                  tone={item.status === "created" ? "warning" : "default"}
                  theme={theme}
                  disabled={confirmingAppointmentId === item.id}
                  onPress={() => void openDetail("appointment", item)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : null}

      {activeTab === "devices" ? (
        <>
          <Section title={t("home.kpis")} theme={theme}>
            <View style={styles.metrics}>
              <MetricTile label={t("devices.total")} value={devices?.items.length || 0} theme={theme} />
            </View>
          </Section>
          <Section title={t("tab.devices")} theme={theme}>
            <View style={styles.stack}>
              {(devices?.items || []).map((item) => (
                <Pressable
                  key={`device-${item.id}`}
                  onPress={() => void revokeDevice(item.id)}
                  style={[styles.deviceRow, { backgroundColor: theme.panel, borderColor: theme.border }]}
                >
                  <View style={styles.deviceText}>
                    <Text style={[styles.deviceTitle, { color: theme.text }]}>{item.device_model || item.platform}</Text>
                    <Text style={[styles.deviceMeta, { color: theme.muted }]}>
                      {item.platform} · {item.app_version || item.os_version || t("devices.unknown")}
                    </Text>
                  </View>
                  <Text style={[styles.deviceAction, { color: item.revoked_at ? theme.muted : theme.danger }]}>
                    {item.revoked_at ? t("devices.revoked") : t("devices.revoke")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>
          <Section title={t("notifications.pushSettings")} theme={theme}>
            <View style={styles.stack}>
              {(notificationPreferences?.items || []).map((item) => (
                <View
                  key={`preference-${item.category}`}
                  style={[styles.preferenceRow, { backgroundColor: theme.panel, borderColor: theme.border }]}
                >
                  <View style={styles.deviceText}>
                    <Text style={[styles.deviceTitle, { color: theme.text }]}>{t(`notificationCategory.${item.category}`)}</Text>
                    <Text style={[styles.deviceMeta, { color: theme.muted }]}>
                      {item.privacy_mode === "full" ? t("notifications.privacyFull") : t("notifications.privacyRedacted")}
                    </Text>
                  </View>
                  <View style={styles.preferenceActions}>
                    <Pressable
                      disabled={updatingPreferenceCategory === item.category}
                      onPress={() => void updatePreference(item.category, { push_enabled: !item.push_enabled })}
                      style={[
                        styles.preferenceButton,
                        {
                          backgroundColor: item.push_enabled ? theme.primarySoft : theme.panelSoft,
                          borderColor: item.push_enabled ? theme.primary : theme.border,
                          opacity: updatingPreferenceCategory === item.category ? 0.55 : 1
                        }
                      ]}
                    >
                      <Text style={[styles.preferenceButtonText, { color: item.push_enabled ? theme.primary : theme.muted }]}>
                        {item.push_enabled ? t("notifications.pushOn") : t("notifications.pushOff")}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={updatingPreferenceCategory === item.category}
                      onPress={() => void updatePreference(item.category, { privacy_mode: item.privacy_mode === "full" ? "redacted" : "full" })}
                      style={[styles.preferenceButton, { backgroundColor: theme.panelSoft, borderColor: theme.border }]}
                    >
                      <Text style={[styles.preferenceButtonText, { color: theme.text }]}>
                        {item.privacy_mode === "full" ? t("notifications.full") : t("notifications.redacted")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        </>
      ) : null}

      <View style={styles.footerActions}>
        <Pressable onPress={() => void load(true)} style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.panel }]}>
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t("home.refresh")}</Text>
        </Pressable>
        <Pressable onPress={logout} style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.panel }]}>
          <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t("home.logout")}</Text>
        </Pressable>
      </View>

      {loadingDetail ? (
        <View style={[styles.inlineLoading, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.inlineLoadingText, { color: theme.muted }]}>{t("detail.loading")}</Text>
        </View>
      ) : null}

      <Modal transparent animationType="fade" visible={Boolean(replyConversation)} onRequestClose={() => setReplyConversation(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.replyModal, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <Text style={[styles.replyTitle, { color: theme.text }]}>{t("inbox.replyTitle")}</Text>
            <Text style={[styles.replyMeta, { color: theme.muted }]} numberOfLines={1}>
              {replyConversation?.title || t("tab.inbox")}
            </Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder={t("inbox.replyPlaceholder")}
              placeholderTextColor={theme.muted}
              multiline
              style={[styles.replyInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.panelSoft }]}
            />
            <View style={styles.replyActions}>
              <Pressable onPress={() => setReplyConversation(null)} style={[styles.replyButton, { borderColor: theme.border }]}>
                <Text style={[styles.replyButtonText, { color: theme.text }]}>{t("approval.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={() => void sendConversationReply()}
                disabled={!replyText.trim() || Boolean(replyingConversationId)}
                style={[styles.replyButton, styles.replyPrimary, { backgroundColor: theme.primary, opacity: !replyText.trim() || replyingConversationId ? 0.5 : 1 }]}
              >
                <Text style={[styles.replyButtonText, { color: "#FFFFFF" }]}>
                  {replyingConversationId ? t("inbox.replySending") : t("inbox.replySend")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function isCompletableTask(item: MobileHomeItem) {
  return Boolean(item.id && item.status !== "done" && item.status !== "cancelled");
}

function isProcessableLead(item: MobileHomeItem) {
  return Boolean(item.id && ["new", "contacted", "lost"].includes(item.status || ""));
}

function isConfirmableAppointment(item: MobileHomeItem) {
  return Boolean(item.id && item.status === "created");
}

function nextBusinessMorningIso() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);
  return next.toISOString();
}

function nextAppointmentDayIso(startAt?: string) {
  const next = startAt ? new Date(startAt) : new Date();
  if (Number.isNaN(next.getTime())) {
    return nextBusinessMorningIso();
  }
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function withExpectedUpdatedAt<T extends Record<string, unknown>>(body: T, expectedUpdatedAt?: string): T & { expected_updated_at?: string } {
  return expectedUpdatedAt ? { ...body, expected_updated_at: expectedUpdatedAt } : body;
}

function mobileApiErrorMessage(error: MobileApiError, t: (key: string) => string, fallback: string) {
  const payload = error.payload as { code?: unknown } | null;
  if (error.status === 401) return t("error.authExpired");
  if (error.status === 403) return t("error.forbidden");
  if (error.status === 409 || payload?.code === "stale_state") return t("error.staleState");
  if (error.status === 422 || error.status === 400) return t("error.validation");
  if (error.status >= 500) return t("error.server");
  return fallback;
}

function isActionDisabled(
  item: { key: string; entity: MobileHomeItem },
  processingLeadId: number | null,
  completingTaskId: number | null,
  confirmingAppointmentId: number | null,
  decidingApprovalId: number | null
) {
  if (item.key === "process_lead") {
    return processingLeadId === item.entity.id || !isProcessableLead(item.entity);
  }
  if (item.key === "complete_task") {
    return completingTaskId === item.entity.id || !isCompletableTask(item.entity);
  }
  if (item.key === "confirm_appointment") {
    return confirmingAppointmentId === item.entity.id || !isConfirmableAppointment(item.entity);
  }
  if (item.key === "approve_ai_request") {
    return decidingApprovalId === item.entity.id || !item.entity.id;
  }
  return false;
}

function actionRowPress(
  item: { key: string; entity: MobileHomeItem },
  processLead: (entity: MobileHomeItem) => void,
  completeTask: (entity: MobileHomeItem) => void,
  confirmAppointment: (entity: MobileHomeItem) => void,
  confirmApproval: (entity: MobileHomeItem) => void,
  openConversation: (entity: MobileHomeItem) => void
) {
  if (item.key === "process_lead") {
    return () => processLead(item.entity);
  }
  if (item.key === "complete_task") {
    return () => completeTask(item.entity);
  }
  if (item.key === "confirm_appointment") {
    return () => confirmAppointment(item.entity);
  }
  if (item.key === "approve_ai_request") {
    return () => confirmApproval(item.entity);
  }
  if (item.key === "reply_conversation") {
    return () => openConversation(item.entity);
  }
  return undefined;
}

function actionRowValue(
  item: { key: string; entity: MobileHomeItem },
  processingLeadId: number | null,
  completingTaskId: number | null,
  confirmingAppointmentId: number | null,
  decidingApprovalId: number | null,
  t: (key: string) => string
) {
  if (item.key === "process_lead" && processingLeadId === item.entity.id) {
    return t("leads.processing");
  }
  if (item.key === "complete_task" && completingTaskId === item.entity.id) {
    return t("tasks.completing");
  }
  if (item.key === "confirm_appointment" && confirmingAppointmentId === item.entity.id) {
    return t("calendar.confirming");
  }
  if (item.key === "approve_ai_request" && decidingApprovalId === item.entity.id) {
    return t("approval.deciding");
  }
  return item.entity.title;
}

function Section({ title, theme, children }: { title: string; theme: ZaniTheme; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function DetailScreen({
  detail,
  theme,
  t,
  onClose,
  onReply,
  onProcessLead,
  onTaskActions,
  onAppointmentActions
}: {
  detail: DetailState;
  theme: ZaniTheme;
  t: (key: string) => string;
  onClose: () => void;
  onReply: (item: MobileHomeItem) => void;
  onProcessLead: (item: MobileHomeItem) => void;
  onTaskActions: (item: MobileHomeItem) => void;
  onAppointmentActions: (item: MobileHomeItem) => void;
}) {
  const title = detailTitle(detail);
  const subtitle = detailSubtitle(detail, t);
  return (
    <View style={[styles.detailScreen, { backgroundColor: theme.page }]}>
      <View style={[styles.detailPanel, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderText}>
              <Text style={[styles.replyTitle, { color: theme.text }]} numberOfLines={2}>{title}</Text>
              <Text style={[styles.replyMeta, { color: theme.muted }]} numberOfLines={1}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.detailClose, { borderColor: theme.border }]}>
              <Text style={[styles.detailCloseText, { color: theme.text }]}>{t("detail.back")}</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
            {detail.type === "client" ? (
              <>
                <DetailFields
                  theme={theme}
                  rows={[
                    [t("detail.phone"), detail.data.client.phone || ""],
                    [t("detail.email"), detail.data.client.email || ""],
                    [t("detail.source"), detail.data.client.source || ""],
                    [t("detail.notes"), detail.data.details.notes || ""]
                  ]}
                />
                <RelatedRows title={t("detail.relatedLeads")} rows={detail.data.related.leads} theme={theme} empty={t("detail.empty")} />
                <RelatedRows title={t("detail.relatedTasks")} rows={detail.data.related.tasks} theme={theme} empty={t("detail.empty")} />
                <RelatedRows title={t("detail.relatedAppointments")} rows={detail.data.related.appointments} theme={theme} empty={t("detail.empty")} />
              </>
            ) : null}

            {detail.type === "lead" ? (
              <>
                <DetailFields
                  theme={theme}
                  rows={[
                    [t("detail.status"), detail.data.lead.status || ""],
                    [t("detail.source"), detail.data.lead.source || ""],
                    [t("detail.client"), detail.data.lead.client?.name || ""],
                    [t("detail.responsible"), detail.data.details.responsible_user?.full_name || ""],
                    [t("detail.message"), detail.data.details.message || ""]
                  ]}
                />
                <View style={styles.detailActions}>
                  <DetailActionButton label={t("action.process_lead")} theme={theme} onPress={() => onProcessLead(detail.data.lead)} />
                </View>
                <RelatedRows title={t("detail.relatedTasks")} rows={detail.data.related.tasks} theme={theme} empty={t("detail.empty")} />
                <RelatedRows title={t("detail.relatedAppointments")} rows={detail.data.related.appointments} theme={theme} empty={t("detail.empty")} />
              </>
            ) : null}

            {detail.type === "task" ? (
              <>
                <DetailFields
                  theme={theme}
                  rows={[
                    [t("detail.status"), detail.data.task.status || ""],
                    [t("detail.priority"), detail.data.task.priority || ""],
                    [t("detail.due"), formatMaybeDate(detail.data.task.due_at)],
                    [t("detail.assignee"), detail.data.details.assignee?.full_name || ""],
                    [t("detail.description"), detail.data.details.description || ""],
                    [t("detail.cancelReason"), detail.data.details.cancel_reason || ""]
                  ]}
                />
                <View style={styles.detailActions}>
                  <DetailActionButton label={t("tasks.actionsTitle")} theme={theme} onPress={() => onTaskActions(detail.data.task)} />
                </View>
                <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{t("detail.comments")}</Text>
                {detail.data.comments.length ? detail.data.comments.map((comment) => (
                  <View key={comment.id} style={[styles.detailChip, { backgroundColor: theme.panelSoft, borderColor: theme.border }]}>
                    <Text style={[styles.detailChipTitle, { color: theme.text }]}>{comment.text}</Text>
                    <Text style={[styles.detailChipMeta, { color: theme.muted }]}>{comment.author?.full_name || ""}</Text>
                  </View>
                )) : <Text style={[styles.empty, { color: theme.muted }]}>{t("detail.empty")}</Text>}
              </>
            ) : null}

            {detail.type === "appointment" ? (
              <>
                <DetailFields
                  theme={theme}
                  rows={[
                    [t("detail.status"), detail.data.appointment.status || ""],
                    [t("detail.client"), detail.data.details.client.title || ""],
                    [t("detail.service"), detail.data.details.service.name || ""],
                    [t("detail.resource"), detail.data.details.resource.name || ""],
                    [t("detail.start"), formatMaybeDate(detail.data.appointment.start_at)],
                    [t("detail.end"), formatMaybeDate(detail.data.appointment.end_at)],
                    [t("detail.notes"), detail.data.details.notes || ""]
                  ]}
                />
                <View style={styles.detailActions}>
                  <DetailActionButton label={t("calendar.actionsTitle")} theme={theme} onPress={() => onAppointmentActions(detail.data.appointment)} />
                </View>
                <RelatedRows title={t("detail.relatedTasks")} rows={detail.data.related.tasks} theme={theme} empty={t("detail.empty")} />
              </>
            ) : null}

            {detail.type === "conversation" ? (
              <>
                <DetailFields
                  theme={theme}
                  rows={[
                    [t("detail.status"), detail.data.details.status],
                    [t("detail.channel"), detail.data.details.channel],
                    [t("detail.client"), detail.data.details.client?.title || ""],
                    [t("detail.assignee"), detail.data.details.assigned_to?.full_name || ""],
                    [t("detail.handoff"), detail.data.details.handoff_reason || ""]
                  ]}
                />
                <View style={styles.detailActions}>
                  <DetailActionButton label={t("inbox.replySend")} theme={theme} onPress={() => onReply(detail.data.conversation)} />
                </View>
                <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{t("detail.messages")}</Text>
                {detail.data.messages.length ? detail.data.messages.map((message) => (
                  <View key={message.id} style={[styles.detailChip, { backgroundColor: theme.panelSoft, borderColor: theme.border }]}>
                    <Text style={[styles.detailChipTitle, { color: theme.text }]}>{message.text}</Text>
                    <Text style={[styles.detailChipMeta, { color: theme.muted }]}>{message.sender_type} · {formatMaybeDate(message.created_at)}</Text>
                  </View>
                )) : <Text style={[styles.empty, { color: theme.muted }]}>{t("detail.empty")}</Text>}
              </>
            ) : null}
          </ScrollView>
      </View>
    </View>
  );
}

function DetailFields({ rows, theme }: { rows: Array<[string, string | number | null | undefined]>; theme: ZaniTheme }) {
  return (
    <View style={styles.detailFields}>
      {rows.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => (
        <View key={label} style={[styles.detailField, { backgroundColor: theme.panelSoft, borderColor: theme.border }]}>
          <Text style={[styles.detailFieldLabel, { color: theme.muted }]}>{label}</Text>
          <Text style={[styles.detailFieldValue, { color: theme.text }]}>{String(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function RelatedRows({ title, rows, theme, empty }: { title: string; rows: MobileHomeItem[]; theme: ZaniTheme; empty: string }) {
  return (
    <View style={styles.detailRelated}>
      <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{title}</Text>
      {rows.length ? rows.map((item) => (
        <View key={`${title}-${item.id}`} style={[styles.detailChip, { backgroundColor: theme.panelSoft, borderColor: theme.border }]}>
          <Text style={[styles.detailChipTitle, { color: theme.text }]} numberOfLines={2}>{item.title || item.client?.name || `#${item.id}`}</Text>
          <Text style={[styles.detailChipMeta, { color: theme.muted }]}>{item.status || item.source || formatMaybeDate(item.start_at || item.due_at)}</Text>
        </View>
      )) : <Text style={[styles.empty, { color: theme.muted }]}>{empty}</Text>}
    </View>
  );
}

function DetailActionButton({ label, theme, onPress }: { label: string; theme: ZaniTheme; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.detailActionButton, { backgroundColor: theme.primary }]}>
      <Text style={styles.detailActionButtonText}>{label}</Text>
    </Pressable>
  );
}

function detailTitle(detail: DetailState) {
  if (detail.type === "client") return detail.data.client.title || "";
  if (detail.type === "lead") return detail.data.lead.client?.name || detail.data.lead.title || "";
  if (detail.type === "task") return detail.data.task.title || "";
  if (detail.type === "appointment") return detail.data.appointment.title || "";
  return detail.data.conversation.title || "";
}

function detailSubtitle(detail: DetailState, t: (key: string) => string) {
  if (detail.type === "client") return t("tab.clients");
  if (detail.type === "lead") return `${t("tab.leads")} · ${detail.data.lead.status || ""}`;
  if (detail.type === "task") return `${t("tab.tasks")} · ${detail.data.task.status || ""}`;
  if (detail.type === "appointment") return `${t("tab.calendar")} · ${formatMaybeDate(detail.data.appointment.start_at)}`;
  return `${t("tab.inbox")} · ${detail.data.details.channel}`;
}

function formatMaybeDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 58,
    paddingBottom: 38,
    gap: 24
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  centerText: {
    fontSize: 15,
    fontWeight: "800"
  },
  updateRoot: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  updateCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 26,
    padding: 22,
    gap: 14
  },
  updateIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  updateIconText: {
    fontSize: 20,
    fontWeight: "900"
  },
  updateTitle: {
    fontSize: 25,
    fontWeight: "900"
  },
  updateSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  updateVersion: {
    fontSize: 13,
    fontWeight: "900"
  },
  updateActions: {
    gap: 10,
    marginTop: 4
  },
  updatePrimaryButton: {
    minHeight: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  updatePrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900"
  },
  updateSecondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  updateSecondaryText: {
    fontSize: 15,
    fontWeight: "900"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  headerText: {
    flex: 1,
    gap: 4
  },
  business: {
    fontSize: 13,
    fontWeight: "800"
  },
  title: {
    fontSize: 34,
    fontWeight: "900"
  },
  businessTabs: {
    flexDirection: "row",
    gap: 8
  },
  businessTab: {
    maxWidth: 190,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  businessTabText: {
    fontSize: 13,
    fontWeight: "900"
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    gap: 4,
    minHeight: 52
  },
  tab: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  tabText: {
    fontSize: 12,
    fontWeight: "900"
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 6
  },
  errorText: {
    fontSize: 14,
    fontWeight: "800"
  },
  retry: {
    fontSize: 14,
    fontWeight: "900"
  },
  offlineCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 6
  },
  offlineTitle: {
    fontSize: 15,
    fontWeight: "900"
  },
  offlineMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  offlineConflictRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900"
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12
  },
  stack: {
    gap: 10
  },
  empty: {
    fontSize: 15,
    fontWeight: "700"
  },
  footerActions: {
    flexDirection: "row",
    gap: 12
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "900"
  },
  inlineLoading: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  inlineLoadingText: {
    fontSize: 14,
    fontWeight: "800"
  },
  deviceRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  deviceText: {
    flex: 1,
    gap: 4
  },
  deviceTitle: {
    fontSize: 15,
    fontWeight: "900"
  },
  deviceMeta: {
    fontSize: 12,
    fontWeight: "700"
  },
  deviceAction: {
    fontSize: 13,
    fontWeight: "900"
  },
  preferenceRow: {
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  preferenceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  preferenceButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  preferenceButtonText: {
    fontSize: 12,
    fontWeight: "900"
  },
  modalBackdrop: {
    flex: 1,
    padding: 18,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "center"
  },
  replyModal: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 12
  },
  replyTitle: {
    fontSize: 20,
    fontWeight: "900"
  },
  replyMeta: {
    fontSize: 13,
    fontWeight: "800"
  },
  replyInput: {
    minHeight: 116,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: "700",
    textAlignVertical: "top"
  },
  replyActions: {
    flexDirection: "row",
    gap: 10
  },
  replyButton: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  replyPrimary: {
    borderWidth: 0
  },
  replyButtonText: {
    fontSize: 14,
    fontWeight: "900"
  },
  detailScreen: {
    flex: 1,
    padding: 18,
    paddingTop: 58
  },
  detailPanel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  detailHeaderText: {
    flex: 1,
    gap: 4
  },
  detailClose: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  detailCloseText: {
    fontSize: 13,
    fontWeight: "900"
  },
  detailScroll: {
    maxHeight: "100%"
  },
  detailContent: {
    gap: 14,
    paddingBottom: 4
  },
  detailFields: {
    gap: 8
  },
  detailField: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  detailFieldLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  detailFieldValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  detailActions: {
    flexDirection: "row",
    gap: 10
  },
  detailActionButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  detailActionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900"
  },
  detailRelated: {
    gap: 8
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: "900"
  },
  detailChip: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  detailChipTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900"
  },
  detailChipMeta: {
    fontSize: 12,
    fontWeight: "700"
  }
});
