import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { taggedObjectsApi, tagsApi } from "../../../api/activities";
import { clientsApi } from "../../../api/clients";
import { useActionConfirm } from "../../../components/actions/ActionConfirmProvider";
import { useActionFeedback } from "../../../components/actions/useActionFeedback";
import { useUndoToast } from "../../../components/actions/UndoToastProvider";
import { useActiveBusiness } from "../../../hooks/useBusiness";
import { useI18n } from "../../../lib/i18n";
import type { Client, Id } from "../../../types";

export function useClientWorkspaceActions(clientId: Id | null) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmAction = useActionConfirm();
  const showUndoToast = useUndoToast();
  const { notifyError, notifySuccess } = useActionFeedback();
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
      notifySuccess(t("common.saved"));
    },
    onError: (error) =>
      notifyError(error, {
        actionLabel: t("common.refresh"),
        retry: invalidateClient,
      }),
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
      notifySuccess(t("clients.addTag"));
    },
    onError: (error) => notifyError(error),
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
    onError: (error) => notifyError(error),
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
