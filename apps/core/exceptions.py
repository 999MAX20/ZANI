from rest_framework.exceptions import MethodNotAllowed, NotAuthenticated, NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.views import exception_handler as drf_exception_handler


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    request_id = getattr(request, "correlation_id", "")
    code = _error_code(exc, response.data)
    original = response.data
    if isinstance(original, dict):
        payload = dict(original)
    else:
        payload = {"detail": "Request could not be processed.", "errors": original}
    payload.setdefault("code", code)
    payload.setdefault("request_id", request_id)
    if "errors" not in payload:
        field_errors = {key: value for key, value in original.items() if key not in {"detail", "code", "request_id"}} if isinstance(original, dict) else {}
        if field_errors:
            payload["errors"] = field_errors
    response.data = payload
    return response


def _error_code(exc, data):
    detail = str(data.get("detail", "")).lower() if isinstance(data, dict) else ""
    if isinstance(exc, NotAuthenticated):
        return "authentication_required"
    if isinstance(exc, PermissionDenied):
        if "business" in detail or "tenant" in detail:
            return "tenant_access_denied"
        return "permission_denied"
    if isinstance(exc, NotFound):
        return "not_found"
    if isinstance(exc, MethodNotAllowed):
        return "method_not_allowed"
    if isinstance(exc, Throttled):
        return "rate_limited"
    if isinstance(exc, ValidationError):
        if any(token in detail for token in ("already", "cannot", "conflict", "transition")):
            return "state_conflict"
        return "validation_error"
    return "request_failed"
