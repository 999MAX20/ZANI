import json
from urllib import request as urllib_request

from django.conf import settings


class KaspiPriceWriteResult:
    def __init__(self, ok, status, payload=None, error=""):
        self.ok = ok
        self.status = status
        self.payload = payload or {}
        self.error = error


class KaspiPriceWriteAdapter:
    key = "disabled"

    def update_price(self, change):
        return KaspiPriceWriteResult(False, "failed", error="Kaspi price write adapter is not configured.")


class KaspiPriceFeedWriteAdapter(KaspiPriceWriteAdapter):
    key = "price_feed"

    def update_price(self, change):
        return KaspiPriceWriteResult(
            True,
            "queued",
            {
                "provider": self.key,
                "note": "Queued for Kaspi price feed/XML export. Direct Kaspi price endpoint is not configured.",
                "sku": change.rule.product_sku,
                "price": str(change.new_price),
            },
        )


class ExternalKaspiPriceWriteAdapter(KaspiPriceWriteAdapter):
    key = "external_api"

    def update_price(self, change):
        if not settings.KASPI_PRICE_WRITE_API_URL:
            return KaspiPriceWriteResult(False, "failed", error="KASPI_PRICE_WRITE_API_URL is empty.")
        payload = {
            "business_id": change.business_id,
            "rule_id": change.rule_id,
            "sku": change.rule.product_sku,
            "kaspi_product_id": change.rule.kaspi_product_id,
            "old_price": str(change.old_price),
            "new_price": str(change.new_price),
            "change_id": change.id,
        }
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if settings.KASPI_PRICE_WRITE_API_KEY:
            headers["Authorization"] = f"Bearer {settings.KASPI_PRICE_WRITE_API_KEY}"
        request = urllib_request.Request(settings.KASPI_PRICE_WRITE_API_URL, data=body, headers=headers, method="POST")
        try:
            with urllib_request.urlopen(request, timeout=20) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw) if raw else {}
                return KaspiPriceWriteResult(True, "queued", {"provider": self.key, "response": data})
        except Exception as exc:
            return KaspiPriceWriteResult(False, "failed", error=str(exc))


def get_kaspi_price_write_adapter(provider_key=None):
    key = provider_key or settings.KASPI_PRICE_WRITE_PROVIDER
    if key == ExternalKaspiPriceWriteAdapter.key:
        return ExternalKaspiPriceWriteAdapter()
    if key == KaspiPriceFeedWriteAdapter.key:
        return KaspiPriceFeedWriteAdapter()
    return KaspiPriceWriteAdapter()
