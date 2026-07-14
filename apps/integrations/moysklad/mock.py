from apps.integrations.moysklad.base import MOYSKLAD_EVENT_TYPES


def build_moysklad_mock_events(prefix="moysklad-demo"):
    return [
        {
            "event_type": MOYSKLAD_EVENT_TYPES["product"],
            "external_id": f"{prefix}-product-1",
            "payload": {"sku": "MS-DEMO-SKU", "name": "Demo product", "source": "moysklad", "read_only": True},
        },
        {
            "event_type": MOYSKLAD_EVENT_TYPES["stock"],
            "external_id": f"{prefix}-stock-1",
            "payload": {"sku": "MS-DEMO-SKU", "quantity": "9", "source": "moysklad", "read_only": True},
        },
        {
            "event_type": MOYSKLAD_EVENT_TYPES["sale"],
            "external_id": f"{prefix}-sale-1",
            "payload": {"amount": "17000", "source": "moysklad", "read_only": True},
        },
        {
            "event_type": MOYSKLAD_EVENT_TYPES["client"],
            "external_id": f"{prefix}-client-1",
            "payload": {"client_name": "Demo customer", "source": "moysklad", "read_only": True},
        },
    ]
