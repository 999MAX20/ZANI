from apps.integrations.kaspi.base import KASPI_EVENT_TYPES, KaspiReadOnlyEvent, normalize_kaspi_amount


def build_kaspi_mock_events(prefix="kaspi-demo"):
    return [
        KaspiReadOnlyEvent(
            event_type=KASPI_EVENT_TYPES["order_imported"],
            external_id=f"{prefix}-order-1",
            payload={
                "order_id": f"{prefix}-order-1",
                "amount": normalize_kaspi_amount(18500),
                "status": "new",
                "read_only": True,
                "source": "kaspi",
            },
        ),
        KaspiReadOnlyEvent(
            event_type=KASPI_EVENT_TYPES["sale_detected"],
            external_id=f"{prefix}-sale-1",
            payload={
                "sale_id": f"{prefix}-sale-1",
                "amount": normalize_kaspi_amount(18500),
                "read_only": True,
                "source": "kaspi",
            },
        ),
        KaspiReadOnlyEvent(
            event_type=KASPI_EVENT_TYPES["product_activity"],
            external_id=f"{prefix}-product-1",
            payload={
                "sku": "KASPI-DEMO-SKU",
                "activity": "viewed_or_ordered",
                "read_only": True,
                "source": "kaspi",
            },
        ),
    ]
