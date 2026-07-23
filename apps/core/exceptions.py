from rest_framework.exceptions import MethodNotAllowed, NotAuthenticated, NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

from apps.core.domain_errors import DomainAPIException


SAFE_PERMISSION_DETAIL = "You do not have permission to perform this action."
SAFE_NOT_FOUND_DETAIL = "The requested resource was not found."
VALIDATION_DETAIL = "Validation failed."


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    request_id = getattr(request, "correlation_id", "")
    original = response.data
    if isinstance(exc, DomainAPIException):
        payload = {
            "code": exc.error_code,
            "request_id": request_id,
            "detail": _detail_from(original, exc.default_detail),
            "errors": exc.errors,
        }
    elif isinstance(exc, PermissionDenied):
        payload = {
            "code": "permission_denied",
            "request_id": request_id,
            "detail": SAFE_PERMISSION_DETAIL,
            "errors": {},
        }
    elif isinstance(exc, NotFound):
        payload = {
            "code": "not_found",
            "request_id": request_id,
            "detail": SAFE_NOT_FOUND_DETAIL,
            "errors": {},
        }
    else:
        payload = dict(original) if isinstance(original, dict) else {}
        field_errors = _field_errors(original)
        payload["code"] = _error_code(exc)
        payload["request_id"] = request_id
        payload.setdefault("detail", VALIDATION_DETAIL if isinstance(exc, ValidationError) else "Request could not be processed.")
        payload["errors"] = payload.get("errors", field_errors)
    response.data = payload
    return response


def _error_code(exc):
    if isinstance(exc, NotAuthenticated):
        return "authentication_required"
    if isinstance(exc, MethodNotAllowed):
        return "method_not_allowed"
    if isinstance(exc, Throttled):
        return "rate_limited"
    if isinstance(exc, ValidationError):
        return "validation_error"
    return "request_failed"


def _detail_from(data, default):
    if isinstance(data, dict) and "detail" in data:
        return str(data["detail"])
    return str(default)


def _field_errors(data):
    if not isinstance(data, dict):
        return data if data not in (None, "") else {}
    return {
        key: value
        for key, value in data.items()
        if key not in {"detail", "code", "request_id", "errors"}
    }
