from apps.integrations.wildberries.base import WILDBERRIES_EVENT_TYPES, WildberriesReadOnlyEvent, normalize_wildberries_amount


def build_wildberries_mock_events(prefix="wildberries-demo"):
    return [
        WildberriesReadOnlyEvent(
            event_type=WILDBERRIES_EVENT_TYPES["order"],
            external_id=f"{prefix}-order-1",
            payload={
                "order_id": f"{prefix}-order-1",
                "g_number": "WB-DEMO-ORDER",
                "nm_id": 1234567,
                "sku": "WB-DEMO-SKU",
                "amount": normalize_wildberries_amount(12990),
                "is_cancel": False,
                "read_only": True,
                "source": "wildberries",
            },
        ),
        WildberriesReadOnlyEvent(
            event_type=WILDBERRIES_EVENT_TYPES["sale"],
            external_id=f"{prefix}-sale-1",
            payload={
                "sale_id": f"{prefix}-sale-1",
                "g_number": "WB-DEMO-ORDER",
                "nm_id": 1234567,
                "sku": "WB-DEMO-SKU",
                "amount": normalize_wildberries_amount(11990),
                "read_only": True,
                "source": "wildberries",
            },
        ),
        WildberriesReadOnlyEvent(
            event_type=WILDBERRIES_EVENT_TYPES["stock"],
            external_id=f"{prefix}-stock-1",
            payload={
                "stock_id": f"{prefix}-stock-1",
                "nm_id": 1234567,
                "sku": "WB-DEMO-SKU",
                "warehouse_name": "Коледино",
                "quantity": normalize_wildberries_amount(8),
                "read_only": True,
                "source": "wildberries",
            },
        ),
    ]
