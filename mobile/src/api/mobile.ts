import { Platform } from "react-native";

import { MOBILE_DEVICE } from "../config";
import { replayOfflineActionQueue } from "../offline/actionQueue";
import { getOrCreateDeviceId, setAccessToken, setRefreshToken } from "../storage/session";
import type {
  MobileActions,
  MobileApprovalDecisionResponse,
  MobileAppointmentConfirmResponse,
  MobileAppointmentDetail,
  MobileAppointmentWriteResponse,
  MobileAppointments,
  MobileAuthResponse,
  MobileBootstrap,
  MobileClients,
  MobileClientDetail,
  MobileConversationDetail,
  MobileDevices,
  MobileHome,
  MobileInbox,
  MobileInboxReplyResponse,
  MobileLeadAssignResponse,
  MobileLeadDetail,
  MobileLeadQualifyResponse,
  MobileLeads,
  MobileNotificationMarkReadResponse,
  MobileNotificationPreference,
  MobileNotificationPreferences,
  MobileNotifications,
  MobilePushToken,
  MobileTaskCompleteResponse,
  MobileTaskDetail,
  MobileTaskWriteResponse,
  MobileTasks,
  MobileToday,
} from "../types/mobile";
import { mobileRequest } from "./client";

export async function mobileLogin(payload: { email: string; password: string; business?: number }) {
  const deviceId = await getOrCreateDeviceId();
  const response = await mobileRequest<MobileAuthResponse>("/api/mobile/v1/auth/login/", {
    method: "POST",
    retryOnUnauthorized: false,
    body: {
      email: payload.email,
      password: payload.password,
      business: payload.business,
      device_id: deviceId,
      platform: Platform.OS === "android" ? "android" : MOBILE_DEVICE.platform,
      app_version: MOBILE_DEVICE.appVersion,
      build_number: MOBILE_DEVICE.buildNumber,
      os_version: String(Platform.Version || ""),
      device_model: Platform.OS,
    },
  });
  setAccessToken(response.access);
  await setRefreshToken(response.refresh);
  return response;
}

export function getMobileBootstrap() {
  return mobileRequest<MobileBootstrap>("/api/mobile/v1/bootstrap/");
}

export function getMobileHome(businessId: number) {
  return mobileRequest<MobileHome>(`/api/mobile/v1/home/?business=${businessId}&limit=5`);
}

export function getMobileToday(businessId: number) {
  return mobileRequest<MobileToday>(`/api/mobile/v1/today/?business=${businessId}&limit=20`);
}

export function getMobileActions(businessId: number) {
  return mobileRequest<MobileActions>(`/api/mobile/v1/actions/?business=${businessId}&limit=20`);
}

export function getMobileInbox(businessId: number) {
  return mobileRequest<MobileInbox>(`/api/mobile/v1/inbox/?business=${businessId}&limit=20`);
}

export function getMobileConversationDetail(businessId: number, conversationId: number) {
  return mobileRequest<MobileConversationDetail>(`/api/mobile/v1/inbox/${conversationId}/?business=${businessId}&limit=30`);
}

export function replyMobileInboxConversation(businessId: number, conversationId: number, text: string, expectedUpdatedAt?: string) {
  const idempotencyKey = createMobileIdempotencyKey("inbox-reply");
  return replyMobileInboxConversationWithKey(businessId, conversationId, text, idempotencyKey, expectedUpdatedAt);
}

export function replyMobileInboxConversationWithKey(businessId: number, conversationId: number, text: string, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileInboxReplyResponse>(`/api/mobile/v1/inbox/${conversationId}/reply/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId, text }, expectedUpdatedAt),
  });
}

export function getMobileLeads(businessId: number) {
  return mobileRequest<MobileLeads>(`/api/mobile/v1/leads/?business=${businessId}&limit=20`);
}

export function getMobileLeadDetail(businessId: number, leadId: number) {
  return mobileRequest<MobileLeadDetail>(`/api/mobile/v1/leads/${leadId}/?business=${businessId}`);
}

export function assignMobileLead(businessId: number, leadId: number, userId?: number) {
  return mobileRequest<MobileLeadAssignResponse>(`/api/mobile/v1/leads/${leadId}/assign/`, {
    method: "POST",
    headers: { "Idempotency-Key": createMobileIdempotencyKey("lead-assign") },
    body: { business: businessId, user_id: userId },
  });
}

export function qualifyMobileLead(businessId: number, leadId: number, expectedUpdatedAt?: string) {
  return qualifyMobileLeadWithKey(businessId, leadId, createMobileIdempotencyKey("lead-qualify"), expectedUpdatedAt);
}

export function qualifyMobileLeadWithKey(businessId: number, leadId: number, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileLeadQualifyResponse>(`/api/mobile/v1/leads/${leadId}/qualify/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId }, expectedUpdatedAt),
  });
}

export function getMobileNotifications(businessId: number) {
  return mobileRequest<MobileNotifications>(`/api/mobile/v1/notifications/?business=${businessId}&limit=20&unread=true`);
}

export function getMobileNotificationPreferences(businessId: number) {
  return mobileRequest<MobileNotificationPreferences>(`/api/mobile/v1/notification-preferences/?business=${businessId}`);
}

export function updateMobileNotificationPreference(
  businessId: number,
  category: MobileNotificationPreference["category"],
  payload: Partial<Pick<MobileNotificationPreference, "in_app_enabled" | "push_enabled" | "privacy_mode">>
) {
  return mobileRequest<MobileNotificationPreferences>("/api/mobile/v1/notification-preferences/", {
    method: "POST",
    body: { business: businessId, category, ...payload },
  });
}

export function markMobileNotificationRead(businessId: number, notificationId: number, expectedUpdatedAt?: string) {
  return markMobileNotificationReadWithKey(businessId, notificationId, createMobileIdempotencyKey("notification-read"), expectedUpdatedAt);
}

export function markMobileNotificationReadWithKey(businessId: number, notificationId: number, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileNotificationMarkReadResponse>(`/api/mobile/v1/notifications/${notificationId}/mark-read/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId }, expectedUpdatedAt),
  });
}

export function getMobileDevices(businessId: number) {
  return mobileRequest<MobileDevices>(`/api/mobile/v1/devices/?business=${businessId}`);
}

export function revokeMobileDevice(businessId: number, deviceId: number) {
  return mobileRequest<{ ok: true; revoked_sessions: number; revoked_push_tokens: number }>(`/api/mobile/v1/devices/${deviceId}/revoke/`, {
    method: "POST",
    body: { business: businessId },
  });
}

export async function registerMobilePushToken(businessId: number, pushToken: string) {
  const deviceId = await getOrCreateDeviceId();
  return mobileRequest<MobilePushToken>("/api/mobile/v1/push-tokens/register/", {
    method: "POST",
    body: {
      business: businessId,
      device_id: deviceId,
      provider: "expo",
      push_token: pushToken,
    },
  });
}

export function getMobileClients(businessId: number) {
  return mobileRequest<MobileClients>(`/api/mobile/v1/clients/?business=${businessId}&limit=20`);
}

export function getMobileClientDetail(businessId: number, clientId: number) {
  return mobileRequest<MobileClientDetail>(`/api/mobile/v1/clients/${clientId}/?business=${businessId}`);
}

export function getMobileTasks(businessId: number) {
  return mobileRequest<MobileTasks>(`/api/mobile/v1/tasks/?business=${businessId}&limit=20`);
}

export function getMobileTaskDetail(businessId: number, taskId: number) {
  return mobileRequest<MobileTaskDetail>(`/api/mobile/v1/tasks/${taskId}/?business=${businessId}`);
}

export function completeMobileTask(businessId: number, taskId: number, expectedUpdatedAt?: string) {
  return completeMobileTaskWithKey(businessId, taskId, createMobileIdempotencyKey("task-complete"), expectedUpdatedAt);
}

export function completeMobileTaskWithKey(businessId: number, taskId: number, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileTaskCompleteResponse>(`/api/mobile/v1/tasks/${taskId}/complete/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId }, expectedUpdatedAt),
  });
}

export function assignMobileTaskToMe(businessId: number, taskId: number, expectedUpdatedAt?: string) {
  return assignMobileTaskToMeWithKey(businessId, taskId, createMobileIdempotencyKey("task-assign-me"), expectedUpdatedAt);
}

export function assignMobileTaskToMeWithKey(businessId: number, taskId: number, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileTaskWriteResponse>(`/api/mobile/v1/tasks/${taskId}/assign-to-me/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId }, expectedUpdatedAt),
  });
}

export function cancelMobileTask(businessId: number, taskId: number, reason: string, expectedUpdatedAt?: string) {
  return cancelMobileTaskWithKey(businessId, taskId, reason, createMobileIdempotencyKey("task-cancel"), expectedUpdatedAt);
}

export function cancelMobileTaskWithKey(businessId: number, taskId: number, reason: string, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileTaskWriteResponse>(`/api/mobile/v1/tasks/${taskId}/cancel/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId, reason }, expectedUpdatedAt),
  });
}

export function snoozeMobileTask(businessId: number, taskId: number, snoozedUntil: string, expectedUpdatedAt?: string) {
  return snoozeMobileTaskWithKey(businessId, taskId, snoozedUntil, createMobileIdempotencyKey("task-snooze"), expectedUpdatedAt);
}

export function snoozeMobileTaskWithKey(businessId: number, taskId: number, snoozedUntil: string, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileTaskWriteResponse>(`/api/mobile/v1/tasks/${taskId}/snooze/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId, snoozed_until: snoozedUntil }, expectedUpdatedAt),
  });
}

export function getMobileAppointments(businessId: number) {
  return mobileRequest<MobileAppointments>(`/api/mobile/v1/appointments/?business=${businessId}&limit=20`);
}

export function getMobileAppointmentDetail(businessId: number, appointmentId: number) {
  return mobileRequest<MobileAppointmentDetail>(`/api/mobile/v1/appointments/${appointmentId}/?business=${businessId}`);
}

export function confirmMobileAppointment(businessId: number, appointmentId: number, expectedUpdatedAt?: string) {
  return confirmMobileAppointmentWithKey(businessId, appointmentId, createMobileIdempotencyKey("appointment-confirm"), expectedUpdatedAt);
}

export function confirmMobileAppointmentWithKey(businessId: number, appointmentId: number, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileAppointmentConfirmResponse>(`/api/mobile/v1/appointments/${appointmentId}/confirm/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId }, expectedUpdatedAt),
  });
}

export function cancelMobileAppointment(businessId: number, appointmentId: number, expectedUpdatedAt?: string) {
  return cancelMobileAppointmentWithKey(businessId, appointmentId, createMobileIdempotencyKey("appointment-cancel"), expectedUpdatedAt);
}

export function cancelMobileAppointmentWithKey(businessId: number, appointmentId: number, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileAppointmentWriteResponse>(`/api/mobile/v1/appointments/${appointmentId}/cancel/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId }, expectedUpdatedAt),
  });
}

export function rescheduleMobileAppointment(businessId: number, appointmentId: number, startAt: string, resource?: number, reason = "", expectedUpdatedAt?: string) {
  return rescheduleMobileAppointmentWithKey(businessId, appointmentId, startAt, resource, reason, createMobileIdempotencyKey("appointment-reschedule"), expectedUpdatedAt);
}

export function rescheduleMobileAppointmentWithKey(businessId: number, appointmentId: number, startAt: string, resource: number | undefined, reason: string, idempotencyKey: string, expectedUpdatedAt?: string) {
  return mobileRequest<MobileAppointmentWriteResponse>(`/api/mobile/v1/appointments/${appointmentId}/reschedule/`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: withExpectedUpdatedAt({ business: businessId, start_at: startAt, resource, reason }, expectedUpdatedAt),
  });
}

export function approveMobileApprovalRequest(businessId: number, approvalId: number, reason = "") {
  return mobileRequest<MobileApprovalDecisionResponse>(`/api/mobile/v1/ai/approval-requests/${approvalId}/approve/`, {
    method: "POST",
    headers: { "Idempotency-Key": createMobileIdempotencyKey("ai-approval-approve") },
    body: { business: businessId, reason },
  });
}

export function rejectMobileApprovalRequest(businessId: number, approvalId: number, reason = "") {
  return mobileRequest<MobileApprovalDecisionResponse>(`/api/mobile/v1/ai/approval-requests/${approvalId}/reject/`, {
    method: "POST",
    headers: { "Idempotency-Key": createMobileIdempotencyKey("ai-approval-reject") },
    body: { business: businessId, reason },
  });
}

export function replayQueuedMobileActions() {
  return replayOfflineActionQueue((action) => mobileRequest(action.endpoint, {
    method: action.method,
    headers: { "Idempotency-Key": action.idempotencyKey },
    body: action.body,
  }));
}

export async function mobileLogout(refresh?: string | null) {
  await mobileRequest<{ ok: true }>("/api/mobile/v1/auth/logout/", {
    method: "POST",
    body: { refresh: refresh || "" },
  }).catch(() => undefined);
}

export function createMobileIdempotencyKey(prefix: string) {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function withExpectedUpdatedAt<T extends Record<string, unknown>>(body: T, expectedUpdatedAt?: string): T & { expected_updated_at?: string } {
  return expectedUpdatedAt ? { ...body, expected_updated_at: expectedUpdatedAt } : body;
}
