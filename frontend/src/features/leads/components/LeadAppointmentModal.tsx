import { AppointmentForm } from "../../../components/forms/AppointmentForm";
import { Modal } from "../../../components/ui/Modal";
import type { AppointmentCreatePayload } from "../../../api/appointments";
import type { Client, Id, Lead, Resource, Service } from "../../../types";

export function LeadAppointmentModal({
  open,
  title,
  businessId,
  clients,
  services,
  resources,
  leads,
  selectedLead,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  businessId: Id;
  clients: Client[];
  services: Service[];
  resources: Resource[];
  leads: Lead[];
  selectedLead?: Lead;
  onClose: () => void;
  onSubmit: (payload: AppointmentCreatePayload) => Promise<unknown>;
}) {
  const selectedLeadService = services.find(
    (service) => service.id === selectedLead?.service && service.is_active && !service.is_archived,
  );
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <AppointmentForm
        businessId={businessId}
        clients={clients}
        services={services}
        resources={resources}
        leads={leads}
        prefill={{
          client: selectedLead?.client,
          service: selectedLeadService?.id,
          lead: selectedLead?.id,
          source: "manual",
        }}
        onSubmit={(payload) => onSubmit({
          ...payload,
          lead: selectedLead?.id || payload.lead,
          client: selectedLead?.client || payload.client,
          service: payload.service,
        })}
      />
    </Modal>
  );
}
