import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { clientsApi, type ClientMergeDryRun } from "../../api/clients";
import { getApiErrorMessage } from "../../api/client";
import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { CrmEntityDrawer } from "../../components/crm/CrmEntityDrawer";
import { CrmTableSurface, CrmWorkspaceGrid, CrmWorkspacePage } from "../../components/crm";
import { useActionConfirm } from "../../components/actions/ActionConfirmProvider";
import { useUndoToast } from "../../components/actions/UndoToastProvider";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useAuth } from "../auth/AuthProvider";
import type { Client, Id } from "../../types";
import { ClientsFilters } from "./components/ClientsFilters";
import { ClientsModals } from "./components/ClientsModals";
import { ClientsTable } from "./components/ClientsTable";
import { MobileClientCards } from "./components/MobileClientCards";
import { useClientsPageHeader } from "./hooks/useClientsPageHeader";
import { useClientsWorkspace } from "./hooks/useClientsWorkspace";
export function ClientsPage() {
  const { t } = useI18n();
  const confirmAction = useActionConfirm();
  const showUndoToast = useUndoToast();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { user } = useAuth();
  const [mergePreview, setMergePreview] = useState<ClientMergeDryRun | null>(null);
  const {
    clearAllFilters, clearCreateParam,
    clearSearchFilter,
    closeClientCard,
    createOpen,
    drawerEntity,
    editing,
    filteredClients,
    goToPage,
    kpi,
    openClientCard,
    openCreateClient,
    openEditClient,
    page,
    pageLoading,
    pageSize,
    quickFilter,
    rows,
    search,
    segmentDraft,
    segmentOpen,
    segmentOptions,
    segments,
    selectClient,
    selectedClient,
    selectedClientId,
    selectedSegment,
    selectedTag,
    setActionClient,
    setCreateOpen,
    setEditing,
    setPage,
    setPageSize,
    setQuickFilter,
    setSegmentDraft,
    setSegmentOpen,
    setSelectedClientId,
    setSelectedSegment,
    setSelectedTag,
    setSource,
    setTagDraft,
    setTagOpen,
    source,
    sourceOptions,
    tagDraft,
    tagList,
    tagOpen,
    tagOptions,
    taggedObjects,
    tagsQuery,
    toggleClientColumn,
    totalClients,
    visibleClientColumns,
  } = useClientsWorkspace({ businessId: business?.id, currentUserId: user?.id || null, t });

  useClientsPageHeader({
    t,
    onCreateClient: openCreateClient,
    onCloseClientCard: closeClientCard,
  });

  const saveClientMutation = useMutation({
    mutationFn: (payload: Partial<Client>) => (editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload)),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card", "client", client.id] });
      setCreateOpen(false);
      setEditing(undefined);
      openClientCard(client.id);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: (mergedClient) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card", "client", mergedClient.target_client_id] });
      setCreateOpen(false);
      setEditing(undefined);
      setMergePreview(null);
    },
  });
  const mergeDryRunMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) => clientsApi.mergeDryRun({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: (preview) => setMergePreview(preview),
  });

  const archiveMutation = useMutation({
    mutationFn: clientsApi.archive,
    onSuccess: async (_archivedClient, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["crm-card", "client", variables.id] });
      setActionClient(null);
      showUndoToast({
        message: t("clients.noticeArchived"),
        onUndo: async () => {
          await clientsApi.restore(variables.id);
          await queryClient.invalidateQueries({ queryKey: ["clients"] });
          await queryClient.invalidateQueries({ queryKey: ["crm-card", "client", variables.id] });
        },
      });
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async ({ clientId, tagName }: { clientId: Id; tagName: string }) => {
      const existing = tagList.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
      const tag = existing || (await tagsApi.create({ business: business!.id, name: tagName, color: "#2563eb", source: "manual" }));
      return taggedObjectsApi.create({ business: business!.id, tag: tag.id, entity_type: "client", entity_id: String(clientId) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tagged-objects"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card"] });
      setTagOpen(false);
      setTagDraft("");
      setActionClient(null);
    },
  });

  const createSegmentMutation = useMutation({
    mutationFn: async () => {
      const segment = await segmentsApi.create({
        business: business!.id,
        name: segmentDraft.name,
        description: "Saved client filter",
        entity_type: "client",
        is_active: true,
      });
      await segmentFiltersApi.create({
        business: business!.id,
        segment: segment.id,
        field: segmentDraft.field,
        operator: segmentDraft.operator,
        value_json: { value: segmentDraft.value },
        sort_order: 1,
      });
      await segmentsApi.refreshCount(segment.id);
      return segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      setSegmentDraft({ name: "", field: "source", operator: "equals", value: "" });
      setSegmentOpen(false);
    },
  });

  async function requestArchiveClient(client: Client) {
    const result = await confirmAction({
      title: t("clients.archiveClient"),
      description: t("clients.archiveConfirmText", { name: client.full_name || t("common.client") }),
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
    setActionClient(client);
    setSelectedClientId(client.id);
    archiveMutation.mutate({ id: client.id, reason: result.reason });
  }

  const pageError = filteredClients.error || tagsQuery.error || segments.error || taggedObjects.error || saveClientMutation.error || mergeDryRunMutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error;

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (pageLoading) return <LoadingState />;

  return (
    <>
      <CrmWorkspacePage>
        {pageError ? (
          <div className="mb-3">
            <ErrorState message={getApiErrorMessage(pageError)} />
          </div>
        ) : null}

        <CrmWorkspaceGrid>
          <main className="min-w-0">
            <CrmTableSurface
              className="h-full"
              filters={
                <ClientsFilters
                  quickFilter={quickFilter}
                  onQuickFilterChange={setQuickFilter}
                  search={search}
                  source={source}
                  onSourceChange={setSource}
                  selectedTag={selectedTag}
                  onSelectedTagChange={setSelectedTag}
                  selectedSegment={selectedSegment}
                  onSelectedSegmentChange={setSelectedSegment}
                  tagOptions={tagOptions}
                  segmentOptions={segmentOptions}
                  sourceOptions={sourceOptions}
                  kpi={kpi}
                  visibleColumns={visibleClientColumns}
                  onToggleColumn={toggleClientColumn}
                  onOpenSegment={() => setSegmentOpen(true)}
                  onClearSearch={clearSearchFilter}
                  onClearAll={clearAllFilters}
                  t={t}
                />
              }
            >
              <MobileClientCards rows={rows} selectedClientId={selectedClientId} onSelectClient={selectClient} t={t} />
              <ClientsTable
                rows={rows}
                selectedClientId={selectedClientId}
                onSelectClient={selectClient}
                totalClients={totalClients}
                page={page}
                pageSize={pageSize}
                onPageChange={goToPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
                visibleColumns={visibleClientColumns}
                t={t}
              />
            </CrmTableSurface>
          </main>
        </CrmWorkspaceGrid>
      </CrmWorkspacePage>

      <ClientsModals
        businessId={business.id}
        createOpen={createOpen}
        editing={editing}
        mergePreview={mergePreview}
        mergeMutation={mergeMutation}
        mergeDryRunMutation={mergeDryRunMutation}
        tagOpen={tagOpen}
        tagDraft={tagDraft}
        selectedClient={selectedClient}
        addTagMutation={addTagMutation}
        segmentOpen={segmentOpen}
        segmentDraft={segmentDraft}
        tagList={tagList}
        createSegmentMutation={createSegmentMutation}
        t={t}
        onCloseCreate={() => {
          setCreateOpen(false);
          setEditing(undefined);
          clearCreateParam();
        }}
        onCreateSubmit={(payload) => saveClientMutation.mutateAsync(payload)}
        onOpenClient={(id) => {
          setCreateOpen(false);
          setEditing(undefined);
          openClientCard(id);
        }}
        onCloseMergePreview={() => setMergePreview(null)}
        onCloseTag={() => {
          setTagOpen(false);
          setTagDraft("");
        }}
        onTagDraftChange={setTagDraft}
        onSegmentDraftChange={setSegmentDraft}
        onCloseSegment={() => setSegmentOpen(false)}
      />

      <CrmEntityDrawer
        entity={drawerEntity}
        onClose={closeClientCard}
        clientActions={{
          onEdit: openEditClient,
          onAddTag: (client) => {
            setActionClient(client);
            setSelectedClientId(client.id);
            setTagOpen(true);
          },
          onArchive: (client) => {
            void requestArchiveClient(client);
          },
        }}
      />
    </>
  );
}
