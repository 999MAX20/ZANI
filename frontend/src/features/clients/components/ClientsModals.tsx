import type { UseMutationResult } from "@tanstack/react-query";

import type { ClientMergeDryRun, ClientMergeResult } from "../../../api/clients";
import type { Client, Id, Segment, Tag, TaggedObject } from "../../../types";
import { ClientForm } from "../../../components/forms/ClientForm";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import type { SegmentDraft, Translate } from "../types";

export function ClientsModals({
  businessId,
  createOpen,
  editing,
  mergePreview,
  mergeMutation,
  mergeDryRunMutation,
  tagOpen,
  tagDraft,
  selectedClient,
  addTagMutation,
  segmentOpen,
  segmentDraft,
  tagList,
  createSegmentMutation,
  t,
  onCloseCreate,
  onCreateSubmit,
  onOpenClient,
  onCloseMergePreview,
  onCloseTag,
  onTagDraftChange,
  onSegmentDraftChange,
  onCloseSegment,
}: {
  businessId: Id;
  createOpen: boolean;
  editing?: Client;
  mergePreview: ClientMergeDryRun | null;
  mergeMutation: UseMutationResult<ClientMergeResult, Error, { targetId: number; duplicateId: number }>;
  mergeDryRunMutation: UseMutationResult<ClientMergeDryRun, Error, { targetId: number; duplicateId: number }>;
  tagOpen: boolean;
  tagDraft: string;
  selectedClient: Client | null;
  addTagMutation: UseMutationResult<TaggedObject, Error, { clientId: Id; tagName: string }>;
  segmentOpen: boolean;
  segmentDraft: SegmentDraft;
  tagList: Tag[];
  createSegmentMutation: UseMutationResult<Segment, Error, void>;
  t: Translate;
  onCloseCreate: () => void;
  onCreateSubmit: (payload: Partial<Client>) => Promise<Client>;
  onOpenClient: (id: number) => void;
  onCloseMergePreview: () => void;
  onCloseTag: () => void;
  onTagDraftChange: (value: string) => void;
  onSegmentDraftChange: (value: SegmentDraft) => void;
  onCloseSegment: () => void;
}) {
  return (
    <>
      <Modal title={editing ? t("clients.editTitle") : t("clients.create")} open={createOpen} onClose={onCloseCreate}>
        <ClientForm
          businessId={businessId}
          initial={editing}
          onSubmit={onCreateSubmit}
          onOpenClient={onOpenClient}
          onMergeDuplicate={(duplicateId) => {
            if (!editing) return Promise.resolve();
            return mergeDryRunMutation.mutateAsync({ targetId: editing.id, duplicateId });
          }}
        />
      </Modal>

      <Modal title={t("clients.mergePreviewTitle")} open={Boolean(mergePreview)} onClose={onCloseMergePreview}>
        {mergePreview ? (
          <div className="space-y-4">
            <div className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-black">{t("clients.mergePreviewWarning")}</p>
              <p className="mt-1">
                {t("clients.mergePreviewPolicy")}: {mergePreview.policy}
              </p>
            </div>
            <div className="rounded-card border border-slate-200 bg-white p-4">
              <p className="font-black text-midnight">{mergePreview.duplicate.full_name || t("common.client")}</p>
              <p className="mt-1 text-sm text-slate-500">{mergePreview.duplicate.phone || mergePreview.duplicate.email || t("clients.noContact")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(mergePreview.transferred).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-control bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-600">{key.replace(/_/g, " ")}</span>
                  <span className="font-black text-midnight">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onCloseMergePreview}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={mergeMutation.isPending}
                onClick={() => mergeMutation.mutate({ targetId: mergePreview.target_client_id, duplicateId: mergePreview.duplicate.id })}
              >
                {t("clients.mergeConfirm")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title={t("clients.addTag")} open={tagOpen} onClose={onCloseTag}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const tagName = tagDraft.trim();
            if (!selectedClient || !tagName) return;
            addTagMutation.mutate({ clientId: selectedClient.id, tagName });
          }}
        >
          <Input label={t("clients.tagPrompt")} value={tagDraft} onChange={(event) => onTagDraftChange(event.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCloseTag}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" isLoading={addTagMutation.isPending} disabled={!tagDraft.trim()}>
              {t("clients.addTag")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={t("clients.createSegment")} open={segmentOpen} onClose={onCloseSegment}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createSegmentMutation.mutate();
          }}
        >
          <Input label={t("clients.segmentName")} value={segmentDraft.name} onChange={(event) => onSegmentDraftChange({ ...segmentDraft, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t("clients.field")}
              value={segmentDraft.field}
              onChange={(event) => onSegmentDraftChange({ ...segmentDraft, field: event.target.value as SegmentDraft["field"] })}
              options={[
                { value: "source", label: t("clients.source") },
                { value: "tag", label: t("clients.tag") },
                { value: "full_name", label: t("clients.name") },
                { value: "phone", label: t("clients.phone") },
                { value: "email", label: "Email" },
                { value: "notes", label: t("clients.notes") },
              ]}
            />
            <Select
              label={t("clients.condition")}
              value={segmentDraft.operator}
              onChange={(event) => onSegmentDraftChange({ ...segmentDraft, operator: event.target.value as SegmentDraft["operator"] })}
              options={[
                { value: "equals", label: t("clients.equals") },
                { value: "contains", label: t("clients.contains") },
                { value: "in", label: t("clients.inList") },
                { value: "is_empty", label: t("clients.isEmpty") },
                { value: "not_empty", label: t("clients.notEmpty") },
              ]}
            />
          </div>
          {segmentDraft.field === "tag" ? (
            <Select
              label={t("clients.value")}
              value={segmentDraft.value}
              onChange={(event) => onSegmentDraftChange({ ...segmentDraft, value: event.target.value })}
              options={[{ value: "", label: t("clients.selectTag") }, ...tagList.map((tag) => ({ value: String(tag.id), label: tag.name }))]}
            />
          ) : (
            <Input label={t("clients.value")} value={segmentDraft.value} onChange={(event) => onSegmentDraftChange({ ...segmentDraft, value: event.target.value })} />
          )}
          <Button type="submit" isLoading={createSegmentMutation.isPending} disabled={!segmentDraft.name}>
            {t("clients.saveSegment")}
          </Button>
        </form>
      </Modal>
    </>
  );
}
