from django.db import connection
from django.http import JsonResponse
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


@api_view(["GET"])
@permission_classes([IsPlatformUser])
def platform_ping(request):
    return Response({"status": "ok", "scope": "platform"})
