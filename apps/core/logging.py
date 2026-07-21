import contextvars
import json
import logging
from datetime import datetime, timezone

from django.conf import settings


request_id_context = contextvars.ContextVar("request_id", default="")


class RequestContextFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_context.get("")
        record.release = getattr(settings, "RELEASE", "unknown")
        record.environment = getattr(settings, "ENVIRONMENT", "unknown")
        return True


class JsonLogFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", ""),
            "release": getattr(record, "release", "unknown"),
            "environment": getattr(record, "environment", "unknown"),
        }
        for key in ("method", "path", "status_code", "duration_ms", "user_id", "business_id", "job_id", "task_name"):
            value = getattr(record, key, None)
            if value not in (None, ""):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True, default=str)
