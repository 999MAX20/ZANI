import type { Task } from "../../types";
import type { TaskFormState } from "./components/TaskFormModal";

export const emptyTaskForm: TaskFormState = {
  title: "",
  description: "",
  client: "",
  lead: "",
  deal: "",
  appointment: "",
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
    description: task.description || "",
    client: task.client ? String(task.client) : "",
    lead: task.lead ? String(task.lead) : "",
    deal: task.deal ? String(task.deal) : "",
    appointment: task.appointment ? String(task.appointment) : "",
    assignee: task.assignee ? String(task.assignee) : "",
    priority: task.priority,
    due_at: toDateTimeLocal(task.due_at),
    reminder_at: toDateTimeLocal(task.reminder_at),
  };
}
