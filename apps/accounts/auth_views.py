from django.conf import settings
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.models import User
from apps.core.audit import get_client_ip
from apps.core.models import LoginHistory
from apps.core.permissions import accessible_businesses


REFRESH_COOKIE_NAME = "zani_refresh_token"


def _refresh_cookie_name():
    return getattr(settings, "JWT_REFRESH_COOKIE_NAME", REFRESH_COOKIE_NAME)


def _refresh_cookie_max_age():
    lifetime = settings.SIMPLE_JWT.get("REFRESH_TOKEN_LIFETIME")
    return int(lifetime.total_seconds()) if lifetime else 7 * 24 * 60 * 60


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        _refresh_cookie_name(),
        str(refresh_token),
        max_age=_refresh_cookie_max_age(),
        httponly=True,
        secure=getattr(settings, "JWT_REFRESH_COOKIE_SECURE", settings.SESSION_COOKIE_SECURE),
        samesite=getattr(settings, "JWT_REFRESH_COOKIE_SAMESITE", "Lax"),
        path=getattr(settings, "JWT_REFRESH_COOKIE_PATH", "/api/auth/token/refresh/"),
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        _refresh_cookie_name(),
        path=getattr(settings, "JWT_REFRESH_COOKIE_PATH", "/api/auth/token/refresh/"),
        samesite=getattr(settings, "JWT_REFRESH_COOKIE_SAMESITE", "Lax"),
    )
    return response


def protect_refresh_token(response):
    refresh_token = response.data.get("refresh") if hasattr(response, "data") and isinstance(response.data, dict) else None
    if refresh_token:
        set_refresh_cookie(response, refresh_token)
        if not getattr(settings, "JWT_EXPOSE_REFRESH_TOKEN", False):
            response.data.pop("refresh", None)
    return response


def auth_token_response(refresh_token, data=None, status=200):
    payload = {"access": str(refresh_token.access_token), **(data or {})}
    if getattr(settings, "JWT_EXPOSE_REFRESH_TOKEN", False):
        payload["refresh"] = str(refresh_token)
    response = Response(payload, status=status)
    set_refresh_cookie(response, refresh_token)
    return response


def record_login(request, *, status, user=None, email=None):
    email = email or request.data.get("email") or request.data.get("username") or ""
    user = user or User.objects.filter(email=email).first() or User.objects.filter(username=email).first()
    business = accessible_businesses(user).first() if user else None
    LoginHistory.objects.create(
        business=business,
        user=user,
        email=email,
        status=status,
        ip_address=get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_scope = "auth_login"

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            record_login(request, status=LoginHistory.Statuses.FAILED)
            raise
        if response.status_code < 400:
            record_login(request, status=LoginHistory.Statuses.SUCCESS)
            protect_refresh_token(response)
        else:
            record_login(request, status=LoginHistory.Statuses.FAILED)
        return response


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = "auth_refresh"

    def post(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        refresh_from_cookie = request.COOKIES.get(_refresh_cookie_name(), "")
        if not data.get("refresh") and refresh_from_cookie:
            data["refresh"] = refresh_from_cookie

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError) as exc:
            response = Response({"detail": str(exc)}, status=401)
            clear_refresh_cookie(response)
            return response

        response = Response(serializer.validated_data, status=200)
        return protect_refresh_token(response)
