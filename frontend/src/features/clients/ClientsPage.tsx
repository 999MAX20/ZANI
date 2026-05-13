import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { clientsApi } from "../../api/clients";
import { getApiErrorMessage } from "../../api/client";
import { CrmEntityDrawer, type CrmDrawerEntity } from "../../components/crm/CrmEntityDrawer";
import { ClientForm } from "../../components/forms/ClientForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { formatDate } from "../../lib/format";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Client } from "../../types";

export function ClientsPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { clients, leads, appointments } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [drawerEntity, setDrawerEntity] = useState<CrmDrawerEntity | null>(null);
  const [search, setSearch] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: Partial<Client>) =>
      editing ? clientsApi.update({ id: editing.id, payload }) : clientsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setEditing(undefined);
    },
  });

  const rows = useMemo(() => {
    const value = search.toLowerCase();
    return (clients.data || []).filter((client) =>
      [client.full_name, client.phone, client.email].join(" ").toLowerCase().includes(value),
    );
  }, [clients.data, search]);

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы работать с клиентами." />;
  if (clients.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Клиенты"
        description="Контакты, источники и быстрый доступ к истории."
        actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Создать клиента</Button>}
      />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <div className="mb-4 max-w-md">
        <Input placeholder="Поиск по имени, телефону или email" value={search} onChange={(event) => setSearch(event.target.value)} />
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
              </div>
            ),
          },
        ]}
      />
      <Modal title={editing ? "Редактировать клиента" : "Создать клиента"} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <ClientForm businessId={business.id} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
      <CrmEntityDrawer entity={drawerEntity} onClose={() => setDrawerEntity(null)} />
    </>
  );
}
