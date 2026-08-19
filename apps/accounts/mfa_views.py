from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.accounts.auth_views import clear_refresh_cookie, record_login, record_security_event, set_refresh_cookie
from apps.accounts.mfa import (
    begin_authenticated_enrollment,
    challenge_user,
    confirm_enrollment,
    disable_mfa,
    has_confirmed_mfa,
    issue_session,
    issue_step_up_token,
    mfa_status,
    regenerate_recovery_codes,
    requires_mfa,
    start_auth_challenge,
    start_enrollment,
    verify_login_challenge,
    verify_user_factor,
)
from apps.accounts.session_security import revoke_user_refresh_sessions
from apps.accounts.models import MfaChallenge
from apps.core.models import AuditLog, LoginHistory


def _session_response(refresh, *, extra=None, status_code=status.HTTP_200_OK):
    payload = {"access": str(refresh.access_token), **(extra or {})}
    return set_refresh_cookie(Response(payload, status=status_code), str(refresh))


def _challenge_token(request):
    return request.data.get("challenge_token") if hasattr(request.data, "get") else None


class MfaEnrollmentStartView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        token = _challenge_token(request)
        if request.user.is_authenticated and not token:
            payload = begin_authenticated_enrollment(request.user)
        else:
            payload = start_enrollment(challenge_token=token)
        return Response(payload)


class MfaEnrollmentConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        audit_user = challenge_user(_challenge_token(request), MfaChallenge.Purposes.ENROLLMENT)
        try:
            user, recovery_codes = confirm_enrollment(
                challenge_token=_challenge_token(request),
                code=request.data.get("code"),
            )
        except Exception:
            if audit_user:
                record_security_event(request, user=audit_user, event="mfa_enrollment_failed")
            raise
        revoked_sessions = revoke_user_refresh_sessions(user)
        refresh = issue_session(user, mfa_verified=True)
        record_login(request, user=user, email=user.email, status=LoginHistory.Statuses.SUCCESS)
        record_security_event(
            request,
            user=user,
            event="mfa_enrolled",
            sessions_revoked=revoked_sessions,
            risk_level=AuditLog.RiskLevels.HIGH,
        )
        return _session_response(refresh, extra={"recovery_codes": recovery_codes})

class MfaVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        audit_user = challenge_user(_challenge_token(request), MfaChallenge.Purposes.LOGIN)
        try:
            user, refresh = verify_login_challenge(
                challenge_token=_challenge_token(request),
                code=request.data.get("code"),
            )
        except Exception:
            record_login(request, status=LoginHistory.Statuses.FAILED)
            if audit_user:
                record_security_event(request, user=audit_user, event="mfa_login_failed")
            raise
        record_login(request, user=user, email=user.email, status=LoginHistory.Statuses.SUCCESS)
        record_security_event(
            request,
            user=user,
            event="mfa_login_verified",
            risk_level=AuditLog.RiskLevels.LOW,
        )
        return _session_response(refresh)


class MfaStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = mfa_status(request.user)
        payload["active_sessions"] = OutstandingToken.objects.filter(
            user=request.user,
            expires_at__gt=timezone.now(),
            blacklistedtoken__isnull=True,
        ).count()
        return Response(payload)


class MfaStepUpView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        try:
            token = issue_step_up_token(request.user, request.data.get("code"))
        except Exception:
            record_security_event(request, user=request.user, event="mfa_step_up_failed")
            raise
        record_security_event(
            request,
            user=request.user,
            event="mfa_step_up_verified",
            risk_level=AuditLog.RiskLevels.LOW,
        )
        return Response({"step_up_token": token, "expires_in": settings.AUTH_MFA_STEP_UP_SECONDS})


class MfaRecoveryCodesView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        try:
            codes = regenerate_recovery_codes(request.user, request.data.get("code"))
        except Exception:
            record_security_event(request, user=request.user, event="mfa_recovery_codes_failed")
            raise
        record_security_event(request, user=request.user, event="mfa_recovery_codes_regenerated")
        return Response({"recovery_codes": codes})


class MfaDisableView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        reason = str(request.data.get("reason") or "").strip()
        if len(reason) < 8:
            return Response(
                {"detail": "A reason is required to disable MFA.", "code": "mfa_disable_reason_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            disable_mfa(
                request.user,
                password=request.data.get("password"),
                code=request.data.get("code"),
            )
        except Exception:
            record_security_event(request, user=request.user, event="mfa_disable_failed")
            raise
        revoked_sessions = revoke_user_refresh_sessions(request.user)
        record_security_event(
            request,
            user=request.user,
            event="mfa_disabled",
            sessions_revoked=revoked_sessions,
            risk_level=AuditLog.RiskLevels.CRITICAL,
            metadata={"reason": reason[:240]},
        )
        if requires_mfa(request.user):
            response = Response(
                {"ok": True, **start_auth_challenge(request.user)},
                status=status.HTTP_202_ACCEPTED,
            )
            return clear_refresh_cookie(response)
        refresh = issue_session(request.user, mfa_verified=False)
        return _session_response(refresh, extra={"ok": True})


class MfaRevokeSessionsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_mfa"

    def post(self, request):
        if has_confirmed_mfa(request.user) and not verify_user_factor(
            request.user,
            request.data.get("code"),
            allow_recovery=True,
        ):
            record_security_event(request, user=request.user, event="mfa_session_revoke_failed")
            return Response(
                {"detail": "The verification code is invalid.", "code": "mfa_code_invalid"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        revoked_sessions = revoke_user_refresh_sessions(request.user)
        refresh = issue_session(request.user, mfa_verified=has_confirmed_mfa(request.user))
        record_security_event(
            request,
            user=request.user,
            event="sessions_revoked",
            sessions_revoked=revoked_sessions,
        )
        return _session_response(refresh, extra={"sessions_revoked": revoked_sessions})
