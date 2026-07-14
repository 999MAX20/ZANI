from apps.integrations.one_c.base import ONE_C_EVENT_TYPES


def build_one_c_mock_events(prefix="one-c-demo"):
    return [
        {
            "event_type": ONE_C_EVENT_TYPES["sale"],
            "external_id": f"{prefix}-sale-1",
            "payload": {"amount": "25000", "source": "1c", "read_only": True},
        },
        {
            "event_type": ONE_C_EVENT_TYPES["stock"],
            "external_id": f"{prefix}-stock-1",
            "payload": {"sku": "1C-DEMO-SKU", "quantity": "12", "source": "1c", "read_only": True},
        },
        {
            "event_type": ONE_C_EVENT_TYPES["product"],
            "external_id": f"{prefix}-product-1",
            "payload": {"sku": "1C-DEMO-SKU", "name": "Demo product", "source": "1c", "read_only": True},
        },
        {
            "event_type": ONE_C_EVENT_TYPES["client"],
            "external_id": f"{prefix}-client-1",
            "payload": {"client_name": "Demo counterparty", "source": "1c", "read_only": True},
        },
    ]
