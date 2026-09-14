"""Generic API writes must not impersonate trusted messenger setup actions."""

import json
from contextlib import contextmanager

from django.db import transaction
from rest_framework.exceptions import ValidationError


MESSENGER_PROVIDERS = frozenset({"telegram", "whatsapp", "instagram"})
SETUP_REQUIRED_MESSAGE = "Use the dedicated channel setup action to change provider configuration."
REQUEST_FORM_FIELDS = {
    "whatsapp": {"company_name", "phone_number", "preferred_connection_type", "comment"},
    "instagram": {"instagram_username", "facebook_page", "contact_person", "comment"},
}


def _is_pending_request(config, provider):
    if not isinstance(config, dict) or set(config) != {"request_status", "form"}:
        return False
    form = config["form"]
    return (
        config["request_status"] == "pending_request"
        and provider in REQUEST_FORM_FIELDS
        and isinstance(form, dict)
        and set(form) <= REQUEST_FORM_FIELDS[provider]
        and all(isinstance(value, str) for value in form.values())
    )


def _discard_unchanged_field(attrs, field, current):
    if field not in attrs:
        return
    # Do not equate True with 1, or persist an echo over a concurrent setup.
    if json.dumps(attrs[field], sort_keys=True) != json.dumps(current, sort_keys=True):
        raise ValidationError({field: SETUP_REQUIRED_MESSAGE})
    attrs.pop(field)


def validate_channel_public_write(attrs, instance=None):
    if instance is not None:
        if "bot" in attrs and attrs["bot"].pk != instance.bot_id:
            raise ValidationError({"bot": "The channel owner cannot be changed."})
        _discard_unchanged_field(attrs, "channel", instance.channel)
        attrs.pop("bot", None)
    channel_type = instance.channel if instance is not None else attrs.get("channel")
    if channel_type not in MESSENGER_PROVIDERS:
        return attrs
    _discard_unchanged_field(attrs, "external_id", instance.external_id if instance else "")
    if instance is not None:
        _discard_unchanged_field(attrs, "config_json", instance.config_json or {})
    elif attrs.get("config_json") not in ({}, None, {"provider_mode": "mock"}):
        raise ValidationError({"config_json": SETUP_REQUIRED_MESSAGE})
    # Legacy bot detail may bootstrap an explicitly mock draft, never readiness.
    return attrs


def validate_connector_public_write(attrs, instance=None):
    provider = instance.provider if instance is not None else attrs.get("provider")
    proposed_provider = attrs.get("provider", provider)
    if provider not in MESSENGER_PROVIDERS and proposed_provider not in MESSENGER_PROVIDERS:
        return attrs
    if instance is not None:
        _discard_unchanged_field(attrs, "provider", instance.provider)
        _discard_unchanged_field(attrs, "auth_type", instance.auth_type)
    current_config = (instance.config_json or {}) if instance is not None else {}
    if not current_config.get("bot_channel_id") and _is_pending_request(attrs.get("config_json"), provider):
        return attrs
    _discard_unchanged_field(attrs, "config_json", current_config)
    return attrs


def assert_generic_credential_write_allowed(connector):
    if connector.provider in MESSENGER_PROVIDERS and (connector.config_json or {}).get("bot_channel_id") is not None:
        raise ValidationError({"connector": SETUP_REQUIRED_MESSAGE})


def valid_channel_binding_id(value):
    # Trusted writers store integers, never booleans or truncatable floats.
    return type(value) is int and 0 < value <= 2**63 - 1


def lock_channel_business(business_id):
    from apps.businesses.models import Business

    Business.objects.select_for_update().get(pk=business_id)


def lock_channel_for_setup(channel):
    from apps.bots.models import BotChannel

    lock_channel_business(channel.bot.business_id)
    return BotChannel.objects.select_for_update().select_related("bot").get(pk=channel.pk)


@contextmanager
def current_channel_setup(channel):
    """Commit a remote result only to the setup revision that was checked."""
    from apps.core.domain_errors import InvalidTransition

    with transaction.atomic():
        current = lock_channel_for_setup(channel)
        if (
            current.updated_at != channel.updated_at
            or current.bot_id != channel.bot_id
            or (current.config_json or {}).get("setup_revision") != (channel.config_json or {}).get("setup_revision")
        ):
            raise InvalidTransition(detail="Channel setup changed. Check the current connection again.")
        yield current
