from rest_framework.exceptions import ValidationError

from apps.core.models import ImportJob


MOYSKLAD_IMPORT_ENTITY_MAP = {
    "clients": ImportJob.EntityTypes.CLIENTS,
    "sales": ImportJob.EntityTypes.SALES,
    "products": ImportJob.EntityTypes.CATALOG,
    "stock": ImportJob.EntityTypes.CATALOG,
}


def moysklad_entity_to_import_type(entity):
    try:
        return MOYSKLAD_IMPORT_ENTITY_MAP[str(entity).strip().lower()]
    except KeyError as exc:
        raise ValidationError("Unsupported MoySklad lightweight import entity.") from exc
