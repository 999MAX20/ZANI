import { useMutation, useQueryClient } from "@tanstack/react-query";

import { leadsApi } from "../../../api/leads";
import { tasksApi } from "../../../api/tasks";
import type { Lead } from "../../../types";
import type { LeadAction } from "../types";

/**
 * Хук для мутаций заявок
 * Вынесен из LeadsPage для уменьшения размера компонента
 */
export function useLeadActions() {
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: ({ action, lead, user_id, lost_reason }: { action: LeadAction; lead: Lead; user_id?: string; lost_reason?: string }) => {
      switch (action) {
        case "assign":
          return leadsApi.assign(lead.id, { user_id });
        case "status":
          return leadsApi.updateStatus(lead.id, { status: lead.status, lost_reason });
        case "archive":
          return leadsApi.archive(lead.id);
        case "restore":
          return leadsApi.restore(lead.id);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: { lead_id: string; title: string; description?: string; due_date?: string; assigned_to?: string }) => {
      return tasksApi.create(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ lead, text, files }: { lead: Lead; text: string; files: File[] }) => {
      if (files.length > 0) {
        // Сначала загружаем файлы
        const attachments = await Promise.all(files.map((file) => leadsApi.uploadAttachment(lead.id, file)));
        const attachmentIds = attachments.map((a) => a.id);
        return leadsApi.addNote(lead.id, { text, attachment_ids: attachmentIds });
      }
      return leadsApi.addNote(lead.id, { text });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  return {
    actionMutation,
    createTaskMutation,
    noteMutation,
  };
}
