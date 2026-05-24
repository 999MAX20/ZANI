from dataclasses import dataclass
from decimal import Decimal


KASPI_EVENT_TYPES = {
    "order_imported": "kaspi_order_imported",
    "sale_detected": "kaspi_sale_detected",
    "product_activity": "kaspi_product_activity",
}


@dataclass(frozen=True)
class KaspiReadOnlyEvent:
    event_type: str
    external_id: str
    payload: dict


def normalize_kaspi_amount(value):
    if value in (None, ""):
        return "0"
    return str(Decimal(str(value)))
