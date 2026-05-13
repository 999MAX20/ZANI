import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { resourcesApi } from "../../api/resources";
import { ResourceForm } from "../../components/forms/ResourceForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Resource } from "../../types";

export function ResourcesPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { resources } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | undefined>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<Resource>) =>
      editing ? resourcesApi.update({ id: editing.id, payload }) : resourcesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setOpen(false);
      setEditing(undefined);
    },
  });

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы управлять ресурсами." />;
  if (resources.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Ресурсы" description="Специалисты, кабинеты, залы, боксы и оборудование." actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Добавить ресурс</Button>} />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <DataTable
        rows={resources.data || []}
        emptyTitle="Ресурсов пока нет"
        emptyDescription="Добавьте специалиста, кабинет или оборудование, чтобы распределять записи по ресурсам."
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />Добавить ресурс</Button>}
        columns={[
          { header: "Название", cell: (resource) => <span className="font-medium text-ink">{resource.name}</span> },
          { header: "Тип", cell: (resource) => resource.resource_type },
          { header: "Статус", cell: (resource) => <StatusBadge status={resource.is_active ? "active" : "inactive"} /> },
          { header: "Действия", cell: (resource) => <Button variant="ghost" onClick={() => { setEditing(resource); setOpen(true); }}>Изменить</Button> },
        ]}
      />
      <Modal title={editing ? "Редактировать ресурс" : "Добавить ресурс"} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <ResourceForm businessId={business.id} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
    </>
  );
}
