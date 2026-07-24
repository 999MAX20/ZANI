import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppointmentCreatePayload } from "../../../api/appointments";
import { clientsApi } from "../../../api/clients";
import { fileAttachmentsApi } from "../../../api/fileAttachments";
import { leadsApi, type LeadCreatePayload } from "../../../api/leads";
import { useActionConfirm } from "../../../components/actions/ActionConfirmProvider";
import { useActionFeedback } from "../../../components/actions/useActionFeedback";
import type { Id, Lead, Task } from "../../../types";
import type { LeadAction, OfflineLeadAction, Translate, UndoToast } from "../types";

type NextActionDraft = {
  title: string;
  due_at: string;
  assignee: string;
  priority: Task["priority"];
};

export function useLeadActions({
  businessId,
  selected,
  nextActionDraft,
  t,
  enqueueOfflineAction,
  pushHistory,
  setNotice,
  setSelectedId,
  setCreateOpen,
  setSelectedLeadIds,
  setContextMenu,
  setNextActionOpen,
  setAppointmentOpen,
}: {
  businessId?: Id;
  selected: Lead | null;
  nextActionDraft: NextActionDraft;
  t: Translate;
  enqueueOfflineAction: (action: OfflineLeadAction) => void;
  pushHistory: (item: UndoToast) => void;
  setNotice: (message: string | null, tone?: "success" | "info" | "warning" | "danger") => void;
  setSelectedId: (id: Id) => void;
  setCreateOpen: (open: boolean) => void;
  setSelectedLeadIds: (ids: Id[]) => void;
  setContextMenu: (menu: { x: number; y: number; lead: Lead } | null) => void;
  setNextActionOpen: (open: boolean) => void;
  setAppointmentOpen: (open: boolean) => void;
}) {
  const confirmAction = useActionConfirm();
  const { notifyError } = useActionFeedback();
  const queryClient = useQueryClient();

  const leadMutation = useMutation({
    mutationFn: (payload: LeadCreatePayload) => leadsApi.create(payload),
    onSuccess: async (lead) => {
      setCreateOpen(false);
      setNotice(t("leads.noticeCreated"), "success");
      setSelectedId(lead.id);
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => notifyError(error),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, lead, user_id, lost_reason }: { action: LeadAction; lead: Lead; user_id?: Id; lost_reason?: string }) => {
      if (action === "take") return leadsApi.takeInWork({ id: lead.id });
      if (action === "contacted") return leadsApi.markContacted({ id: lead.id });
      if (action === "deal") return leadsApi.createDeal({ id: lead.id });
      if (action === "closed") return leadsApi.markClosed({ id: lead.id });
      if (action === "reopen") return leadsApi.reopen({ id: lead.id });
      if (action === "assign") return leadsApi.assign({ id: lead.id, user_id });
      if (!lost_reason) throw new Error(t("leads.lostReasonRequired"));
      return leadsApi.markLost({ id: lead.id, lost_reason });
    },
    onSuccess: async (_, variables) => {
      const labels = {
        take: t("leads.noticeTaken"),
        contacted: t("leads.noticeContacted"),
        deal: t("leads.noticeDealCreated"),
        closed: t("leads.noticeClosed"),
        lost: t("leads.noticeLost"),
        reopen: t("leads.noticeReopened"),
        assign: t("leads.noticeAssigned"),
      };
      setNotice(labels[variables.action], "success");
      if (variables.action === "assign") {
        pushHistory({
          message: t("leads.noticeAssigned"),
          undo: async () => {
            await leadsApi.assign({ id: variables.lead.id, user_id: variables.lead.responsible_user || undefined });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
          redo: async () => {
            await leadsApi.assign({ id: variables.lead.id, user_id: variables.user_id });
            await queryClient.invalidateQueries({ queryKey: ["leads"] });
          },
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
      ]);
    },
    onError: (error) => notifyError(error),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ leads, reason }: { leads: Lead[]; reason: string }) => Promise.all(leads.map((lead) => leadsApi.archive({ id: lead.id, reason }))),
    onSuccess: async (_, variables) => {
      setSelectedLeadIds([]);
      setContextMenu(null);
      setNotice(t("leads.noticeArchived", { count: variables.leads.length }), "success");
      pushHistory({
        message: t("leads.noticeArchived", { count: variables.leads.length }),
        undo: async () => {
          await Promise.all(variables.leads.map((lead) => leadsApi.restore(lead.id)));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
        redo: async () => {
          await Promise.all(variables.leads.map((lead) => leadsApi.archive({ id: lead.id, reason: variables.reason })));
          await queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => notifyError(error),
  });

  async function requestArchiveLeads(leadsToArchive: Lead[]) {
    if (!leadsToArchive.length) return;
    const result = await confirmAction({
      title: t("leads.archiveConfirmTitle"),
      description: t("leads.archiveConfirmText", { count: leadsToArchive.length }),
      confirmLabel: t("leads.archive"),
      variant: "danger",
      reason: {
        label: t("leads.archiveReason"),
        placeholder: t("leads.archiveReasonPlaceholder"),
        required: true,
        minLength: 3,
      },
    });
    if (!result.confirmed || !result.reason) return;
    archiveMutation.mutate({ leads: leadsToArchive, reason: result.reason });
  }

  const bulkContactMutation = useMutation({
    mutationFn: (selectedLeads: Lead[]) => Promise.all(selectedLeads.map((lead) => leadsApi.markContacted({ id: lead.id }))),
    onSuccess: async () => {
      setSelectedLeadIds([]);
      setNotice(t("leads.bulkDone"), "success");
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => notifyError(error),
  });

  const mergeClientMutation = useMutation({
    mutationFn: async ({ targetId, duplicateId }: { targetId: Id; duplicateId: Id }) => {
      const preview = await clientsApi.mergeDryRun({ id: targetId, duplicate_client_id: duplicateId });
      const transferredCount = Object.values(preview.transferred).reduce((sum, value) => sum + value, 0);
      const result = await confirmAction({
        title: t("clients.mergePreviewTitle"),
        description: t("clients.mergePreviewConfirm", { count: transferredCount }),
        confirmLabel: t("clients.mergeConfirm"),
      });
      if (!result.confirmed) return null;
      return clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId });
    },
    onSuccess: async (result) => {
      if (!result) return;
      setNotice(t("leads.duplicatesMerged"), "success");
      await queryClient.invalidateQueries();
    },
    onError: (error) => notifyError(error),
  });

  const noteMutation = useMutation({
    mutationFn: async ({ lead, text, files }: { lead: Lead; text: string; files: File[] }) => {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          id: `note-${lead.id}-${Date.now()}`,
          type: "note",
          leadId: lead.id,
          text: `${text.trim() || t("leads.filesAttachedNote")}${files.length ? `\n\n${t("leads.offlineFilesSkipped")}` : ""}`,
          createdAt: new Date().toISOString(),
        });
        return { offline: true };
      }
      const uploaded = await Promise.all(
        files.map((file) =>
          fileAttachmentsApi.upload({
            business: businessId!,
            entityType: "lead",
            entityId: lead.id,
            file,
          }),
        ),
      );
      const attachmentText = uploaded.length
        ? `\n\n${t("leads.attachments")}:\n${uploaded.map((attachment) => `- ${attachment.original_name}: ${attachment.download_url}`).join("\n")}`
        : "";
      const noteText = `${text.trim() || t("leads.filesAttachedNote")}${attachmentText}`;
      return leadsApi.addNote({ id: lead.id, text: noteText });
    },
    onSuccess: async (result, variables) => {
      if (result && "offline" in result) {
        setNotice(t("leads.offlineQueued"), "info");
        return;
      }
      setNotice(t("leads.noteAdded"), "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm-card", "lead", variables.lead.id] }),
        queryClient.invalidateQueries({ queryKey: ["file-attachments"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-events"] }),
      ]);
    },
    onError: (error) => notifyError(error),
  });

  const nextActionMutation = useMutation<Task | { offline: true }, Error, Lead>({
    mutationFn: (lead: Lead) => {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          id: `task-${lead.id}-${Date.now()}`,
          type: "task",
          leadId: lead.id,
          title: nextActionDraft.title,
          due_at: nextActionDraft.due_at,
          assignee: nextActionDraft.assignee,
          priority: nextActionDraft.priority,
          createdAt: new Date().toISOString(),
        });
        return Promise.resolve({ offline: true });
      }
      const payload = {
        title: nextActionDraft.title,
        description: "",
        assignee: nextActionDraft.assignee ? Number(nextActionDraft.assignee) : null,
        due_at: new Date(nextActionDraft.due_at).toISOString(),
        priority: nextActionDraft.priority,
      };
      return leadsApi.createTask({ leadId: lead.id, payload });
    },
    onSuccess: async (result) => {
      setNextActionOpen(false);
      if (result && "offline" in result) {
        setNotice(t("leads.offlineQueued"), "info");
        return;
      }
      setNotice(t("leads.noticeNextActionCreated"), "success");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => notifyError(error),
  });

  const appointmentMutation = useMutation({
    mutationFn: (payload: AppointmentCreatePayload) => {
      if (!selected?.id || !payload.service || !payload.start_at) throw new Error(t("leads.appointmentSelectionRequired"));
      return leadsApi.createAppointment({
        leadId: selected.id,
        payload: { service: payload.service, resource: payload.resource || null, start_at: payload.start_at },
      });
    },
    onSuccess: async () => {
      setAppointmentOpen(false);
      setNotice(t("leads.appointmentCreated"), "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
      ]);
    },
    onError: (error) => notifyError(error),
  });

  return {
    leadMutation,
    actionMutation,
    archiveMutation,
    bulkContactMutation,
    mergeClientMutation,
    noteMutation,
    nextActionMutation,
    appointmentMutation,
    requestArchiveLeads,
  };
}
