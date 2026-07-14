import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import type { Task, TeamMember } from "../../../types";

export type LeadNextActionDraft = {
  title: string;
  due_at: string;
  assignee: string;
  priority: Task["priority"];
};

export function LeadNextActionModal({
  open,
  title,
  draft,
  teamMembers,
  isLoading,
  labels,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  draft: LeadNextActionDraft;
  teamMembers: TeamMember[];
  isLoading: boolean;
  labels: {
    task: string;
    deadline: string;
    responsible: string;
    leadResponsible: string;
    priority: string;
    priorityLow: string;
    priorityNormal: string;
    priorityHigh: string;
    priorityUrgent: string;
    createTask: string;
  };
  onClose: () => void;
  onDraftChange: (draft: LeadNextActionDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input label={labels.task} value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} required />
        <Input label={labels.deadline} type="datetime-local" value={draft.due_at} onChange={(event) => onDraftChange({ ...draft, due_at: event.target.value })} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={labels.responsible}
            value={draft.assignee}
            onChange={(event) => onDraftChange({ ...draft, assignee: event.target.value })}
            options={[
              { value: "", label: labels.leadResponsible },
              ...teamMembers.map((member) => ({ value: String(member.user.id), label: member.user.full_name || member.user.email })),
            ]}
          />
          <Select
            label={labels.priority}
            value={draft.priority}
            onChange={(event) => onDraftChange({ ...draft, priority: event.target.value as Task["priority"] })}
            options={[
              { value: "low", label: labels.priorityLow },
              { value: "normal", label: labels.priorityNormal },
              { value: "high", label: labels.priorityHigh },
              { value: "urgent", label: labels.priorityUrgent },
            ]}
          />
        </div>
        <Button type="submit" isLoading={isLoading}>{labels.createTask}</Button>
      </form>
    </Modal>
  );
}
