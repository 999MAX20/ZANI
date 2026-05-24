import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Inbox, Plus, Search, Tags, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { clientsApi } from "../../api/clients";
import { getApiErrorMessage, unwrapList } from "../../api/client";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { ClientForm } from "../../components/forms/ClientForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Client, Id, SegmentFilter } from "../../types";

type SegmentDraft = {
  name: string;
  field: SegmentFilter["field"];
  operator: SegmentFilter["operator"];
  value: string;
};

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: typeof UsersRound }) {
  return (
    <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-midnight">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

export function ClientsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, appointments, tags, taggedObjects, segments } = useEntityData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [segmentDraft, setSegmentDraft] = useState<SegmentDraft>({ name: "", field: "source", operator: "equals", value: "" });

  const filteredClients = useQuery({
    queryKey: ["clients", "filtered", search, source, selectedTag, selectedSegment],
    queryFn: () => clientsApi.listFiltered({ q: search || undefined, source: source || undefined, tag: selectedTag || undefined, segment: selectedSegment || undefined }),
  });

  const mutation = useMutation({
    mutationFn: (payload: Partial<Client>) =>
      editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setEditing(undefined);
      clearCreateParam();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({ targetId, duplicateId }: { targetId: number; duplicateId: number }) =>
      clientsApi.merge({ id: targetId, duplicate_client_id: duplicateId }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setOpen(false);
      setEditing(undefined);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: clientsApi.archive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const addTagMutation = useMutation({
    mutationFn: async ({ clientId, tagName }: { clientId: Id; tagName: string }) => {
      const existing = tagList.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
      const tag = existing || await tagsApi.create({ business: business!.id, name: tagName, color: "#2563eb", source: "manual" });
      return taggedObjectsApi.create({ business: business!.id, tag: tag.id, entity_type: "client", entity_id: String(clientId) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tagged-objects"] });
      queryClient.invalidateQueries({ queryKey: ["crm-card"] });
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

  const hasActiveFilters = Boolean(search || source || selectedTag || selectedSegment);
  const clientList = unwrapList<Client>(clients.data);
  const rows = hasActiveFilters ? unwrapList<Client>(filteredClients.data) : clientList;
  const leadList = unwrapList(leads.data);
  const appointmentList = unwrapList(appointments.data);
  const tagList = unwrapList(tags.data);
  const taggedObjectList = unwrapList(taggedObjects.data);
  const segmentList = unwrapList(segments.data);

  function clearCreateParam() {
    if (!searchParams.get("create")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    const clientId = Number(searchParams.get("client") || "");
    if (clientId) setDrawerEntity({ type: "client", id: clientId });
    if (searchParams.get("create") === "1") {
      setEditing(undefined);
      setOpen(true);
    }
  }, [searchParams]);
  const clientTags = useMemo(() => {
    const map: Record<string, typeof taggedObjectList> = {};
    taggedObjectList.forEach((item) => {
      if (item.entity_type !== "client") return;
      map[item.entity_id] = map[item.entity_id] || [];
      map[item.entity_id]?.push(item);
    });
    return map;
  }, [taggedObjectList]);

  if (!business) return <ErrorState message={t("clients.noBusiness")} />;
  if (clients.isLoading || filteredClients.isLoading) return <LoadingState />;
  const leadClientIds = new Set(leadList.map((lead) => lead.client));
  const appointmentClientIds = new Set(appointmentList.map((appointment) => appointment.client));
  const taggedClientIds = new Set(taggedObjectList.filter((item) => item.entity_type === "client").map((item) => item.entity_id));

  return (
    <>
      <PageHeader
        title={t("clients.title")}
        description={t("clients.description")}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSegmentOpen(true)}><Tags size={18} />{t("clients.segment")}</Button>
            <Button onClick={() => setOpen(true)}><Plus size={18} />{t("clients.create")}</Button>
          </div>
        )}
      />
      <section className="mb-5 grid gap-3 lg:grid-cols-4">
        <StatCard label={t("clients.total")} value={clientList.length} hint={t("clients.totalHint")} icon={UsersRound} />
        <StatCard label={t("clients.withLeads")} value={leadClientIds.size} hint={t("clients.withLeadsHint")} icon={Inbox} />
        <StatCard label={t("clients.withBookings")} value={appointmentClientIds.size} hint={t("clients.withBookingsHint")} icon={CalendarCheck} />
        <StatCard label={t("clients.tagged")} value={taggedClientIds.size} hint={t("clients.taggedHint")} icon={Tags} />
      </section>
      {mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error)} /></div> : null}
      <div className="mb-4 grid gap-3 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr]">
        <Input placeholder={t("clients.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={source} onChange={(event) => setSource(event.target.value)} options={[
          { value: "", label: t("clients.allSources") },
          { value: "manual", label: "Manual" },
          { value: "website", label: "Website" },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
        ]} />
        <Select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} options={[{ value: "", label: t("clients.allTags") }, ...tagList.map((tag) => ({ value: tag.id, label: tag.name }))]} />
        <Select value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value)} options={[{ value: "", label: t("clients.allSegments") }, ...segmentList.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))]} />
      </div>
      <DataTable
        rows={rows}
        emptyTitle={t("clients.emptyTitle")}
        emptyDescription={search ? t("clients.emptyFiltered") : t("clients.emptyText")}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />{t("clients.create")}</Button>}
        columns={[
          { header: t("clients.name"), cell: (client) => <span className="font-medium text-ink">{client.full_name}</span> },
          { header: t("clients.phone"), cell: (client) => client.phone || "-" },
          { header: "Email", cell: (client) => client.email || "-" },
          {
            header: t("clients.tags"),
            cell: (client) => (
              <div className="flex max-w-xs flex-wrap gap-1">
                {(clientTags[String(client.id)] || []).slice(0, 3).map((item) => (
                  <span key={item.id} className="rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: `${item.tag_color || "#2563eb"}18`, color: item.tag_color || "#2563eb" }}>
                    {item.tag_name}
                  </span>
                ))}
                {!(clientTags[String(client.id)] || []).length ? <span className="text-xs text-slate-400">{t("clients.noTags")}</span> : null}
              </div>
            ),
          },
          { header: t("appointment.source"), cell: (client) => client.source },
          { header: t("nav.leads"), cell: (client) => leadList.filter((lead) => lead.client === client.id).length },
          { header: t("nav.appointments"), cell: (client) => appointmentList.filter((appointment) => appointment.client === client.id).length },
          { header: t("clients.created"), cell: (client) => formatDate(client.created_at) },
          {
            header: t("appointments.actions"),
            cell: (client) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setDrawerEntity({ type: "client", id: client.id })}><Search size={16} />{t("appointments.card")}</Button>
                <Button variant="ghost" onClick={() => { setEditing(client); setOpen(true); }}>{t("appointments.edit")}</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const tagName = window.prompt(t("clients.tagPrompt"));
                    if (tagName) addTagMutation.mutate({ clientId: client.id, tagName });
                  }}
                >
                  {t("clients.tag")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt(t("clients.archiveReason"));
                    if (reason !== null) archiveMutation.mutate({ id: client.id, reason });
                  }}
                >
                  {t("appointments.archive")}
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal title={editing ? t("clients.editTitle") : t("clients.create")} open={open} onClose={() => { setOpen(false); setEditing(undefined); clearCreateParam(); }}>
        <ClientForm
          businessId={business.id}
          initial={editing}
          onSubmit={(payload) => mutation.mutateAsync(payload)}
          onOpenClient={(id) => {
            setOpen(false);
            setEditing(undefined);
            setDrawerEntity({ type: "client", id });
          }}
          onMergeDuplicate={(duplicateId) => {
            if (!editing) return Promise.resolve();
            return mergeMutation.mutateAsync({ targetId: editing.id, duplicateId });
          }}
        />
      </Modal>
      <Modal title={t("clients.createSegment")} open={segmentOpen} onClose={() => setSegmentOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createSegmentMutation.mutate();
          }}
        >
          <Input label={t("clients.segmentName")} value={segmentDraft.name} onChange={(event) => setSegmentDraft({ ...segmentDraft, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t("clients.field")}
              value={segmentDraft.field}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, field: event.target.value as SegmentDraft["field"] })}
              options={[
                { value: "source", label: t("appointment.source") },
                { value: "tag", label: t("clients.tag") },
                { value: "full_name", label: t("clients.name") },
                { value: "phone", label: t("clients.phone") },
                { value: "email", label: "Email" },
                { value: "notes", label: t("appointment.notes") },
              ]}
            />
            <Select
              label={t("clients.condition")}
              value={segmentDraft.operator}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, operator: event.target.value as SegmentDraft["operator"] })}
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
              onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })}
              options={[{ value: "", label: t("clients.selectTag") }, ...tagList.map((tag) => ({ value: String(tag.id), label: tag.name }))]}
            />
          ) : (
            <Input label={t("clients.value")} value={segmentDraft.value} onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })} />
          )}
          <Button type="submit" isLoading={createSegmentMutation.isPending} disabled={!segmentDraft.name}>
            {t("clients.saveSegment")}
          </Button>
        </form>
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
