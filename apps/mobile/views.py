from datetime import datetime, timezone as datetime_timezone

from django.conf import settings
from django.db.models import Count
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.serializers import CurrentUserSerializer
from apps.ai_core.models import ApprovalRequest
from apps.ai_core.services import approval_resource_for_action, approve_approval_request, reject_approval_request
from apps.businesses.access import Actions, Resources, assert_can, scope_queryset
from apps.bots.inbox_service import send_outbound_message
from apps.bots.models import BotConversation
from apps.core.audit import get_client_ip
from apps.core.permissions import accessible_businesses
from apps.integrations.connectors import encrypt_credential_value
from apps.mobile.idempotency import run_idempotent_mobile_action
from apps.mobile.models import MobileDevice, MobileIdempotencyKey, MobilePushToken, MobileSession
from apps.mobile.observability import mobile_telemetry_summary, record_mobile_event
from apps.mobile.selectors import (
    build_mobile_actions,
    build_mobile_appointments,
    build_mobile_appointment_detail,
    build_mobile_clients,
    build_mobile_client_detail,
    build_mobile_conversation_detail,
    build_mobile_home,
    build_mobile_inbox,
    build_mobile_leads,
    build_mobile_lead_detail,
    build_mobile_notifications,
    build_mobile_tasks,
    build_mobile_task_detail,
    build_mobile_today,
    mobile_appointment_item,
    mobile_approval_item,
    mobile_conversation_item,
    mobile_lead_item,
    mobile_message_item,
    mobile_notification_item,
    mobile_task_item,
)
from apps.mobile.serializers import (
    MobileDeviceRegisterSerializer,
    MobileDeviceSerializer,
    MobileLoginSerializer,
    MobileLogoutSerializer,
    MobilePushTokenRegisterSerializer,
    MobileRefreshSerializer,
    MobilePushTokenSerializer,
    compact_business_payload,
    resolve_mobile_business,
    upsert_mobile_device,
)
from apps.tasks.models import Task
from apps.tasks.services import assign_task_to_me, cancel_task, complete_task, snooze_task
from apps.leads.models import Lead
from apps.leads.services import assign_lead, take_lead_in_work
from apps.notifications.models import Notification, NotificationPreference
from apps.scheduling.models import Appointment
from apps.scheduling.models import Resource
from apps.scheduling.services import cancel_appointment, confirm_appointment, reschedule_appointment


def _token_expires_at(token):
    exp = token.payload.get("exp")
    if not exp:
        return None
    return datetime.fromtimestamp(int(exp), tz=datetime_timezone.utc)


def _create_mobile_session(*, user, business, device, refresh):
    return MobileSession.objects.create(
        business=business,
        user=user,
        device=device,
        refresh_jti=refresh.payload.get("jti", ""),
        last_seen_at=timezone.now(),
        expires_at=_token_expires_at(refresh),
    )


def _mobile_token_payload(*, user, business, refresh, device):
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "token_type": "Bearer",
        "business": compact_business_payload(user, business),
        "device": MobileDeviceSerializer(device).data,
    }


def _mobile_version_policy():
    return {
        "min_supported_version": settings.MOBILE_APP_MIN_SUPPORTED_VERSION,
        "latest_version": settings.MOBILE_APP_LATEST_VERSION,
        "update_urls": {
            "ios": settings.MOBILE_APP_UPDATE_URL_IOS,
            "android": settings.MOBILE_APP_UPDATE_URL_ANDROID,
        },
    }


class MobileLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_auth_login"

    def post(self, request):
        serializer = MobileLoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        business = serializer.validated_data["business_obj"]
        device = upsert_mobile_device(
            user=user,
            business=business,
            attrs=serializer.validated_data,
            ip_address=get_client_ip(request),
        )
        refresh = RefreshToken.for_user(user)
        _create_mobile_session(user=user, business=business, device=device, refresh=refresh)
        return Response(_mobile_token_payload(user=user, business=business, refresh=refresh, device=device))


class MobileRefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_auth_refresh"

    def post(self, request):
        serializer = MobileRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_refresh = serializer.validated_data.get("refresh", "")
        try:
            refresh = RefreshToken(raw_refresh)
        except TokenError:
            return Response({"detail": "Invalid or expired refresh token."}, status=401)
        old_jti = refresh.payload.get("jti", "")
        session = (
            MobileSession.objects.select_related("business", "device", "user")
            .filter(refresh_jti=old_jti, status=MobileSession.Statuses.ACTIVE)
            .first()
        )
        if not session or session.device.revoked_at:
            return Response({"detail": "Mobile session is not active."}, status=401)

        token_serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            token_serializer.is_valid(raise_exception=True)
        except (InvalidToken, TokenError):
            session.revoke("refresh_rejected")
            return Response({"detail": "Invalid or expired refresh token."}, status=401)
        data = dict(token_serializer.validated_data)
        new_refresh_value = data.get("refresh") or raw_refresh
        new_refresh = RefreshToken(new_refresh_value)
        session.refresh_jti = new_refresh.payload.get("jti", "")
        session.expires_at = _token_expires_at(new_refresh)
        session.last_seen_at = timezone.now()
        session.save(update_fields=["refresh_jti", "expires_at", "last_seen_at", "updated_at"])
        session.device.mark_seen(ip_address=get_client_ip(request))
        return Response({"access": data["access"], "refresh": new_refresh_value, "token_type": "Bearer"})


class MobileLogoutView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_auth_refresh"

    def post(self, request):
        serializer = MobileLogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_refresh = serializer.validated_data.get("refresh", "")
        if raw_refresh:
            try:
                refresh = RefreshToken(raw_refresh)
                session = MobileSession.objects.filter(
                    user=request.user,
                    refresh_jti=refresh.payload.get("jti", ""),
                    status=MobileSession.Statuses.ACTIVE,
                ).first()
                if session:
                    session.revoke("user_logout")
                refresh.blacklist()
            except Exception:
                pass
        return Response({"ok": True})


class MobileDeviceRegisterView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_device_register"

    def post(self, request):
        serializer = MobileDeviceRegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        device = upsert_mobile_device(
            user=request.user,
            business=serializer.validated_data["business_obj"],
            attrs=serializer.validated_data,
            ip_address=get_client_ip(request),
        )
        return Response(MobileDeviceSerializer(device).data, status=201)


class MobileDeviceListView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        devices = MobileDevice.objects.filter(business=business, user=request.user).order_by("-last_seen_at", "-updated_at", "-id")
        return Response(
            {
                "business": business.id,
                "generated_at": timezone.now(),
                "items": MobileDeviceSerializer(devices, many=True).data,
            }
        )


class MobileDeviceRevokeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_device_register"

    def post(self, request, device_id):
        business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
        device = MobileDevice.objects.filter(business=business, user=request.user, id=device_id).first()
        if not device:
            return Response({"detail": "Mobile device was not found."}, status=404)
        device.revoke("user_revoked")
        revoked_sessions = MobileSession.objects.filter(
            business=business,
            user=request.user,
            device=device,
            status=MobileSession.Statuses.ACTIVE,
        )
        session_count = revoked_sessions.count()
        for session in revoked_sessions:
            session.revoke("device_revoked")
        push_tokens = MobilePushToken.objects.filter(business=business, user=request.user, device=device, is_active=True)
        push_count = push_tokens.count()
        for push_token in push_tokens:
            push_token.revoke("device_revoked")
        return Response(
            {
                "ok": True,
                "device": MobileDeviceSerializer(device).data,
                "revoked_sessions": session_count,
                "revoked_push_tokens": push_count,
            }
        )


class MobileOperationalSummaryView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(
            {
                "business": business.id,
                "generated_at": timezone.now(),
                "devices": {
                    "total": MobileDevice.objects.filter(business=business).count(),
                    "active": MobileDevice.objects.filter(business=business, revoked_at__isnull=True).count(),
                    "revoked": MobileDevice.objects.filter(business=business, revoked_at__isnull=False).count(),
                },
                "sessions": {
                    "active": MobileSession.objects.filter(business=business, status=MobileSession.Statuses.ACTIVE).count(),
                    "revoked": MobileSession.objects.filter(business=business, status=MobileSession.Statuses.REVOKED).count(),
                    "expired": MobileSession.objects.filter(business=business, status=MobileSession.Statuses.EXPIRED).count(),
                },
                "push_tokens": {
                    "active": MobilePushToken.objects.filter(business=business, is_active=True, revoked_at__isnull=True).count(),
                    "revoked": MobilePushToken.objects.filter(business=business, is_active=False).count(),
                },
                "idempotency": {
                    row["endpoint"]: row["count"]
                    for row in MobileIdempotencyKey.objects.filter(business=business).values("endpoint").annotate(count=Count("id"))
                },
                "telemetry": mobile_telemetry_summary(business=business),
            }
        )


class MobilePushTokenRegisterView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_push_register"

    def post(self, request):
        serializer = MobilePushTokenRegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        push_token, _ = MobilePushToken.objects.update_or_create(
            business=serializer.validated_data["business_obj"],
            user=request.user,
            device=serializer.validated_data["device"],
            provider=serializer.validated_data["provider"],
            token_hash=serializer.validated_data["token_hash"],
            defaults={
                "encrypted_token": encrypt_credential_value(serializer.validated_data["push_token"]),
                "is_active": True,
                "last_seen_at": timezone.now(),
                "revoked_at": None,
                "revoked_reason": "",
            },
        )
        return Response(MobilePushTokenSerializer(push_token).data, status=201)


class MobileBootstrapView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_bootstrap"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        businesses = [compact_business_payload(request.user, item) for item in accessible_businesses(request.user)]
        return Response(
            {
                "api_version": settings.MOBILE_API_VERSION,
                "server_time": timezone.now(),
                "user": CurrentUserSerializer(request.user).data,
                "active_business": compact_business_payload(request.user, business),
                "businesses": businesses,
                "version_policy": _mobile_version_policy(),
                "feature_flags": {
                    "push_registration": True,
                    "offline_queue": False,
                    "mobile_writes": True,
                    "task_complete_write": True,
                    "task_lifecycle_writes": True,
                    "lead_assign_write": True,
                    "lead_qualify_write": True,
                    "inbox_reply_write": True,
                    "appointment_lifecycle_writes": True,
                    "ai_approval_writes": True,
                },
                "budgets": {
                    "bootstrap_kb": 30,
                    "home_kb": 50,
                    "list_kb": 100,
                },
            }
        )


class MobileHomeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_home"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(build_mobile_home(user=request.user, business=business, limit=request.query_params.get("limit") or 5))


class MobileTodayView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(
            build_mobile_today(
                user=request.user,
                business=business,
                date_value=request.query_params.get("date"),
                limit=request.query_params.get("limit") or 20,
            )
        )


class MobileActionsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_home"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(build_mobile_actions(user=request.user, business=business, limit=request.query_params.get("limit") or 20))


class MobileInboxView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(build_mobile_inbox(user=request.user, business=business, limit=request.query_params.get("limit") or 20))


class MobileInboxDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request, conversation_id):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        payload = build_mobile_conversation_detail(
            user=request.user,
            business=business,
            conversation_id=conversation_id,
            limit=request.query_params.get("limit") or 30,
        )
        if payload is None:
            raise NotFound("Conversation was not found.")
        return Response(payload)


class MobileInboxReplyView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, conversation_id):
        business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
        conversation = _mobile_write_conversation_queryset(request.user, business).filter(id=conversation_id).first()
        if not conversation:
            return Response({"detail": "Conversation was not found."}, status=404)
        assert_can(request.user, business, Resources.CONVERSATIONS, Actions.UPDATE, obj=conversation)
        stale_response = _assert_not_stale(request, conversation)
        if stale_response:
            return stale_response
        text = (request.data.get("text") or "").strip()
        if not text:
            raise ValidationError({"text": "This field is required."})

        def action():
            message = send_outbound_message(conversation, text, request.user)
            conversation.refresh_from_db()
            return 200, {
                "ok": True,
                "conversation": mobile_conversation_item(conversation),
                "message": mobile_message_item(message),
            }

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.inbox.reply",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileLeadsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(
            build_mobile_leads(
                user=request.user,
                business=business,
                limit=request.query_params.get("limit") or 20,
                status=request.query_params.get("status") or "",
                search=request.query_params.get("search") or "",
            )
        )


class MobileLeadDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request, lead_id):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        payload = build_mobile_lead_detail(user=request.user, business=business, lead_id=lead_id)
        if payload is None:
            raise NotFound("Lead was not found.")
        return Response(payload)


class MobileLeadAssignView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, lead_id):
        business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
        lead = _mobile_write_lead_queryset(request.user, business).filter(id=lead_id).first()
        if not lead:
            return Response({"detail": "Lead was not found."}, status=404)
        assert_can(request.user, business, Resources.LEADS, Actions.UPDATE, obj=lead)
        stale_response = _assert_not_stale(request, lead)
        if stale_response:
            return stale_response

        def action():
            assigned = assign_lead(
                lead=lead,
                actor=request.user,
                user_id=request.data.get("user_id") or request.user.id,
                request=request,
            )
            return 200, {"ok": True, "lead": mobile_lead_item(assigned)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.leads.assign",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileLeadQualifyView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, lead_id):
        business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
        lead = _mobile_write_lead_queryset(request.user, business).filter(id=lead_id).first()
        if not lead:
            return Response({"detail": "Lead was not found."}, status=404)
        assert_can(request.user, business, Resources.LEADS, Actions.UPDATE, obj=lead)
        stale_response = _assert_not_stale(request, lead)
        if stale_response:
            return stale_response

        def action():
            if not lead.responsible_user_id:
                assign_lead(lead=lead, actor=request.user, user_id=request.user.id, request=request)
            qualified = take_lead_in_work(lead=lead, actor=request.user, request=request)
            return 200, {"ok": True, "lead": mobile_lead_item(qualified)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.leads.qualify",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileNotificationsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        unread_only = (request.query_params.get("unread") or "").lower() in {"1", "true", "yes"}
        return Response(
            build_mobile_notifications(
                user=request.user,
                business=business,
                limit=request.query_params.get("limit") or 20,
                unread_only=unread_only,
            )
        )


class MobileNotificationPreferencesView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(_mobile_notification_preferences_payload(user=request.user, business=business))

    def post(self, request):
        business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
        category = request.data.get("category")
        if category not in Notification.Categories.values:
            raise ValidationError({"category": "Unsupported notification category."})

        defaults = {}
        if "in_app_enabled" in request.data:
            defaults["in_app_enabled"] = bool(request.data.get("in_app_enabled"))
        if "push_enabled" in request.data:
            defaults["push_enabled"] = bool(request.data.get("push_enabled"))
        if "privacy_mode" in request.data:
            privacy_mode = request.data.get("privacy_mode")
            if privacy_mode not in NotificationPreference.PrivacyModes.values:
                raise ValidationError({"privacy_mode": "Unsupported privacy mode."})
            defaults["privacy_mode"] = privacy_mode
        if not defaults:
            raise ValidationError({"detail": "No notification preference fields were provided."})

        NotificationPreference.objects.update_or_create(
            business=business,
            user=request.user,
            category=category,
            defaults=defaults,
        )
        return Response(_mobile_notification_preferences_payload(user=request.user, business=business))


class MobileNotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, notification_id):
        business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
        notification = (
            Notification.objects.select_related("business", "client", "appointment", "recipient")
            .filter(business=business, id=notification_id)
            .exclude(
                Q(action_url__startswith="/app/conversations")
                & Q(recipient__isnull=False)
                & ~Q(recipient=request.user)
            )
            .first()
        )
        if not notification:
            return Response({"detail": "Notification was not found."}, status=404)
        assert_can(request.user, business, Resources.NOTIFICATIONS, Actions.UPDATE, obj=notification)
        stale_response = _assert_not_stale(request, notification)
        if stale_response:
            return stale_response

        def action():
            notification.mark_read()
            notification.refresh_from_db()
            return 200, {"ok": True, "notification": mobile_notification_item(notification)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.notifications.mark_read",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


def _mobile_notification_preferences_payload(*, user, business):
    preferences = {
        preference.category: preference
        for preference in NotificationPreference.objects.filter(business=business, user=user)
    }
    return {
        "business": business.id,
        "generated_at": timezone.now(),
        "items": [
            _mobile_notification_preference_item(category=category, preference=preferences.get(category))
            for category in Notification.Categories.values
        ],
    }


def _mobile_notification_preference_item(*, category, preference):
    return {
        "category": category,
        "in_app_enabled": preference.in_app_enabled if preference else True,
        "push_enabled": preference.push_enabled if preference else True,
        "privacy_mode": preference.privacy_mode if preference else NotificationPreference.PrivacyModes.REDACTED,
    }


def _mobile_write_lead_queryset(user, business):
    queryset = Lead.objects.filter(business=business, is_archived=False).select_related("business", "client", "service", "responsible_user")
    return scope_queryset(queryset, user, business, Resources.LEADS, Actions.UPDATE)


def _mobile_write_conversation_queryset(user, business):
    queryset = BotConversation.objects.filter(business=business, is_archived=False).select_related("business", "client", "lead", "assigned_to", "bot")
    return scope_queryset(queryset, user, business, Resources.CONVERSATIONS, Actions.UPDATE)


def _assert_not_stale(request, obj):
    expected = request.data.get("expected_updated_at")
    if not expected:
        return None
    expected_at = parse_datetime(str(expected))
    if expected_at is None:
        raise ValidationError({"expected_updated_at": "Valid datetime is required."})
    if timezone.is_naive(expected_at):
        expected_at = timezone.make_aware(expected_at, timezone.get_current_timezone())
    current_updated_at = getattr(obj, "updated_at", None)
    if current_updated_at and current_updated_at > expected_at:
        record_mobile_event(
            "stale_conflict",
            business_id=getattr(obj, "business_id", None),
            endpoint=getattr(request, "path", ""),
            status="409",
            metadata={
                "entity": obj.__class__.__name__,
                "object_id": obj.pk,
                "expected_updated_at": expected_at.isoformat(),
                "current_updated_at": current_updated_at.isoformat(),
            },
        )
        return Response(
            {
                "detail": "Object changed after this mobile action was queued.",
                "code": "stale_state",
                "current_updated_at": current_updated_at,
            },
            status=409,
        )
    return None


def _mobile_task_for_write(request, task_id):
    business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
    queryset = scope_queryset(
        Task.objects.select_related("business", "client", "lead", "deal", "appointment", "assignee").filter(
            business=business,
            is_archived=False,
        ),
        request.user,
        business,
        Resources.TASKS,
        Actions.UPDATE,
    )
    task = queryset.filter(id=task_id).first()
    if not task:
        raise NotFound("Task was not found.")
    assert_can(request.user, business, Resources.TASKS, Actions.UPDATE, obj=task)
    return business, task


def _mobile_appointment_for_write(request, appointment_id):
    business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
    queryset = scope_queryset(
        Appointment.objects.select_related("business", "client", "lead", "service", "resource").filter(
            business=business,
            is_archived=False,
        ),
        request.user,
        business,
        Resources.APPOINTMENTS,
        Actions.UPDATE,
    )
    appointment = queryset.filter(id=appointment_id).first()
    if not appointment:
        raise NotFound("Appointment was not found.")
    assert_can(request.user, business, Resources.APPOINTMENTS, Actions.UPDATE, obj=appointment)
    return business, appointment


class MobileClientsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(
            build_mobile_clients(
                user=request.user,
                business=business,
                limit=request.query_params.get("limit") or 20,
                search=request.query_params.get("search") or "",
            )
        )


class MobileClientDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request, client_id):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        payload = build_mobile_client_detail(user=request.user, business=business, client_id=client_id)
        if payload is None:
            raise NotFound("Client was not found.")
        return Response(payload)


class MobileTasksView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(
            build_mobile_tasks(
                user=request.user,
                business=business,
                limit=request.query_params.get("limit") or 20,
                status=request.query_params.get("status") or "",
                due=request.query_params.get("due") or "",
            )
        )


class MobileTaskDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request, task_id):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        payload = build_mobile_task_detail(user=request.user, business=business, task_id=task_id)
        if payload is None:
            raise NotFound("Task was not found.")
        return Response(payload)


class MobileTaskCompleteView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, task_id):
        business, task = _mobile_task_for_write(request, task_id)
        stale_response = _assert_not_stale(request, task)
        if stale_response:
            return stale_response

        def action():
            completed_task = complete_task(task=task, actor=request.user, request=request)
            return 200, {"ok": True, "task": mobile_task_item(completed_task)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.tasks.complete",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileTaskAssignToMeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, task_id):
        business, task = _mobile_task_for_write(request, task_id)
        stale_response = _assert_not_stale(request, task)
        if stale_response:
            return stale_response

        def action():
            assigned = assign_task_to_me(task=task, actor=request.user, request=request)
            return 200, {"ok": True, "task": mobile_task_item(assigned)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.tasks.assign_to_me",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileTaskCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, task_id):
        business, task = _mobile_task_for_write(request, task_id)
        stale_response = _assert_not_stale(request, task)
        if stale_response:
            return stale_response
        reason = (request.data.get("reason") or "").strip()
        if len(reason) < 3:
            raise ValidationError({"reason": "This field must be at least 3 characters."})

        def action():
            cancelled = cancel_task(task=task, actor=request.user, reason=reason, request=request)
            return 200, {"ok": True, "task": mobile_task_item(cancelled)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.tasks.cancel",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileTaskSnoozeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, task_id):
        business, task = _mobile_task_for_write(request, task_id)
        stale_response = _assert_not_stale(request, task)
        if stale_response:
            return stale_response
        snoozed_until = parse_datetime(request.data.get("snoozed_until") or "")
        if snoozed_until is None:
            raise ValidationError({"snoozed_until": "Valid datetime is required."})
        if timezone.is_naive(snoozed_until):
            snoozed_until = timezone.make_aware(snoozed_until, timezone.get_current_timezone())

        def action():
            snoozed = snooze_task(task=task, snoozed_until=snoozed_until, request=request)
            return 200, {"ok": True, "task": mobile_task_item(snoozed)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.tasks.snooze",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileAppointmentsView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        return Response(
            build_mobile_appointments(
                user=request.user,
                business=business,
                limit=request.query_params.get("limit") or 20,
                date_value=request.query_params.get("date"),
                status=request.query_params.get("status") or "",
            )
        )


class MobileAppointmentDetailView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_list"

    def get(self, request, appointment_id):
        business = resolve_mobile_business(request.user, request.query_params.get("business"))
        payload = build_mobile_appointment_detail(user=request.user, business=business, appointment_id=appointment_id)
        if payload is None:
            raise NotFound("Appointment was not found.")
        return Response(payload)


class MobileAppointmentConfirmView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, appointment_id):
        business, appointment = _mobile_appointment_for_write(request, appointment_id)
        stale_response = _assert_not_stale(request, appointment)
        if stale_response:
            return stale_response

        def action():
            confirmed = confirm_appointment(appointment=appointment, actor=request.user)
            return 200, {"ok": True, "appointment": mobile_appointment_item(confirmed)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.appointments.confirm",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileAppointmentCancelView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, appointment_id):
        business, appointment = _mobile_appointment_for_write(request, appointment_id)
        stale_response = _assert_not_stale(request, appointment)
        if stale_response:
            return stale_response

        def action():
            cancelled = cancel_appointment(appointment=appointment, actor=request.user, request=request)
            return 200, {"ok": True, "appointment": mobile_appointment_item(cancelled)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.appointments.cancel",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileAppointmentRescheduleView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, appointment_id):
        business, appointment = _mobile_appointment_for_write(request, appointment_id)
        stale_response = _assert_not_stale(request, appointment)
        if stale_response:
            return stale_response
        start_at = parse_datetime(request.data.get("start_at") or "")
        if start_at is None:
            raise ValidationError({"start_at": "Valid datetime is required."})
        if timezone.is_naive(start_at):
            start_at = timezone.make_aware(start_at, timezone.get_current_timezone())
        resource = None
        resource_id = request.data.get("resource")
        if resource_id:
            resource = Resource.objects.filter(business=business, id=resource_id).first()
            if not resource:
                raise ValidationError({"resource": "Resource was not found."})
        reason = (request.data.get("reason") or "").strip()

        def action():
            rescheduled = reschedule_appointment(
                appointment=appointment,
                actor=request.user,
                start_at=start_at,
                resource=resource,
                reason=reason,
                request=request,
            )
            return 200, {"ok": True, "appointment": mobile_appointment_item(rescheduled)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.appointments.reschedule",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileApprovalApproveView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, approval_id):
        approval, business = _mobile_approval_for_write(request, approval_id)

        def action():
            approved = approve_approval_request(
                approval=approval,
                actor=request.user,
                reason=request.data.get("reason", ""),
            )
            return 200, {"ok": True, "approval": mobile_approval_item(approved)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.ai_approvals.approve",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


class MobileApprovalRejectView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mobile_write"

    def post(self, request, approval_id):
        approval, business = _mobile_approval_for_write(request, approval_id)

        def action():
            rejected = reject_approval_request(
                approval=approval,
                actor=request.user,
                reason=request.data.get("reason", ""),
            )
            return 200, {"ok": True, "approval": mobile_approval_item(rejected)}

        response_status, response_json, replayed = run_idempotent_mobile_action(
            request=request,
            business=business,
            endpoint="mobile.ai_approvals.reject",
            action=action,
        )
        response_json["replayed"] = replayed
        return Response(response_json, status=response_status)


def _mobile_approval_for_write(request, approval_id):
    business = resolve_mobile_business(request.user, request.data.get("business") or request.query_params.get("business"))
    approval = ApprovalRequest.objects.select_related("business", "requested_by", "approved_by", "rejected_by").filter(
        business=business,
        id=approval_id,
    ).first()
    if not approval:
        raise NotFound("Approval request was not found.")
    assert_can(request.user, business, approval_resource_for_action(approval.action_type), Actions.APPROVE, obj=approval)
    return approval, business
