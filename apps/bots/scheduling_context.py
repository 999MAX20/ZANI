from datetime import timedelta
import re
from apps.scheduling.availability import business_zone

from django.utils import timezone

from apps.scheduling.models import Resource
from apps.scheduling.services import get_available_slots
from apps.services.models import Service


def build_bot_scheduling_context(conversation, *, qualification=None, days=5, slots_per_resource=3, message_context=None):
    business = conversation.business
    messages = (
        [message["text"] for message in reversed(message_context) if message["direction"] == "inbound"][:8]
        if message_context is not None else
        list(conversation.messages.filter(direction="inbound").order_by("-created_at", "-id").values_list("text", flat=True)[:8])
    )
    message_text = (messages[0] if messages else "").lower()
    services = list(Service.objects.filter(business=business, is_active=True).order_by("name")[:20])
    resources = list(Resource.objects.filter(business=business, is_active=True, resource_type=Resource.ResourceTypes.STAFF).order_by("name")[:20])

    matched_service = _match_service(services, message_text, qualification=qualification)
    if not matched_service:
        matched_service = _match_service(services, " ".join(messages[1:]).lower(), qualification=qualification)
    matched_resource = _match_resource(resources, message_text)
    required_questions = _required_questions(matched_service=matched_service, matched_resource=matched_resource, resources=resources)
    today = timezone.localtime(timezone.now(), business_zone(business)).date()

    context = {
        "currency": business.currency,
        "timezone": business.timezone,
        "local_date": today.isoformat(),
        "services": [_service_payload(service) for service in services],
        "resources": [_resource_payload(resource) for resource in resources],
        "matched_service": _service_payload(matched_service) if matched_service else None,
        "matched_resource": _resource_payload(matched_resource) if matched_resource else None,
        "next_available_slots": [],
        "required_questions": required_questions,
    }
    if not matched_service:
        return context

    slot_resources = [matched_resource] if matched_resource else resources[:5]
    if not slot_resources:
        context["required_questions"].append("Передать запрос администратору: активный специалист не найден.")
        return context

    offsets = range(days)
    if "послезавтра" in message_text:
        offsets = [2]
    elif "завтра" in message_text:
        offsets = [1]
    elif "сегодня" in message_text:
        offsets = [0]
    context["searched_dates"] = [(today + timedelta(days=offset)).isoformat() for offset in offsets]
    for day_offset in offsets:
        slot_date = today + timedelta(days=day_offset)
        for resource in slot_resources:
            try:
                slots = get_available_slots(business, matched_service, slot_date, resource=resource)
            except ValueError:
                continue
            for slot in [slot for slot in slots if slot > timezone.now()][:slots_per_resource]:
                context["next_available_slots"].append(
                    {
                        "service_id": matched_service.id,
                        "service_name": matched_service.name,
                        "resource_id": resource.id if resource else None,
                        "resource_name": resource.name if resource else "",
                        "start_at": slot.isoformat(),
                        "end_at": (slot + timedelta(minutes=matched_service.duration_minutes)).isoformat(),
                    }
                )
            if len(context["next_available_slots"]) >= 8:
                return context
    if not context["next_available_slots"]:
        context["required_questions"].append("Предложить клиенту другой день: свободных окон для выбранной услуги/специалиста не найдено.")
    return context


def _match_service(services, message_text, *, qualification=None):
    qualification_service = (getattr(qualification, "service_name", "") or "").strip().lower()
    for service in services:
        if qualification_service and service.name.lower() == qualification_service:
            return service
    for service in services:
        if service.name.lower() in message_text:
            return service
    matches = [service for service in services if _name_matches(service.name, message_text)]
    if len(matches) == 1:
        return matches[0]
    if len(services) == 1:
        return services[0]
    return None


def _match_resource(resources, message_text):
    for resource in resources:
        if resource.name.lower() in message_text:
            return resource
    matches = [resource for resource in resources if _name_matches(resource.name, message_text)]
    if len(matches) == 1:
        return matches[0]
    return None


def _name_matches(name, text):
    """Conservative inflection matching; ambiguous matches require clarification."""
    words = re.findall(r"[^\W_]+", text.lower())
    name_words = re.findall(r"[^\W_]+", name.lower())
    return bool(name_words) and all(
        any(word.startswith(part[:max(3, min(5, len(part) - 1))]) for word in words)
        for part in name_words
    )


def _required_questions(*, matched_service, matched_resource, resources):
    questions = []
    if not matched_service:
        questions.append("Уточнить услугу, на которую клиент хочет записаться.")
    if resources and not matched_resource:
        questions.append("Уточнить, нужен ли конкретный специалист/ресурс, или можно подобрать ближайшее свободное окно.")
    questions.append("Уточнить удобный день и время, если клиент не выбрал конкретный слот.")
    return questions


def _service_payload(service):
    return {
        "id": service.id,
        "name": service.name,
        "duration_minutes": service.duration_minutes,
        "price_from": str(service.price_from or ""),
    }


def _resource_payload(resource):
    return {
        "id": resource.id,
        "name": resource.name,
        "resource_type": resource.resource_type,
    }
