from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from apps.integrations.models import ApiToken


API_TOKEN_HEADER = "HTTP_X_ZANI_API_KEY"


def _raw_api_token_from_request(request):
    header_token = str(request.META.get(API_TOKEN_HEADER, "") or "").strip()
    if header_token:
        return header_token
    authorization = str(request.META.get("HTTP_AUTHORIZATION", "") or "").strip()
    if not authorization:
        return ""
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationFailed("Invalid API token.")
    return parts[1].strip()


def authenticate_api_token(request, required_scope):
    raw_token = _raw_api_token_from_request(request)
    if not raw_token:
        raise AuthenticationFailed("API token is required.")
    prefix = raw_token[:16]
    for token in ApiToken.objects.select_related("business").filter(token_prefix=prefix, is_active=True):
        if token.matches(raw_token):
            if not token.is_usable():
                raise AuthenticationFailed("API token is expired or inactive.")
            if not token.has_scope(required_scope):
                raise PermissionDenied("API token does not have the required scope.")
            token.last_used_at = timezone.now()
            token.save(update_fields=["last_used_at", "updated_at"])
            return token
    raise AuthenticationFailed("Invalid API token.")
