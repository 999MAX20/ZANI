import type { Task } from "../../types";
import type { TaskFormState } from "./components/TaskFormModal";
import type { TaskDetailsUpdatePayload } from "../../api/tasks";

export const emptyTaskForm: TaskFormState = {
  title: "",
  template: "",
  description: "",
  client: "",
  lead: "",
  deal: "",
  appointment: "",
  conversation: "",
  assignee: "",
  priority: "normal",
  due_at: "",
  reminder_at: "",
};

export function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function taskToForm(task: Task): TaskFormState {
  return {
    title: task.title,
    template: "",
    description: task.description || "",
    client: task.client ? String(task.client) : "",
    lead: task.lead ? String(task.lead) : "",
    deal: task.deal ? String(task.deal) : "",
    appointment: task.appointment ? String(task.appointment) : "",
    conversation: task.conversation ? String(task.conversation) : "",
    assignee: task.assignee ? String(task.assignee) : "",
    priority: task.priority,
    due_at: toDateTimeLocal(task.due_at),
    reminder_at: toDateTimeLocal(task.reminder_at),
  };
}

export function taskFormToDetailsPayload(form: TaskFormState): TaskDetailsUpdatePayload {
  return {
    title: form.title.trim(),
    description: form.description,
    client: form.client ? Number(form.client) : null,
    lead: form.lead ? Number(form.lead) : null,
    deal: form.deal ? Number(form.deal) : null,
    appointment: form.appointment ? Number(form.appointment) : null,
    conversation: form.conversation ? Number(form.conversation) : null,
    priority: form.priority as Task["priority"],
    due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
    reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
    assignee: form.assignee ? Number(form.assignee) : null,
  };
}
