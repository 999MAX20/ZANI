import logging
import re
import time
import uuid

from apps.core.logging import request_id_context


REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
logger = logging.getLogger("zani.request")


class CorrelationIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        supplied = request.headers.get("X-Request-ID", "")
        request.correlation_id = supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else uuid.uuid4().hex
        token = request_id_context.set(request.correlation_id)
        started_at = time.monotonic()
        try:
            response = self.get_response(request)
            response["X-Request-ID"] = request.correlation_id
            logger.info(
                "request.completed",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status_code": response.status_code,
                    "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
                    "user_id": getattr(getattr(request, "user", None), "id", None),
                    "business_id": request.GET.get("business"),
                },
            )
            return response
        except Exception:
            logger.exception(
                "request.failed",
                extra={
                    "method": request.method,
                    "path": request.path,
                    "duration_ms": round((time.monotonic() - started_at) * 1000, 2),
                    "user_id": getattr(getattr(request, "user", None), "id", None),
                    "business_id": request.GET.get("business"),
                },
            )
            raise
        finally:
            request_id_context.reset(token)
