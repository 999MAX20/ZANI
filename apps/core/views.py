from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.core.permissions import IsPlatformUser


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_GET
def health_db(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return JsonResponse({"status": "ok", "database": "ok"})


@require_GET
def readiness(request):
    checks = {"database": "unknown"}
    status_code = 200

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = "ok"
    except Exception as exc:  # pragma: no cover - exercised by deployment healthchecks
        checks["database"] = "failed"
        checks["database_error"] = exc.__class__.__name__
        status_code = 503

    return JsonResponse(
        {
            "status": "ok" if status_code == 200 else "degraded",
            "checks": checks,
            "checked_at": timezone.now().isoformat(),
        },
        status=status_code,
    )


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_ping(request):
    return Response({"status": "ok", "scope": "platform"})
