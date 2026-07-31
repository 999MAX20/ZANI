from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.models import User
from apps.core.audit import get_client_ip
from apps.core.models import LoginHistory
from apps.core.permissions import accessible_businesses


def set_refresh_cookie(response, refresh_token):
    """Persist refresh credentials outside JavaScript-accessible storage."""
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )
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
            refresh_token = response.data.get("refresh")
            if refresh_token:
                set_refresh_cookie(response, refresh_token)
        else:
            record_login(request, status=LoginHistory.Statuses.FAILED)
        return response


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = "auth_refresh"

    def post(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get("refresh"):
            cookie_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
            if cookie_token:
                data["refresh"] = cookie_token
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            return clear_refresh_cookie(
                Response(
                    {"detail": str(exc), "code": "token_not_valid"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            )
        response = Response(serializer.validated_data)
        rotated_refresh = response.data.get("refresh")
        if rotated_refresh:
            set_refresh_cookie(response, rotated_refresh)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return clear_refresh_cookie(Response({"ok": True}))
