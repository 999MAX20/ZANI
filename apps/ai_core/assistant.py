from apps.clients.models import Client
from apps.core.permissions import user_can_access_business
from apps.leads.models import Lead
from apps.scheduling.models import Appointment


def build_crm_context(business):
    leads = Lead.objects.select_related("client", "service").filter(business=business)[:8]
    appointments = Appointment.objects.select_related("client", "service", "resource").filter(business=business)[:8]
    clients_count = Client.objects.filter(business=business).count()
    new_leads_count = Lead.objects.filter(business=business, status=Lead.Statuses.NEW).count()
    open_appointments_count = Appointment.objects.filter(
        business=business,
        status__in=[Appointment.Statuses.CREATED, Appointment.Statuses.CONFIRMED],
    ).count()

    return {
        "business": {"id": business.id, "name": business.name, "type": business.business_type, "city": business.city},
        "summary": {
            "clients_count": clients_count,
            "new_leads_count": new_leads_count,
            "open_appointments_count": open_appointments_count,
        },
        "latest_leads": [
            {
                "id": lead.id,
                "client": lead.client.full_name,
                "service": lead.service.name if lead.service else None,
                "source": lead.source,
                "status": lead.status,
                "message": lead.message,
                "created_at": lead.created_at.isoformat(),
            }
            for lead in leads
        ],
        "upcoming_appointments": [
            {
                "id": appointment.id,
                "client": appointment.client.full_name,
                "service": appointment.service.name,
                "resource": appointment.resource.name if appointment.resource else None,
                "status": appointment.status,
                "start_at": appointment.start_at.isoformat(),
            }
            for appointment in appointments
        ],
    }


def assert_business_access(user, business):
    if not user_can_access_business(user, business):
        raise PermissionError("You do not have access to this business.")
