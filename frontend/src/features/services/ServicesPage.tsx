import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { servicesApi } from "../../api/services";
import { ServiceForm } from "../../components/forms/ServiceForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { Service } from "../../types";

export function ServicesPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { services } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | undefined>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<Service>) =>
      editing ? servicesApi.update({ id: editing.id, payload }) : servicesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setOpen(false);
      setEditing(undefined);
    },
  });

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы управлять услугами." />;
  if (services.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Услуги" description="Список услуг, длительность и стартовая цена." actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Добавить услугу</Button>} />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <DataTable
        rows={services.data || []}
        emptyTitle="Услуг пока нет"
        emptyDescription="Добавьте услуги с длительностью и ценой, чтобы менеджеры могли быстро создавать записи."
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />Добавить услугу</Button>}
        columns={[
          { header: "Название", cell: (service) => <span className="font-medium text-ink">{service.name}</span> },
          { header: "Длительность", cell: (service) => `${service.duration_minutes} мин` },
          { header: "Цена от", cell: (service) => service.price_from || "-" },
          { header: "Статус", cell: (service) => <StatusBadge status={service.is_active ? "active" : "inactive"} /> },
          { header: "Действия", cell: (service) => <Button variant="ghost" onClick={() => { setEditing(service); setOpen(true); }}>Изменить</Button> },
        ]}
      />
      <Modal title={editing ? "Редактировать услугу" : "Добавить услугу"} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <ServiceForm businessId={business.id} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
    </>
  );
}
