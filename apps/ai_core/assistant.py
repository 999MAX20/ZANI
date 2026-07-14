from apps.clients.models import Client
from apps.businesses.access import Actions, Resources, scope_queryset
from apps.core.permissions import user_can_access_business
from apps.leads.models import Lead
from apps.scheduling.models import Appointment


def build_crm_context(business, user=None):
    clients_queryset = _scoped_queryset(
        Client.objects.filter(business=business),
        user=user,
        business=business,
        resource=Resources.CLIENTS,
    )
    leads_queryset = _scoped_queryset(
        Lead.objects.select_related("client", "service").filter(business=business),
        user=user,
        business=business,
        resource=Resources.LEADS,
    )
    appointments_queryset = _scoped_queryset(
        Appointment.objects.select_related("client", "service", "resource").filter(business=business),
        user=user,
        business=business,
        resource=Resources.APPOINTMENTS,
    )
    leads = leads_queryset[:8]
    appointments = appointments_queryset[:8]
    clients_count = clients_queryset.count()
    new_leads_count = leads_queryset.filter(status=Lead.Statuses.NEW).count()
    open_appointments_count = appointments_queryset.filter(
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


def _scoped_queryset(queryset, *, user, business, resource):
    if not user or not user.is_authenticated:
        return queryset.none()
    return scope_queryset(queryset, user, business, resource, Actions.VIEW)
