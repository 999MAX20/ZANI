from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User


def blacklist_refresh_token(raw_token):
    """Blacklist one valid refresh token without exposing why invalid tokens fail."""
    if not raw_token:
        return None, False

    try:
        refresh = RefreshToken(raw_token)
    except TokenError:
        return None, False

    user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
    user = None
    if user_id is not None:
        user = User.objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()

    _, created = refresh.blacklist()
    return user, created


@transaction.atomic
def revoke_user_refresh_sessions(user):
    """Blacklist every non-expired refresh session currently issued to a user."""
    tokens = list(
        OutstandingToken.objects.select_for_update()
        .filter(user=user, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True)
        .only("id")
    )
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in tokens],
        ignore_conflicts=True,
    )
    return len(tokens)


@transaction.atomic
def update_password_and_revoke_sessions(user, password, *, issue_replacement=False):
    """Change a password and revoke prior refresh sessions as one transaction."""
    user.set_password(password)
    user.save(update_fields=["password"])
    revoked_sessions = revoke_user_refresh_sessions(user)
    replacement = RefreshToken.for_user(user) if issue_replacement else None
    return revoked_sessions, replacement
