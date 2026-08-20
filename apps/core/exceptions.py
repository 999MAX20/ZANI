import logging
import math
import uuid

from django.conf import settings
from rest_framework.exceptions import (
    AuthenticationFailed,
    MethodNotAllowed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR
from rest_framework.views import exception_handler as drf_exception_handler

from apps.core.domain_errors import DomainAPIException
from apps.core.logging import request_id_context
from apps.core.sanitization import sanitize_error_payload, sanitize_error_text


SAFE_PERMISSION_DETAIL = "You do not have permission to perform this action."
SAFE_NOT_FOUND_DETAIL = "The requested resource was not found."
SAFE_INTERNAL_DETAIL = "Something went wrong. Please try again."
VALIDATION_DETAIL = "Validation failed."
logger = logging.getLogger("zani.api")


def api_exception_handler(exc, context):
    request = context.get("request")
    request_id = _request_id(request)
    response = drf_exception_handler(exc, context)
    if response is None or (response.status_code >= 500 and not isinstance(exc, DomainAPIException)):
        _report_unhandled_exception(exc, request=request, request_id=request_id)
        return Response(
            {
                "code": "internal_error",
                "request_id": request_id,
                "detail": SAFE_INTERNAL_DETAIL,
                "errors": {},
                "category": "internal",
                "retryable": False,
                "retry_after_seconds": None,
            },
            status=HTTP_500_INTERNAL_SERVER_ERROR,
        )

    original = response.data
    payload = {
        "code": exc.error_code if isinstance(exc, DomainAPIException) else _error_code(exc),
        "request_id": request_id,
        "detail": _safe_detail(exc, original),
        "errors": sanitize_error_payload(_safe_errors(exc, original)),
        "category": exc.category if isinstance(exc, DomainAPIException) else _error_category(exc),
        "retryable": bool(exc.retryable) if isinstance(exc, DomainAPIException) else _is_retryable(exc),
        "retry_after_seconds": _retry_after_seconds(exc),
    }
    if isinstance(exc, ValidationError) and isinstance(payload["errors"], dict):
        payload.update(payload["errors"])
    response.data = payload
    return response


def _request_id(request):
    correlation_id = getattr(request, "correlation_id", "") if request is not None else ""
    return str(correlation_id or request_id_context.get("") or uuid.uuid4().hex)


def _report_unhandled_exception(exc, *, request, request_id):
    safe_context = _safe_request_context(request)
    log_context = {"request_id": request_id, **safe_context}
    logger.error(
        "api.unhandled_exception",
        exc_info=(type(exc), exc, exc.__traceback__),
        extra=log_context,
    )

    if not getattr(settings, "SENTRY_DSN", ""):
        return

    try:
        import sentry_sdk

        with sentry_sdk.new_scope() as scope:
            scope.set_tag("request_id", request_id)
            scope.set_tag("error_code", "internal_error")
            scope.set_context("zani_request", {"request_id": request_id, **safe_context})
            sentry_sdk.capture_exception(exc)
    except Exception:
        logger.exception("api.unhandled_exception_reporting_failed", extra=log_context)


def _safe_request_context(request):
    if request is None:
        return {}

    context = {}
    try:
        method = getattr(request, "method", "")
    except Exception:
        method = ""
    try:
        path = getattr(request, "path", "")
    except Exception:
        path = ""
    try:
        user = getattr(request, "_user", None)
        user_id = getattr(user, "pk", None) if getattr(user, "is_authenticated", False) else None
    except Exception:
        user_id = None

    if method:
        context["method"] = method
    if path:
        context["path"] = path
    if user_id is not None:
        context["user_id"] = user_id
    return context


def _error_code(exc):
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "authentication_required"
    if isinstance(exc, PermissionDenied):
        return "permission_denied"
    if isinstance(exc, NotFound):
        return "not_found"
    if isinstance(exc, MethodNotAllowed):
        return "method_not_allowed"
    if isinstance(exc, Throttled):
        return "rate_limited"
    if isinstance(exc, ValidationError):
        return "validation_error"
    return "request_failed"


def _error_category(exc):
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "authentication"
    if isinstance(exc, PermissionDenied):
        return "permission"
    if isinstance(exc, NotFound):
        return "not_found"
    if isinstance(exc, Throttled):
        return "rate_limit"
    if isinstance(exc, ValidationError):
        return "validation"
    return "validation"


def _is_retryable(exc):
    return isinstance(exc, Throttled)


def _retry_after_seconds(exc):
    value = getattr(exc, "retry_after_seconds", None) if isinstance(exc, DomainAPIException) else getattr(exc, "wait", None)
    if value in (None, ""):
        return None
    try:
        return max(0, math.ceil(float(value)))
    except (TypeError, ValueError):
        return None


def _safe_detail(exc, data):
    if isinstance(exc, DomainAPIException):
        return sanitize_error_text(_detail_from(data, exc.default_detail))
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        return "Authentication is required."
    if isinstance(exc, PermissionDenied):
        return SAFE_PERMISSION_DETAIL
    if isinstance(exc, NotFound):
        return SAFE_NOT_FOUND_DETAIL
    if isinstance(exc, Throttled):
        return "Too many requests. Please try again later."
    if isinstance(exc, ValidationError):
        return VALIDATION_DETAIL
    if isinstance(exc, MethodNotAllowed):
        return "This request method is not supported."
    return "Request could not be processed."


def _safe_errors(exc, data):
    if isinstance(exc, DomainAPIException):
        return exc.errors
    if isinstance(exc, ValidationError):
        return _field_errors(data)
    return {}


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
        if key not in {"detail", "code", "request_id", "errors", "category", "retryable", "retry_after_seconds"}
    }
