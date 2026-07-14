class KaspiProviderPlaceholder:
    provider = "kaspi"
    mode = "read_only_request"

    def healthcheck(self):
        return {
            "ok": False,
            "provider": self.provider,
            "mode": self.mode,
            "reason": "Kaspi API is support-assisted and not enabled for automatic marketplace operations.",
        }
