from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.models import User
from apps.core.audit import get_client_ip
from apps.core.models import LoginHistory
from apps.core.permissions import accessible_businesses


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
        else:
            record_login(request, status=LoginHistory.Statuses.FAILED)
        return response


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = "auth_refresh"
