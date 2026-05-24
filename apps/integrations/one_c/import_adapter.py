from rest_framework.exceptions import ValidationError

from apps.core.models import ImportJob


ONE_C_IMPORT_ENTITY_MAP = {
    "clients": ImportJob.EntityTypes.CLIENTS,
    "counterparties": ImportJob.EntityTypes.CLIENTS,
    "sales": ImportJob.EntityTypes.SALES,
    "products": ImportJob.EntityTypes.CATALOG,
    "stock": ImportJob.EntityTypes.CATALOG,
}


def one_c_entity_to_import_type(entity):
    try:
        return ONE_C_IMPORT_ENTITY_MAP[str(entity).strip().lower()]
    except KeyError as exc:
        raise ValidationError("Unsupported 1C lightweight import entity.") from exc
