from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import jwt
from django.conf import settings
from django.db import transaction
from django.utils.text import slugify
from jwt import PyJWKClient
from rest_framework.exceptions import AuthenticationFailed, ValidationError

from apps.accounts.models import SocialIdentity, User
from apps.businesses.access import ensure_default_roles
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.crm.services import ensure_default_pipeline


GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
APPLE_ISSUER = "https://appleid.apple.com"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"


@dataclass(frozen=True)
class SocialUserClaims:
    provider: str
    subject: str
    email: str
    email_verified: bool
    full_name: str
    claims: dict[str, Any]


def _decode_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() == "true"
    return bool(value)


def _configured_audiences(provider: str) -> list[str]:
    if provider == SocialIdentity.Providers.GOOGLE:
        return [item for item in settings.GOOGLE_OAUTH_CLIENT_IDS if item]
    if provider == SocialIdentity.Providers.APPLE:
        return [item for item in settings.APPLE_OAUTH_CLIENT_IDS if item]
    return []


def _decode_id_token(provider: str, id_token: str) -> dict[str, Any]:
    audiences = _configured_audiences(provider)
    if not audiences:
        raise AuthenticationFailed(f"{provider.title()} OAuth client id is not configured.")

    jwks_url = GOOGLE_JWKS_URL if provider == SocialIdentity.Providers.GOOGLE else APPLE_JWKS_URL
    algorithms = ["RS256"]

    try:
        signing_key = PyJWKClient(jwks_url).get_signing_key_from_jwt(id_token).key
        claims = jwt.decode(
            id_token,
            signing_key,
            algorithms=algorithms,
            audience=audiences,
            options={"require": ["exp", "iat", "iss", "sub", "aud"]},
        )
        if provider == SocialIdentity.Providers.GOOGLE and claims.get("iss") not in GOOGLE_ISSUERS:
            raise AuthenticationFailed("Google identity token issuer is invalid.")
        if provider == SocialIdentity.Providers.APPLE and claims.get("iss") != APPLE_ISSUER:
            raise AuthenticationFailed("Apple identity token issuer is invalid.")
        return claims
    except jwt.PyJWTError as exc:
        raise AuthenticationFailed("Social identity token is invalid.") from exc


def verify_social_id_token(provider: str, id_token: str) -> SocialUserClaims:
    if provider not in SocialIdentity.Providers.values:
        raise ValidationError({"provider": "Unsupported social provider."})
    if not id_token:
        raise ValidationError({"id_token": "Identity token is required."})

    claims = _decode_id_token(provider, id_token)
    email = (claims.get("email") or "").strip().lower()
    subject = (claims.get("sub") or "").strip()
    if not email:
        raise AuthenticationFailed("Social identity token does not include an email address.")
    if not subject:
        raise AuthenticationFailed("Social identity token does not include a subject.")

    email_verified = _decode_bool(claims.get("email_verified", provider == SocialIdentity.Providers.APPLE))
    if provider == SocialIdentity.Providers.GOOGLE and not email_verified:
        raise AuthenticationFailed("Google email address is not verified.")

    full_name = (claims.get("name") or "").strip()
    return SocialUserClaims(
        provider=provider,
        subject=subject,
        email=email,
        email_verified=email_verified,
        full_name=full_name,
        claims=claims,
    )


def _unique_username(email: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_@.+-]", "-", email.split("@")[0] or "user")[:120]
    candidate = base
    counter = 1
    while User.objects.filter(username=candidate).exists():
        counter += 1
        candidate = f"{base}-{counter}"[:150]
    return candidate


def _unique_business_slug(email: str) -> str:
    base = slugify(email.split("@")[0] or "business") or "business"
    candidate = base[:50]
    counter = 1
    while Business.objects.filter(slug=candidate).exists():
        counter += 1
        suffix = f"-{counter}"
        candidate = f"{base[: 50 - len(suffix)]}{suffix}"
    return candidate


def _ensure_first_business(user: User) -> None:
    if not settings.SOCIAL_AUTH_AUTO_CREATE_MERCHANT:
        return
    if BusinessMember.objects.filter(user=user, is_active=True).exists():
        return

    business_name = f"{user.full_name or user.email.split('@')[0]} Workspace"
    business = Business.objects.create(
        owner=user,
        name=business_name,
        slug=_unique_business_slug(user.email),
        status=Business.Statuses.TRIAL,
    )
    ensure_default_roles(business)
    ensure_default_pipeline(business)
    owner_role = BusinessRole.objects.filter(
        business=business,
        preset_key=BusinessMember.Roles.OWNER,
        is_active=True,
    ).first()
    BusinessMember.objects.create(
        business=business,
        user=user,
        role=BusinessMember.Roles.OWNER,
        business_role=owner_role,
        is_active=True,
    )


@transaction.atomic
def get_or_create_social_user(claims: SocialUserClaims) -> tuple[User, bool]:
    identity = SocialIdentity.objects.select_related("user").filter(provider=claims.provider, subject=claims.subject).first()
    if identity:
        identity.email = claims.email
        identity.email_verified = claims.email_verified
        identity.raw_claims = claims.claims
        identity.save(update_fields=["email", "email_verified", "raw_claims", "updated_at"])
        return identity.user, False

    user = User.objects.filter(email=claims.email).first()
    created = False
    if user is None:
        user = User.objects.create_user(
            username=_unique_username(claims.email),
            email=claims.email,
            password=None,
            full_name=claims.full_name,
            role=User.Roles.BUSINESS_OWNER,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        created = True
        _ensure_first_business(user)
    elif claims.full_name and not user.full_name:
        user.full_name = claims.full_name
        user.save(update_fields=["full_name"])

    SocialIdentity.objects.create(
        user=user,
        provider=claims.provider,
        subject=claims.subject,
        email=claims.email,
        email_verified=claims.email_verified,
        raw_claims=claims.claims,
    )
    return user, created
