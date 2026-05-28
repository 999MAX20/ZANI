from apps.integrations.ozon.base import OZON_EVENT_TYPES, OzonReadOnlyEvent, normalize_ozon_amount


def build_ozon_mock_events(prefix="ozon-demo"):
    return [
        OzonReadOnlyEvent(
            event_type=OZON_EVENT_TYPES["fbs_posting"],
            external_id=f"{prefix}-fbs-1",
            payload={
                "posting_number": f"{prefix}-fbs-1",
                "scheme": "fbs",
                "status": "awaiting_packaging",
                "amount": normalize_ozon_amount(17990),
                "products_count": 1,
                "read_only": True,
                "source": "ozon",
            },
        ),
        OzonReadOnlyEvent(
            event_type=OZON_EVENT_TYPES["fbo_posting"],
            external_id=f"{prefix}-fbo-1",
            payload={
                "posting_number": f"{prefix}-fbo-1",
                "scheme": "fbo",
                "status": "delivered",
                "amount": normalize_ozon_amount(12990),
                "products_count": 1,
                "read_only": True,
                "source": "ozon",
            },
        ),
        OzonReadOnlyEvent(
            event_type=OZON_EVENT_TYPES["stock"],
            external_id=f"{prefix}-stock-1",
            payload={
                "product_id": f"{prefix}-product-1",
                "offer_id": "OZON-DEMO-SKU",
                "total_stock": "12",
                "read_only": True,
                "source": "ozon",
            },
        ),
    ]
