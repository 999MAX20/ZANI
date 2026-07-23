from apps.businesses.models import Business, BusinessCapability
from apps.core.domain_errors import ModuleDisabled


MODULE_REGISTRY = (
    "inbox",
    "leads",
    "clients",
    "appointments",
    "tasks",
    "deals",
    "analytics",
    "ai",
    "automations",
    "integrations",
)

RESOURCE_MODULES = {
    "conversations": "inbox",
    "leads": "leads",
    "clients": "clients",
    "appointments": "appointments",
    "tasks": "tasks",
    "deals": "deals",
    "analytics": "analytics",
    "ai_assistant": "ai",
    "ai_analyst": "ai",
    "ai_pipeline": "ai",
    "ai_outreach": "ai",
    "ai_automation": "ai",
    "automations": "automations",
    "integrations": "integrations",
}


def default_capabilities(business_type):
    defaults = {module: True for module in MODULE_REGISTRY}
    if business_type == Business.BusinessTypes.DENTISTRY:
        defaults["deals"] = False
    return defaults


def ensure_business_capabilities(business, *, configured_by=None):
    defaults = default_capabilities(business.business_type)
    existing = {item.module_key: item for item in business.capabilities.all()}
    created = []
    for module_key, is_enabled in defaults.items():
        if module_key not in existing:
            created.append(
                BusinessCapability(
                    business=business,
                    module_key=module_key,
                    is_enabled=is_enabled,
                    configured_by=configured_by,
                )
            )
    if created:
        BusinessCapability.objects.bulk_create(created, ignore_conflicts=True)
    queryset = business.capabilities.all()
    business._capability_map = {item.module_key: item.is_enabled for item in queryset}
    return queryset


def apply_business_type_defaults(business, *, configured_by=None):
    defaults = default_capabilities(business.business_type)
    for module_key, is_enabled in defaults.items():
        BusinessCapability.objects.update_or_create(
            business=business,
            module_key=module_key,
            defaults={"is_enabled": is_enabled, "configured_by": configured_by},
        )
    if hasattr(business, "_capability_map"):
        del business._capability_map
    return business.capabilities.all()


def module_for_resource(resource):
    return RESOURCE_MODULES.get(resource)


def is_module_enabled(business, module_key):
    if not module_key:
        return True
    capability_map = getattr(business, "_capability_map", None)
    if capability_map is None:
        ensure_business_capabilities(business)
        capability_map = business._capability_map
    return capability_map.get(module_key, default_capabilities(business.business_type).get(module_key, True))


def resource_is_enabled(business, resource):
    return is_module_enabled(business, module_for_resource(resource))


def assert_resource_enabled(business, resource):
    module_key = module_for_resource(resource)
    if module_key and not is_module_enabled(business, module_key):
        raise ModuleDisabled(errors={"module": module_key})


def capability_payload(business):
    ensure_business_capabilities(business)
    enabled = business._capability_map
    return {
        "business": business.id,
        "business_type": business.business_type,
        "workflow_mode": "appointment_first" if business.business_type == Business.BusinessTypes.DENTISTRY else "standard_crm",
        "modules": {module: enabled.get(module, default_capabilities(business.business_type)[module]) for module in MODULE_REGISTRY},
    }
