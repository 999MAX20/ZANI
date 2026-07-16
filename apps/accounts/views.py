from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.text import slugify
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.auth_views import auth_token_response, clear_refresh_cookie, record_login
from apps.accounts.serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    CurrentUserUpdateSerializer,
    OwnerSignupSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SocialAuthSerializer,
)
from apps.accounts.models import User
from apps.accounts.social_auth import get_or_create_social_user, verify_social_id_token
from apps.businesses.access import ensure_default_roles, ensure_owner_memberships_for_user
from apps.businesses.models import Business, BusinessMember, BusinessRole
from apps.core.models import LoginHistory
from apps.crm.services import ensure_default_pipeline


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_owner_memberships_for_user(request.user)
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = CurrentUserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CurrentUserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"ok": True})


class CurrentUserLoginHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = LoginHistory.objects.filter(user=request.user).order_by("-created_at")[:10]
        return Response(
            [
                {
                    "id": item.id,
                    "business": item.business_id,
                    "business_name": item.business.name if item.business else "",
                    "user": item.user_id,
                    "user_email": item.user.email if item.user else "",
                    "email": item.email,
                    "status": item.status,
                    "ip_address": item.ip_address,
                    "user_agent": item.user_agent,
                    "metadata": item.metadata,
                    "created_at": item.created_at,
                }
                for item in items
            ]
        )


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        response = Response({"ok": True})
        clear_refresh_cookie(response)
        return response


class SocialAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_social"

    def post(self, request):
        serializer = SocialAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claims = verify_social_id_token(
            serializer.validated_data["provider"],
            serializer.validated_data["id_token"],
        )
        user, created = get_or_create_social_user(claims)
        refresh = RefreshToken.for_user(user)
        record_login(request, user=user, email=user.email, status=LoginHistory.Statuses.SUCCESS)
        return auth_token_response(refresh, {"created": created, "provider": claims.provider})


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        response = {
            "ok": True,
            "message": "If this account exists, a password reset link will be sent.",
        }
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_path = f"/reset-password/{uid}/{token}"
            reset_url = self._build_reset_url(request, reset_path)
            send_mail(
                subject="Reset your Zani password",
                message=(
                    "We received a request to reset your Zani password.\n\n"
                    f"Open this link to set a new password: {reset_url}\n\n"
                    "If you did not request this, ignore this email."
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response(response)

    def _build_reset_url(self, request, reset_path):
        frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
        if frontend_url:
            return f"{frontend_url}{reset_path}"
        return request.build_absolute_uri(reset_path)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except Exception:
            user = None
        if user is None or not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "Invalid or expired reset link."}, status=400)
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        return Response({"ok": True})


class OwnerSignupView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_signup"

    def post(self, request):
        serializer = OwnerSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "Unable to create an account with the submitted details."}, status=400)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=data["password"],
            full_name=data.get("full_name", "").strip(),
            phone=data.get("phone", "").strip(),
            role=User.Roles.BUSINESS_OWNER,
            is_active=True,
        )
        business = Business.objects.create(
            owner=user,
            name=data["business_name"].strip(),
            slug=self._unique_business_slug(data["business_name"]),
            business_type=data.get("business_type") or Business.BusinessTypes.OTHER,
            city=data.get("city", "").strip(),
            phone=data.get("phone", "").strip(),
            whatsapp=data.get("phone", "").strip(),
            timezone="Asia/Almaty",
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
        refresh = RefreshToken.for_user(user)
        record_login(request, user=user, email=user.email, status=LoginHistory.Statuses.SUCCESS)
        return auth_token_response(
            refresh,
            {
                "user": CurrentUserSerializer(user).data,
                "business": {"id": business.id, "name": business.name, "slug": business.slug},
            },
            status=201,
        )

    def _unique_business_slug(self, name):
        base_slug = slugify(name) or "business"
        slug = base_slug
        counter = 2
        while Business.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug
