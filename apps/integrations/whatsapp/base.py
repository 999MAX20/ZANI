from dataclasses import dataclass


@dataclass(frozen=True)
class WhatsAppProviderDecision:
    provider_key: str
    label: str
    status: str
    next_step: str
    reason: str


def build_whatsapp_provider_decision(preferred_method, monthly_messages, has_meta_assets):
    method = (preferred_method or "not_sure").strip()
    try:
        volume = int(monthly_messages or 0)
    except (TypeError, ValueError):
        volume = 0

    if method == "meta_cloud" or (has_meta_assets and volume >= 500):
        return WhatsAppProviderDecision(
            provider_key="meta_cloud_placeholder",
            label="Meta Cloud API",
            status="provider_configuring",
            next_step="Проверить Business Manager, WABA и номер для официального подключения.",
            reason="Подходит официальный канал: есть Meta-активы или ожидается высокий объём сообщений.",
        )

    if method == "twilio":
        return WhatsAppProviderDecision(
            provider_key="twilio_placeholder",
            label="Twilio",
            status="provider_configuring",
            next_step="Проверить доступность Twilio WhatsApp для страны и номера.",
            reason="Мерчант выбрал Twilio как предпочитаемый канал.",
        )

    if method == "360dialog":
        return WhatsAppProviderDecision(
            provider_key="360dialog_placeholder",
            label="360dialog",
            status="provider_configuring",
            next_step="Проверить возможность подключения через 360dialog и требования к бизнесу.",
            reason="Мерчант выбрал 360dialog как предпочитаемый канал.",
        )

    if method == "qr_pilot" or volume < 500:
        return WhatsAppProviderDecision(
            provider_key="qr_pilot_placeholder",
            label="QR pilot",
            status="pending_request",
            next_step="Запустить support-assisted пилот без массовой рассылки и без обещания production API.",
            reason="Для пилота безопаснее начать с ручного подключения и ограниченного объёма.",
        )

    return WhatsAppProviderDecision(
        provider_key="provider_placeholder",
        label="Provider review",
        status="pending_request",
        next_step="ZANI support должен выбрать провайдера после проверки номера, страны и объёма.",
        reason="Недостаточно данных для безопасного автоматического выбора провайдера.",
    )
