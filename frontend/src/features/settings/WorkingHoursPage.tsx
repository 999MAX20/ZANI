import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "../../api/client";
import { workingHoursApi } from "../../api/workingHours";
import { WorkingHoursForm } from "../../components/forms/WorkingHoursForm";
import { DataTable } from "../../components/tables/DataTable";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/StateViews";
import { useActiveBusiness } from "../../hooks/useBusiness";
import { useEntityData } from "../../hooks/useEntityData";
import type { WorkingHours } from "../../types";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WorkingHoursPage() {
  const queryClient = useQueryClient();
  const { business } = useActiveBusiness();
  const { workingHours, resources } = useEntityData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkingHours | undefined>();
  const mutation = useMutation({
    mutationFn: (payload: Partial<WorkingHours>) =>
      editing ? workingHoursApi.update({ id: editing.id, payload }) : workingHoursApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["working-hours"] });
      setOpen(false);
      setEditing(undefined);
    },
  });

  if (!business) return <ErrorState message="Создайте бизнес в настройках, чтобы настроить график." />;
  if (workingHours.isLoading || resources.isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader title="График работы" description="Общие часы бизнеса или график конкретного ресурса." actions={<Button onClick={() => setOpen(true)}><Plus size={18} />Добавить график</Button>} />
      {mutation.error ? <div className="mb-4"><ErrorState message={getApiErrorMessage(mutation.error)} /></div> : null}
      <DataTable
        rows={workingHours.data || []}
        emptyTitle="График не настроен"
        emptyDescription="Добавьте общие часы работы бизнеса или отдельный график для ресурса."
        emptyAction={<Button variant="secondary" onClick={() => setOpen(true)}><Plus size={16} />Добавить график</Button>}
        columns={[
          { header: "День", cell: (item) => weekdays[item.weekday] },
          { header: "Ресурс", cell: (item) => resources.data?.find((resource) => resource.id === item.resource)?.name || "Бизнес" },
          { header: "Время", cell: (item) => item.is_day_off ? "Выходной" : `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` },
          { header: "Действия", cell: (item) => <Button variant="ghost" onClick={() => { setEditing(item); setOpen(true); }}>Изменить</Button> },
        ]}
      />
      <Modal title={editing ? "Редактировать график" : "Добавить график"} open={open} onClose={() => { setOpen(false); setEditing(undefined); }}>
        <WorkingHoursForm businessId={business.id} resources={resources.data || []} initial={editing} onSubmit={(payload) => mutation.mutateAsync(payload)} />
      </Modal>
    </>
  );
}
