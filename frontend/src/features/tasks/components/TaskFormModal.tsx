import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { SearchableSelect, type SearchableSelectOption } from "../../../components/ui/SearchableSelect";
import { Select } from "../../../components/ui/Select";
import { ErrorState } from "../../../components/ui/StateViews";
import { formatDateTime } from "../../../lib/format";
import { useI18n } from "../../../lib/i18n";
import type { TaskTemplate } from "../../../api/tasks";
import type { Appointment, BotConversation, Client, Deal, Lead, Service, Task, TeamMember } from "../../../types";
import { toDateTimeLocal } from "../taskFormUtils";

export type TaskFormState = {
  title: string;
  template: string;
  description: string;
  client: string;
  lead: string;
  deal: string;
  appointment: string;
  conversation: string;
  assignee: string;
  priority: string;
  due_at: string;
  reminder_at: string;
};

type TaskFormModalProps = {
  open: boolean;
  editingTask: Task | null;
  form: TaskFormState;
  clients: Client[];
  leads: Lead[];
  deals: Deal[];
  appointments: Appointment[];
  conversations: BotConversation[];
  taskTemplates: TaskTemplate[];
  services: Service[];
  teamMembers: TeamMember[];
  isSaving: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onFormChange: (form: TaskFormState) => void;
  onSubmit: () => void;
};

export function TaskFormModal({
  open,
  editingTask,
  form,
  clients,
  leads,
  deals,
  appointments,
  conversations,
  taskTemplates,
  services,
  teamMembers,
  isSaving,
  errorMessage,
  onClose,
  onFormChange,
  onSubmit,
}: TaskFormModalProps) {
  const { t } = useI18n();
  const activeTeamMembers = teamMembers.filter((member) => member.is_active);
  const clientOptions: SearchableSelectOption[] = clients.map((client) => ({
    value: String(client.id),
    label: client.full_name || t("common.client"),
    description: [client.phone, client.email].filter(Boolean).join(" · "),
    searchText: [client.full_name, client.phone, client.email, client.source].filter(Boolean).join(" "),
  }));
  const assigneeOptions: SearchableSelectOption[] = activeTeamMembers.map((member) => ({
    value: String(member.user.id),
    label: member.user.full_name || member.user.email || t("tasks.assignee"),
    description: member.business_role_name || member.role,
    searchText: [member.user.full_name, member.user.email, member.role, member.business_role_name].filter(Boolean).join(" "),
  }));
  const leadOptions: SearchableSelectOption[] = leads.map((lead) => {
    const client = clients.find((item) => item.id === lead.client);
    const service = services.find((item) => item.id === lead.service);
    const label = client?.full_name || lead.client_name || t("crmCard.leadNumber", { id: lead.id });
    return {
      value: String(lead.id),
      label,
      description: [lead.status, service?.name || lead.service_name, lead.source].filter(Boolean).join(" · "),
      searchText: [label, client?.phone, client?.email, lead.client_phone, lead.client_email, lead.message, service?.name, lead.status].filter(Boolean).join(" "),
    };
  });
  const dealOptions: SearchableSelectOption[] = deals.map((deal) => {
    const client = clients.find((item) => item.id === deal.client);
    return {
      value: String(deal.id),
      label: deal.title,
      description: [client?.full_name || deal.client_name || t("common.client"), deal.status, deal.stage_name].filter(Boolean).join(" · "),
      searchText: [deal.title, client?.full_name, client?.phone, client?.email, deal.client_name, deal.client_phone, deal.client_email, deal.status, deal.stage_name].filter(Boolean).join(" "),
    };
  });
  const appointmentOptions: SearchableSelectOption[] = appointments.map((appointment) => {
    const client = clients.find((item) => item.id === appointment.client);
    const service = services.find((item) => item.id === appointment.service);
    const label = client?.full_name || appointment.client_name || t("common.client");
    return {
      value: String(appointment.id),
      label,
      description: [service?.name || appointment.service_name || t("common.service"), formatDateTime(appointment.start_at), appointment.status].filter(Boolean).join(" · "),
      searchText: [label, client?.phone, appointment.client_phone, service?.name, appointment.service_name, appointment.status, appointment.start_at].filter(Boolean).join(" "),
    };
  });
  const conversationOptions: SearchableSelectOption[] = conversations.map((conversation) => {
    const client = clients.find((item) => item.id === conversation.client);
    const label = client?.full_name || conversation.client_name || conversation.external_user_id || t("nav.conversations");
    const lastMessage = typeof conversation.last_message?.text === "string" ? conversation.last_message.text : "";
    return {
      value: String(conversation.id),
      label,
      description: [conversation.channel, conversation.status, lastMessage].filter(Boolean).join(" · "),
      searchText: [label, conversation.external_user_id, conversation.channel, conversation.status, lastMessage].filter(Boolean).join(" "),
    };
  });

  function changeLead(value: string) {
    const lead = leads.find((item) => String(item.id) === value);
    onFormChange({ ...form, lead: value, client: lead?.client ? String(lead.client) : form.client });
  }

  function changeDeal(value: string) {
    const deal = deals.find((item) => String(item.id) === value);
    onFormChange({ ...form, deal: value, client: deal?.client ? String(deal.client) : form.client, lead: deal?.lead ? String(deal.lead) : form.lead });
  }

  function changeAppointment(value: string) {
    const appointment = appointments.find((item) => String(item.id) === value);
    onFormChange({
      ...form,
      appointment: value,
      client: appointment?.client ? String(appointment.client) : form.client,
      lead: appointment?.lead ? String(appointment.lead) : form.lead,
    });
  }

  function changeConversation(value: string) {
    const conversation = conversations.find((item) => String(item.id) === value);
    onFormChange({
      ...form,
      conversation: value,
      client: conversation?.client ? String(conversation.client) : form.client,
      lead: conversation?.lead ? String(conversation.lead) : form.lead,
      deal: conversation?.deal ? String(conversation.deal) : form.deal,
    });
  }

  function applyTemplate(key: string) {
    const template = taskTemplates.find((item) => item.key === key);
    if (!template) {
      onFormChange({ ...form, template: "" });
      return;
    }
    const dueDate = new Date(Date.now() + template.due_in_hours * 60 * 60 * 1000);
    const reminderDate = new Date(dueDate.getTime() - template.reminder_offset_minutes * 60 * 1000);
    onFormChange({
      ...form,
      template: key,
      title: template.title,
      description: template.description,
      priority: template.priority,
      due_at: toDateTimeLocal(dueDate.toISOString()),
      reminder_at: toDateTimeLocal(reminderDate.toISOString()),
    });
  }

  return (
    <Modal title={editingTask ? t("tasks.editTitle") : t("tasks.create")} open={open} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Select
          label={t("tasks.template")}
          value={form.template}
          onChange={(event) => applyTemplate(event.target.value)}
          options={[
            { value: "", label: t("tasks.noTemplate") },
            ...taskTemplates.map((template) => ({ value: template.key, label: template.title })),
          ]}
        />
        <Input label={t("tasks.formTitle")} placeholder={t("tasks.titlePlaceholder")} value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} required />
        <Input label={t("tasks.formDescription")} placeholder={t("tasks.descriptionPlaceholder")} value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} />
        <SearchableSelect
          label={t("tasks.assignee")}
          value={form.assignee}
          onChange={(value) => onFormChange({ ...form, assignee: value })}
          options={assigneeOptions}
          placeholder={t("tasks.noAssignee")}
          emptyLabel={t("tasks.noAssignee")}
        />
        <SearchableSelect
          label={t("common.client")}
          value={form.client}
          onChange={(value) => onFormChange({ ...form, client: value })}
          options={clientOptions}
          placeholder={t("tasks.noClient")}
          emptyLabel={t("tasks.noClient")}
        />
        <SearchableSelect
          label={t("nav.leads")}
          value={form.lead}
          onChange={changeLead}
          options={leadOptions}
          placeholder={t("tasks.noLead")}
          emptyLabel={t("tasks.noLead")}
        />
        <SearchableSelect
          label={t("nav.deals")}
          value={form.deal}
          onChange={changeDeal}
          options={dealOptions}
          placeholder={t("tasks.noDeal")}
          emptyLabel={t("tasks.noDeal")}
        />
        <SearchableSelect
          label={t("nav.calendar")}
          value={form.appointment}
          onChange={changeAppointment}
          options={appointmentOptions}
          placeholder={t("tasks.noAppointment")}
          emptyLabel={t("tasks.noAppointment")}
        />
        <SearchableSelect
          label={t("nav.conversations")}
          value={form.conversation}
          onChange={changeConversation}
          options={conversationOptions}
          placeholder={t("tasks.noConversation")}
          emptyLabel={t("tasks.noConversation")}
        />
        <Select
          value={form.priority}
          onChange={(event) => onFormChange({ ...form, priority: event.target.value })}
          options={[
            { value: "normal", label: t("tasks.priorityNormal") },
            { value: "high", label: t("tasks.priorityHigh") },
            { value: "urgent", label: t("tasks.priorityUrgent") },
            { value: "low", label: t("tasks.priorityLow") },
          ]}
        />
        <Input label={t("tasks.dueAt")} type="datetime-local" value={form.due_at} onChange={(event) => onFormChange({ ...form, due_at: event.target.value })} />
        <Input label={t("tasks.reminderAt")} type="datetime-local" value={form.reminder_at} onChange={(event) => onFormChange({ ...form, reminder_at: event.target.value })} />
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        <Button type="submit" isLoading={isSaving}>{t("clients.save")}</Button>
      </form>
    </Modal>
  );
}
