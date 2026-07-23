import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { taggedObjectsApi, tagsApi } from "../../../api/activities";
import { getApiErrorMessage } from "../../../api/client";
import { clientsApi } from "../../../api/clients";
import { useActionConfirm } from "../../../components/actions/ActionConfirmProvider";
import { useUndoToast } from "../../../components/actions/UndoToastProvider";
import { useNotification } from "../../../components/notifications/NotificationProvider";
import { useActiveBusiness } from "../../../hooks/useBusiness";
import { useI18n } from "../../../lib/i18n";
import type { Client, Id } from "../../../types";

export function useClientWorkspaceActions(clientId: Id | null) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmAction = useActionConfirm();
  const showUndoToast = useUndoToast();
  const showNotification = useNotification();
  const { business } = useActiveBusiness();
  const [editOpen, setEditOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
    enabled: Boolean(business?.id),
  });

  const invalidateClient = async () => {
    await queryClient.invalidateQueries({ queryKey: ["clients"] });
    await queryClient.invalidateQueries({
      queryKey: ["crm-card", "client", clientId],
    });
  };

  const saveClientMutation = useMutation({
    mutationFn: (payload: Partial<Client>) =>
      clientsApi.update({ id: clientId as Id, payload }),
    onSuccess: async () => {
      await invalidateClient();
      setEditOpen(false);
      showNotification({ message: t("common.saved"), tone: "success" });
    },
    onError: (error) =>
      showNotification({ message: getApiErrorMessage(error), tone: "danger" }),
  });

  const addTagMutation = useMutation({
    mutationFn: async ({ tagName }: { tagName: string }) => {
      if (!business?.id || !clientId)
        throw new Error(t("account.businessRequired"));
      const existing = (tagsQuery.data || []).find(
        (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
      );
      const tag =
        existing ||
        (await tagsApi.create({
          business: business.id,
          name: tagName,
          color: "#FF7A1A",
          source: "manual",
        }));
      return taggedObjectsApi.create({
        business: business.id,
        tag: tag.id,
        entity_type: "client",
        entity_id: String(clientId),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      await queryClient.invalidateQueries({ queryKey: ["tagged-objects"] });
      await queryClient.invalidateQueries({
        queryKey: ["crm-card", "client", clientId],
      });
      setTagDraft("");
      setTagOpen(false);
      showNotification({ message: t("clients.addTag"), tone: "success" });
    },
    onError: (error) =>
      showNotification({ message: getApiErrorMessage(error), tone: "danger" }),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ reason }: { reason: string }) =>
      clientsApi.archive({ id: clientId as Id, reason }),
    onSuccess: async () => {
      await invalidateClient();
      showUndoToast({
        message: t("clients.noticeArchived"),
        onUndo: async () => {
          await clientsApi.restore(clientId as Id);
          await invalidateClient();
        },
      });
      navigate("/app/clients");
    },
    onError: (error) =>
      showNotification({ message: getApiErrorMessage(error), tone: "danger" }),
  });

  async function requestArchiveClient(client: Client) {
    const result = await confirmAction({
      title: t("clients.archiveClient"),
      description: t("clients.archiveConfirmText", {
        name: client.full_name || t("common.client"),
      }),
      confirmLabel: t("clients.archiveAction"),
      variant: "danger",
      reason: {
        label: t("clients.archiveReason"),
        placeholder: t("clients.archiveReasonPlaceholder"),
        required: true,
        minLength: 3,
      },
    });
    if (!result.confirmed || !result.reason) return;
    archiveMutation.mutate({ reason: result.reason });
  }

  return {
    addTagMutation,
    archiveMutation,
    business,
    editOpen,
    requestArchiveClient,
    saveClientMutation,
    setEditOpen,
    setTagDraft,
    setTagOpen,
    tagDraft,
    tagOpen,
  };
}
