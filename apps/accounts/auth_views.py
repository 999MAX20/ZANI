from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.models import User
from apps.accounts.mfa import issue_session, requires_mfa, start_auth_challenge
from apps.accounts.session_security import blacklist_refresh_token, token_matches_auth_epoch
from apps.core.audit import get_client_ip, write_actor_audit_log
from apps.core.models import AuditLog, LoginHistory
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
        metadata={"event": "login", "outcome": status},
    )


def record_security_event(
    request,
    *,
    user,
    event,
    sessions_revoked=0,
    risk_level=AuditLog.RiskLevels.HIGH,
    metadata=None,
):
    """Record security-sensitive account activity without credential material."""
    return write_actor_audit_log(
        actor=user,
        action=AuditLog.Actions.UPDATE,
        instance=user,
        business=accessible_businesses(user).first(),
        metadata={
            "category": AuditLog.Categories.SECURITY,
            "risk_level": risk_level,
            "event": event,
            "sessions_revoked": sessions_revoked,
            **(metadata or {}),
        },
        ip_address=get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
    )


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_scope = "auth_login"

    def post(self, request, *args, **kwargs):
        identifier = request.data.get("email") or request.data.get("username") or ""
        user = authenticate(request=request, username=identifier, password=request.data.get("password"))
        if user is None:
            record_login(request, status=LoginHistory.Statuses.FAILED)
            raise AuthenticationFailed("No active account found with the given credentials.", code="no_active_account")
        if requires_mfa(user):
            return Response(start_auth_challenge(user), status=status.HTTP_202_ACCEPTED)

        refresh = issue_session(user, mfa_verified=False)
        update_last_login(None, user)
        record_login(request, user=user, email=user.email, status=LoginHistory.Statuses.SUCCESS)
        return set_refresh_cookie(Response({"access": str(refresh.access_token)}), str(refresh))


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = "auth_refresh"

    def post(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get("refresh"):
            cookie_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
            if cookie_token:
                data["refresh"] = cookie_token
        raw_refresh = data.get("refresh")
        if raw_refresh:
            try:
                refresh = RefreshToken(raw_refresh)
                user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
                user = User.objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()
                if not user or not token_matches_auth_epoch(user, refresh):
                    raise TokenError("Session epoch is no longer valid.")
                if user and requires_mfa(user) and not refresh.payload.get("mfa_verified"):
                    raise TokenError("MFA verification is required.")
            except TokenError:
                return clear_refresh_cookie(
                    Response(
                        {"detail": "Session expired or invalid.", "code": "token_not_valid"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
                )
        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return clear_refresh_cookie(
                Response(
                    {"detail": "Session expired or invalid.", "code": "token_not_valid"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            )
        response_data = dict(serializer.validated_data)
        rotated_refresh = response_data.pop("refresh", None)
        response = Response(response_data)
        if rotated_refresh:
            set_refresh_cookie(response, rotated_refresh)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        body_token = request.data.get("refresh") if hasattr(request.data, "get") else None
        raw_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or body_token
        user, revoked_sessions = blacklist_refresh_token(raw_token)
        if user is not None and revoked_sessions:
            record_security_event(
                request,
                user=user,
                event="logout",
                sessions_revoked=revoked_sessions,
                risk_level=AuditLog.RiskLevels.LOW,
            )
        return clear_refresh_cookie(Response({"ok": True}))
