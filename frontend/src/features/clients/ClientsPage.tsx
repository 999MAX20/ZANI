import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import { segmentFiltersApi, segmentsApi, taggedObjectsApi, tagsApi } from "../../api/activities";
import { clientsApi } from "../../api/clients";
import { getApiErrorMessage } from "../../api/client";
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
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Client, Id, SegmentFilter } from "../../types";

type SegmentDraft = {
  name: string;
  field: SegmentFilter["field"];
  operator: SegmentFilter["operator"];
  value: string;
};

export function ClientsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, appointments, tags, taggedObjects, segments } = useEntityData();
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
      const existing = (tags.data || []).find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
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

  const rows = filteredClients.data || clients.data || [];
  const clientTags = useMemo(() => {
    const map: Record<string, typeof taggedObjects.data> = {};
    (taggedObjects.data || []).forEach((item) => {
      if (item.entity_type !== "client") return;
      map[item.entity_id] = map[item.entity_id] || [];
      map[item.entity_id]?.push(item);
    });
    return map;
  }, [taggedObjects.data]);

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с клиентами." />;
  if (clients.isLoading || filteredClients.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Клиенты"
        description="Контакты, теги, сегменты и быстрый доступ к истории."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSegmentOpen(true)}><Tags size={18} />Сегмент</Button>
            <Button onClick={() => setOpen(true)}><Plus size={18} />Создать клиента</Button>
          </div>
        )}
      />
      {mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error || mergeMutation.error || archiveMutation.error || addTagMutation.error || createSegmentMutation.error)} /></div> : null}
      <div className="mb-4 grid gap-3 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-sm lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr]">
        <Input placeholder="Поиск по имени, телефону или email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={source} onChange={(event) => setSource(event.target.value)} options={[
          { value: "", label: "Все источники" },
          { value: "manual", label: "Manual" },
          { value: "website", label: "Website" },
          { value: "telegram", label: "Telegram" },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
        ]} />
        <Select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)} options={[{ value: "", label: "Все теги" }, ...(tags.data || []).map((tag) => ({ value: tag.id, label: tag.name }))]} />
        <Select value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value)} options={[{ value: "", label: "Все сегменты" }, ...(segments.data || []).map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.cached_count})` }))]} />
      </div>
      <DataTable
        rows={rows}
        emptyTitle="Клиентов пока нет"
        emptyDescription={search ? "По этому запросу клиентов не найдено. Проверьте имя, телефон или email." : "Добавьте первого клиента, чтобы вести заявки, записи и историю общения в одном месте."}
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />Создать клиента</Button>}
        columns={[
          { header: "Имя", cell: (client) => <span className="font-medium text-ink">{client.full_name}</span> },
          { header: "Телефон", cell: (client) => client.phone || "-" },
          { header: "Email", cell: (client) => client.email || "-" },
          {
            header: "Теги",
            cell: (client) => (
              <div className="flex max-w-xs flex-wrap gap-1">
                {(clientTags[String(client.id)] || []).slice(0, 3).map((item) => (
                  <span key={item.id} className="rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: `${item.tag_color || "#2563eb"}18`, color: item.tag_color || "#2563eb" }}>
                    {item.tag_name}
                  </span>
                ))}
                {!(clientTags[String(client.id)] || []).length ? <span className="text-xs text-slate-400">нет тегов</span> : null}
              </div>
            ),
          },
          { header: "Источник", cell: (client) => client.source },
          { header: "Заявки", cell: (client) => (leads.data || []).filter((lead) => lead.client === client.id).length },
          { header: "Записи", cell: (client) => (appointments.data || []).filter((appointment) => appointment.client === client.id).length },
          { header: "Создан", cell: (client) => formatDate(client.created_at) },
          {
            header: "Действия",
            cell: (client) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setDrawerEntity({ type: "client", id: client.id })}><Search size={16} />Карточка</Button>
                <Button variant="ghost" onClick={() => { setEditing(client); setOpen(true); }}>Изменить</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const tagName = window.prompt("Название тега");
                    if (tagName) addTagMutation.mutate({ clientId: client.id, tagName });
                  }}
                >
                  Тег
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt("Причина архивации клиента");
                    if (reason !== null) archiveMutation.mutate({ id: client.id, reason });
                  }}
                >
                  Архив
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Modal title={editing ? "Редактировать клиента" : "Создать клиента"} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
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
      <Modal title="Создать сегмент клиентов" open={segmentOpen} onClose={() => setSegmentOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createSegmentMutation.mutate();
          }}
        >
          <Input label="Название сегмента" value={segmentDraft.name} onChange={(event) => setSegmentDraft({ ...segmentDraft, name: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Поле"
              value={segmentDraft.field}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, field: event.target.value as SegmentDraft["field"] })}
              options={[
                { value: "source", label: "Источник" },
                { value: "tag", label: "Тег" },
                { value: "full_name", label: "Имя" },
                { value: "phone", label: "Телефон" },
                { value: "email", label: "Email" },
                { value: "notes", label: "Заметки" },
              ]}
            />
            <Select
              label="Условие"
              value={segmentDraft.operator}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, operator: event.target.value as SegmentDraft["operator"] })}
              options={[
                { value: "equals", label: "Равно" },
                { value: "contains", label: "Содержит" },
                { value: "in", label: "Один из" },
                { value: "is_empty", label: "Пусто" },
                { value: "not_empty", label: "Заполнено" },
              ]}
            />
          </div>
          {segmentDraft.field === "tag" ? (
            <Select
              label="Значение"
              value={segmentDraft.value}
              onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })}
              options={[{ value: "", label: "Выберите тег" }, ...(tags.data || []).map((tag) => ({ value: String(tag.id), label: tag.name }))]}
            />
          ) : (
            <Input label="Значение" value={segmentDraft.value} onChange={(event) => setSegmentDraft({ ...segmentDraft, value: event.target.value })} />
          )}
          <Button type="submit" isLoading={createSegmentMutation.isPending} disabled={!segmentDraft.name}>
            Сохранить сегмент
          </Button>
        </form>
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
