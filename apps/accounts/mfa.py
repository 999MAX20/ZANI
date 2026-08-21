import hashlib
import secrets
from datetime import timedelta

import pyotp
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import MfaChallenge, MfaDevice, MfaRecoveryCode, User
from apps.businesses.models import BusinessMember
from apps.core.domain_errors import DomainAPIException
from apps.integrations.credential_encryption import decrypt_credential_value, encrypt_credential_value


MFA_CHALLENGE_BYTES = 32
MFA_RECOVERY_CODE_COUNT = 10
MFA_RECOVERY_CODE_BYTES = 12
MFA_MAX_CHALLENGE_ATTEMPTS = 5
MFA_STEP_UP_SALT = "zani.mfa.step-up.v1"
MFA_RECOVERY_HASH_SALT = "zani.mfa.recovery-code.v1"


class MfaChallengeInvalid(DomainAPIException):
    status_code = 401
    error_code = "mfa_challenge_invalid"
    default_code = error_code
    default_detail = "MFA challenge is unavailable or expired."


class MfaEnrollmentInvalid(DomainAPIException):
    status_code = 401
    error_code = "mfa_enrollment_invalid"
    default_code = error_code
    default_detail = "MFA enrollment is unavailable or expired."


class MfaCodeInvalid(DomainAPIException):
    status_code = 401
    error_code = "mfa_code_invalid"
    default_code = error_code
    default_detail = "The verification code is invalid."


class MfaStepUpRequired(DomainAPIException):
    status_code = 401
    error_code = "mfa_step_up_required"
    default_code = error_code
    default_detail = "Recent MFA confirmation is required."


class RecentAuthenticationFailed(DomainAPIException):
    status_code = 401
    error_code = "recent_auth_failed"
    default_code = error_code
    default_detail = "Recent authentication failed."


def is_privileged_mfa_user(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.role in {User.Roles.PLATFORM_ADMIN, User.Roles.BUSINESS_OWNER}:
        return True
    return BusinessMember.objects.filter(
        user=user,
        is_active=True,
        role__in={BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN},
    ).exists()


def has_confirmed_mfa(user):
    try:
        return user.mfa_device.is_confirmed
    except MfaDevice.DoesNotExist:
        return False


def requires_mfa(user):
    return has_confirmed_mfa(user) or (
        bool(getattr(settings, "AUTH_PRIVILEGED_MFA_REQUIRED", False)) and is_privileged_mfa_user(user)
    )


def issue_session(user, *, mfa_verified=False):
    refresh = RefreshToken.for_user(user)
    refresh["mfa_verified"] = bool(mfa_verified)
    refresh["auth_time"] = int(timezone.now().timestamp())
    return refresh


@transaction.atomic
def start_auth_challenge(user):
    purpose = MfaChallenge.Purposes.LOGIN if has_confirmed_mfa(user) else MfaChallenge.Purposes.ENROLLMENT
    if purpose == MfaChallenge.Purposes.ENROLLMENT:
        MfaDevice.objects.filter(user=user, confirmed_at__isnull=True).delete()
    token, challenge = _create_challenge(user, purpose)
    return {
        "code": "mfa_required" if purpose == MfaChallenge.Purposes.LOGIN else "mfa_enrollment_required",
        "challenge_token": token,
        "expires_at": challenge.expires_at,
        "method": "totp",
    }


def start_enrollment(*, challenge_token):
    with transaction.atomic():
        challenge = _resolve_challenge(challenge_token, MfaChallenge.Purposes.ENROLLMENT, lock=True)
        try:
            device = MfaDevice.objects.select_for_update().get(user=challenge.user)
        except MfaDevice.DoesNotExist:
            secret = pyotp.random_base32()
            device = MfaDevice.objects.create(
                user=challenge.user,
                encrypted_secret=encrypt_credential_value(secret),
            )
        else:
            if device.is_confirmed:
                raise ValidationError({"detail": "MFA is already enabled.", "code": "mfa_already_enabled"})
            secret = decrypt_credential_value(device.encrypted_secret)
        label = challenge.user.email
        uri = pyotp.TOTP(secret).provisioning_uri(name=label, issuer_name=settings.AUTH_MFA_ISSUER)
        return {
            "challenge_token": challenge_token,
            "manual_key": secret,
            "otpauth_uri": uri,
            "issuer": settings.AUTH_MFA_ISSUER,
            "account": label,
            "expires_at": challenge.expires_at,
        }


@transaction.atomic
def begin_authenticated_enrollment(user):
    if not is_privileged_mfa_user(user):
        raise ValidationError({"detail": "MFA is available to privileged accounts.", "code": "mfa_not_available"})
    MfaDevice.objects.filter(user=user, confirmed_at__isnull=True).delete()
    token, _ = _create_challenge(user, MfaChallenge.Purposes.ENROLLMENT)
    return start_enrollment(challenge_token=token)


def confirm_enrollment(*, challenge_token, code):
    failure = None
    with transaction.atomic():
        challenge = _resolve_challenge(challenge_token, MfaChallenge.Purposes.ENROLLMENT, lock=True)
        try:
            device = MfaDevice.objects.select_for_update().get(user=challenge.user, confirmed_at__isnull=True)
        except MfaDevice.DoesNotExist:
            _register_failure(challenge)
            failure = MfaEnrollmentInvalid()
        if failure is None and not _verify_totp(device, code, commit_counter=True):
            _register_failure(challenge)
            failure = MfaCodeInvalid()
        if failure is None:
            device.confirmed_at = timezone.now()
            device.save(update_fields=["confirmed_at", "last_used_counter", "updated_at"])
            recovery_codes = _replace_recovery_codes(challenge.user)
            _consume_challenge(challenge)
            result = (challenge.user, recovery_codes)
    if failure is not None:
        raise failure
    return result


def verify_login_challenge(*, challenge_token, code):
    failed = False
    with transaction.atomic():
        challenge = _resolve_challenge(challenge_token, MfaChallenge.Purposes.LOGIN, lock=True)
        if not verify_user_factor(challenge.user, code, allow_recovery=True):
            _register_failure(challenge)
            failed = True
        else:
            _consume_challenge(challenge)
            result = (challenge.user, issue_session(challenge.user, mfa_verified=True))
    if failed:
        raise MfaCodeInvalid()
    return result


@transaction.atomic
def verify_user_factor(user, code, *, allow_recovery):
    try:
        device = MfaDevice.objects.select_for_update().get(user=user, confirmed_at__isnull=False)
    except MfaDevice.DoesNotExist:
        return False
    if _verify_totp(device, code, commit_counter=True):
        return True
    return allow_recovery and _consume_recovery_code(user, code)


def issue_step_up_token(user, code):
    if not verify_user_factor(user, code, allow_recovery=True):
        raise MfaCodeInvalid()
    return signing.dumps(
        {"user_id": user.pk, "nonce": secrets.token_urlsafe(16)},
        salt=MFA_STEP_UP_SALT,
        compress=True,
    )


def validate_step_up_token(user, token):
    if not has_confirmed_mfa(user):
        raise MfaStepUpRequired()
    try:
        payload = signing.loads(
            token,
            salt=MFA_STEP_UP_SALT,
            max_age=settings.AUTH_MFA_STEP_UP_SECONDS,
        )
    except signing.BadSignature:
        raise MfaStepUpRequired() from None
    if payload.get("user_id") != user.pk:
        raise MfaStepUpRequired()
    return True


@transaction.atomic
def regenerate_recovery_codes(user, code):
    if not verify_user_factor(user, code, allow_recovery=True):
        raise MfaCodeInvalid()
    return _replace_recovery_codes(user)


@transaction.atomic
def disable_mfa(user, *, password, code):
    if not user.check_password(password):
        raise RecentAuthenticationFailed()
    if not verify_user_factor(user, code, allow_recovery=True):
        raise MfaCodeInvalid()
    MfaChallenge.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=timezone.now())
    MfaRecoveryCode.objects.filter(user=user).delete()
    MfaDevice.objects.filter(user=user).delete()


def mfa_status(user):
    confirmed = has_confirmed_mfa(user)
    try:
        confirmed_at = user.mfa_device.confirmed_at
    except MfaDevice.DoesNotExist:
        confirmed_at = None
    return {
        "available": is_privileged_mfa_user(user),
        "required": bool(getattr(settings, "AUTH_PRIVILEGED_MFA_REQUIRED", False)) and is_privileged_mfa_user(user),
        "enabled": confirmed,
        "method": "totp" if confirmed else None,
        "confirmed_at": confirmed_at,
        "recovery_codes_remaining": MfaRecoveryCode.objects.filter(user=user, used_at__isnull=True).count(),
    }


def _create_challenge(user, purpose):
    now = timezone.now()
    MfaChallenge.objects.filter(user=user, purpose=purpose, consumed_at__isnull=True).update(consumed_at=now)
    token = secrets.token_urlsafe(MFA_CHALLENGE_BYTES)
    challenge = MfaChallenge.objects.create(
        user=user,
        purpose=purpose,
        token_hash=_token_hash(token),
        expires_at=now + timedelta(seconds=settings.AUTH_MFA_CHALLENGE_SECONDS),
    )
    return token, challenge


def _resolve_challenge(token, purpose, *, lock):
    if not token:
        raise MfaChallengeInvalid()
    queryset = MfaChallenge.objects.select_related("user")
    if lock:
        queryset = queryset.select_for_update()
    challenge = queryset.filter(token_hash=_token_hash(token), purpose=purpose).first()
    now = timezone.now()
    if challenge is None or challenge.consumed_at is not None or challenge.expires_at <= now:
        raise MfaChallengeInvalid()
    if challenge.failed_attempts >= MFA_MAX_CHALLENGE_ATTEMPTS:
        raise MfaChallengeInvalid()
    return challenge


def _verify_totp(device, code, *, commit_counter):
    normalized = "".join(character for character in str(code or "") if character.isdigit())
    if len(normalized) != 6:
        return False
    secret = None
    try:
        secret = decrypt_credential_value(device.encrypted_secret)
        totp = pyotp.TOTP(secret)
        current_counter = totp.timecode(timezone.now())
        for counter in range(current_counter - 1, current_counter + 2):
            if secrets.compare_digest(totp.generate_otp(counter), normalized):
                if counter <= device.last_used_counter:
                    return False
                if commit_counter:
                    device.last_used_counter = counter
                    device.save(update_fields=["last_used_counter", "updated_at"])
                return True
        return False
    finally:
        secret = None


def _replace_recovery_codes(user):
    MfaRecoveryCode.objects.filter(user=user).delete()
    raw_codes = [_new_recovery_code() for _ in range(MFA_RECOVERY_CODE_COUNT)]
    MfaRecoveryCode.objects.bulk_create(
        [MfaRecoveryCode(user=user, code_hash=_recovery_code_hash(code)) for code in raw_codes]
    )
    return raw_codes


def _consume_recovery_code(user, raw_code):
    normalized = _normalize_recovery_code(raw_code)
    if len(normalized) < 10:
        return False
    recovery_code = MfaRecoveryCode.objects.select_for_update().filter(
        user=user,
        used_at__isnull=True,
        code_hash=_recovery_code_hash(normalized),
    ).first()
    if recovery_code is None:
        return False
    recovery_code.used_at = timezone.now()
    recovery_code.save(update_fields=["used_at"])
    return True


def _new_recovery_code():
    raw = secrets.token_hex(MFA_RECOVERY_CODE_BYTES).upper()
    return "-".join(raw[index : index + 8] for index in range(0, len(raw), 8))


def _normalize_recovery_code(value):
    return "".join(character for character in str(value or "").upper() if character.isalnum())


def _recovery_code_hash(value):
    return salted_hmac(
        MFA_RECOVERY_HASH_SALT,
        _normalize_recovery_code(value),
        secret=settings.SECRET_KEY,
        algorithm="sha256",
    ).hexdigest()


def _register_failure(challenge):
    challenge.failed_attempts += 1
    update_fields = ["failed_attempts"]
    if challenge.failed_attempts >= MFA_MAX_CHALLENGE_ATTEMPTS:
        challenge.consumed_at = timezone.now()
        update_fields.append("consumed_at")
    challenge.save(update_fields=update_fields)


def _consume_challenge(challenge):
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])


def _token_hash(token):
    return hashlib.sha256(str(token).encode("utf-8")).hexdigest()


def challenge_user(token, purpose):
    if not token:
        return None
    challenge = MfaChallenge.objects.select_related("user").filter(
        token_hash=_token_hash(token),
        purpose=purpose,
    ).first()
    return challenge.user if challenge else None
