from dataclasses import dataclass
from decimal import Decimal
import json
from urllib import parse, request as urllib_request

from django.conf import settings


@dataclass(frozen=True)
class CompetitorPrice:
    competitor_name: str
    price: Decimal
    position: int = 1
    competitor_merchant_id: str = ""
    available: bool = True
    payload: dict | None = None


class CompetitorPriceProvider:
    key = "base"

    def fetch_offers(self, rule):
        raise NotImplementedError


class MockKaspiCompetitorPriceProvider(CompetitorPriceProvider):
    key = "mock"

    def fetch_offers(self, rule):
        configured = (rule.config_json or {}).get("mock_competitor_price")
        if configured:
            price = Decimal(str(configured))
        else:
            price = max(Decimal(rule.min_price), Decimal(rule.current_price) - Decimal("100"))
        return [
            CompetitorPrice(
                competitor_name="Mock competitor",
                price=price,
                position=1,
                payload={"provider": self.key, "source": "local_mock"},
            )
        ]


class ExternalKaspiCompetitorPriceProvider(CompetitorPriceProvider):
    key = "external_api"

    def fetch_offers(self, rule):
        if not settings.KASPI_COMPETITOR_MONITOR_API_URL:
            raise ValueError("KASPI_COMPETITOR_MONITOR_API_URL is not configured.")
        params = {
            "sku": rule.product_sku,
            "kaspi_product_id": rule.kaspi_product_id,
        }
        url = f"{settings.KASPI_COMPETITOR_MONITOR_API_URL.rstrip('/')}?{parse.urlencode(params)}"
        headers = {"Accept": "application/json"}
        if settings.KASPI_COMPETITOR_MONITOR_API_KEY:
            headers["Authorization"] = f"Bearer {settings.KASPI_COMPETITOR_MONITOR_API_KEY}"
        request = urllib_request.Request(url, headers=headers, method="GET")
        with urllib_request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        items = payload.get("offers") if isinstance(payload, dict) else payload
        offers = []
        for index, item in enumerate(items or [], start=1):
            price = item.get("price")
            if price in (None, ""):
                continue
            offers.append(
                CompetitorPrice(
                    competitor_name=item.get("competitor_name") or item.get("merchant_name") or "Конкурент",
                    competitor_merchant_id=str(item.get("competitor_merchant_id") or item.get("merchant_id") or ""),
                    price=Decimal(str(price)),
                    position=int(item.get("position") or index),
                    available=bool(item.get("available", True)),
                    payload=item,
                )
            )
        return offers


def get_competitor_price_provider(provider_key=None):
    key = provider_key or settings.KASPI_COMPETITOR_MONITOR_PROVIDER
    if key == "external_api":
        return ExternalKaspiCompetitorPriceProvider()
    if key == "mock":
        return MockKaspiCompetitorPriceProvider()
    raise ValueError(f"Unknown competitor price provider: {key}")
