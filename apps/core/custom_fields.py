from decimal import Decimal, InvalidOperation

from django.core.validators import URLValidator, validate_email
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError

from apps.core.models import CustomFieldDefinition, CustomFieldValue


def required_custom_fields_missing(*, business, entity_type, entity_id, required):
    references = [str(item).strip() for item in required or [] if str(item).strip()]
    if not references:
        return []

    definitions = list(CustomFieldDefinition.objects.filter(
        business=business,
        entity_type=entity_type,
    ).filter(_definition_reference_query(references)))
    active_definitions = [definition for definition in definitions if definition.is_active]
    values_by_definition = {
        value.definition_id: value
        for value in CustomFieldValue.objects.filter(
            business=business,
            entity_type=entity_type,
            entity_id=str(entity_id),
            definition__in=active_definitions,
        )
    }
    definitions_by_ref = {definition.key: definition for definition in definitions}
    definitions_by_ref.update({str(definition.id): definition for definition in definitions})

    missing = []
    for reference in references:
        definition = definitions_by_ref.get(reference)
        if definition is None:
            missing.append(reference)
            continue
        if not definition.is_active:
            continue
        value = values_by_definition.get(definition.id)
        if value is None or custom_field_value_is_empty(value.value_json):
            missing.append(definition.key)
    return missing


def custom_field_value_is_empty(value_json):
    if value_json in (None, "", [], {}):
        return True
    if not isinstance(value_json, dict):
        return False
    if "value" not in value_json:
        return False
    return value_json.get("value") in (None, "", [], {})


def validate_custom_field_value(*, definition, value_json):
    value_json = value_json or {}
    if not isinstance(value_json, dict):
        raise ValidationError({"value_json": "Custom field value must be an object."})
    if "value" not in value_json:
        if value_json:
            raise ValidationError({"value_json": "Custom field value must include a 'value' key."})
        return {}

    raw_value = value_json.get("value")
    if raw_value in (None, "", [], {}):
        return {**value_json, "value": raw_value}

    normalized = _normalize_value(definition, raw_value)
    return {**value_json, "value": normalized}


def _definition_reference_query(references):
    from django.db.models import Q

    query = Q(key__in=references)
    numeric_ids = [int(reference) for reference in references if reference.isdigit()]
    if numeric_ids:
        query |= Q(id__in=numeric_ids)
    return query


def _normalize_value(definition, value):
    field_type = definition.field_type
    if field_type in {
        CustomFieldDefinition.FieldTypes.TEXT,
        CustomFieldDefinition.FieldTypes.TEXTAREA,
        CustomFieldDefinition.FieldTypes.PHONE,
    }:
        if not isinstance(value, str):
            raise ValidationError({"value_json": "Value must be a string."})
        return value
    if field_type in {CustomFieldDefinition.FieldTypes.NUMBER, CustomFieldDefinition.FieldTypes.MONEY}:
        return _normalize_decimal(value)
    if field_type == CustomFieldDefinition.FieldTypes.DATE:
        if not isinstance(value, str) or parse_date(value) is None:
            raise ValidationError({"value_json": "Value must be an ISO date string."})
        return value
    if field_type == CustomFieldDefinition.FieldTypes.DATETIME:
        if not isinstance(value, str) or parse_datetime(value) is None:
            raise ValidationError({"value_json": "Value must be an ISO datetime string."})
        return value
    if field_type == CustomFieldDefinition.FieldTypes.SELECT:
        if not isinstance(value, str):
            raise ValidationError({"value_json": "Value must be a string option."})
        if value not in _allowed_options(definition):
            raise ValidationError({"value_json": "Value is not in the allowed options."})
        return value
    if field_type == CustomFieldDefinition.FieldTypes.MULTISELECT:
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise ValidationError({"value_json": "Value must be a list of string options."})
        allowed = _allowed_options(definition)
        if any(item not in allowed for item in value):
            raise ValidationError({"value_json": "One or more values are not in the allowed options."})
        return value
    if field_type == CustomFieldDefinition.FieldTypes.BOOLEAN:
        if not isinstance(value, bool):
            raise ValidationError({"value_json": "Value must be a boolean."})
        return value
    if field_type == CustomFieldDefinition.FieldTypes.EMAIL:
        if not isinstance(value, str):
            raise ValidationError({"value_json": "Value must be an email string."})
        try:
            validate_email(value)
        except Exception as exc:
            raise ValidationError({"value_json": "Value must be a valid email."}) from exc
        return value
    if field_type == CustomFieldDefinition.FieldTypes.URL:
        if not isinstance(value, str):
            raise ValidationError({"value_json": "Value must be a URL string."})
        try:
            URLValidator()(value)
        except Exception as exc:
            raise ValidationError({"value_json": "Value must be a valid URL."}) from exc
        return value
    return value


def _normalize_decimal(value):
    if isinstance(value, bool):
        raise ValidationError({"value_json": "Value must be numeric."})
    try:
        decimal = Decimal(str(value).replace(" ", "").replace(",", "."))
    except (InvalidOperation, ValueError):
        raise ValidationError({"value_json": "Value must be numeric."})
    if not decimal.is_finite():
        raise ValidationError({"value_json": "Value must be numeric."})
    return str(decimal)


def _allowed_options(definition):
    options = (definition.options_json or {}).get("options") or []
    allowed = []
    for option in options:
        if isinstance(option, dict):
            option_value = option.get("value", option.get("key", option.get("label")))
        else:
            option_value = option
        if option_value not in (None, ""):
            allowed.append(str(option_value))
    return set(allowed)
