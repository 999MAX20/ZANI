import logging
import uuid

from django.conf import settings
from rest_framework.exceptions import MethodNotAllowed, NotAuthenticated, NotFound, PermissionDenied, Throttled, ValidationError
from rest_framework.response import Response
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR
from rest_framework.views import exception_handler as drf_exception_handler

from apps.core.domain_errors import DomainAPIException
from apps.core.logging import request_id_context


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
            },
            status=HTTP_500_INTERNAL_SERVER_ERROR,
        )

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
