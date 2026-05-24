from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.accounts.models import User
from apps.billing.entitlements import EntitlementMetrics, assert_entitlement_allows
from apps.businesses.access import Actions, Resources, assert_can, can, ensure_default_roles
from apps.businesses.models import Business, BusinessInvitation, BusinessMember, BusinessRole, RolePermission, Team, TeamMember
from apps.businesses.serializers import (
    BusinessInvitationAcceptSerializer,
    BusinessInvitationSerializer,
    BusinessMemberSerializer,
    BusinessRoleSerializer,
    BusinessSerializer,
    PermissionCatalogSerializer,
    RolePermissionSerializer,
    TeamMemberManagementSerializer,
    TeamMemberSerializer,
    TeamSerializer,
)
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.permissions import IsTenantMember, accessible_businesses, is_platform_admin
from apps.core.viewsets import TenantModelViewSet
from apps.crm.models import Deal
from apps.leads.models import Lead
from apps.scheduling.models import Appointment
from apps.tasks.models import Task
from apps.bots.models import BotConversation


class BusinessViewSet(ModelViewSet):
    serializer_class = BusinessSerializer
    permission_classes = [IsTenantMember]

    def get_queryset(self):
        return Business.objects.all() if is_platform_admin(self.request.user) else accessible_businesses(self.request.user)

    def perform_create(self, serializer):
        owner = serializer.validated_data.get("owner") or self.request.user
        business = serializer.save(owner=owner)
        BusinessMember.objects.get_or_create(
            business=business,
            user=owner,
            defaults={"role": BusinessMember.Roles.OWNER, "is_active": True},
        )
        from apps.crm.services import ensure_default_pipeline

        ensure_default_pipeline(business)
        ensure_default_roles(business)
        write_audit_log(self.request, AuditLog.Actions.CREATE, business)

    def perform_update(self, serializer):
        assert_can(self.request.user, serializer.instance, Resources.SETTINGS, Actions.UPDATE)
        business = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, business)


class BusinessMemberViewSet(TenantModelViewSet):
    queryset = BusinessMember.objects.select_related("business", "user")
    serializer_class = BusinessMemberSerializer
    access_resource = Resources.TEAM

    def perform_create(self, serializer):
        business = serializer.validated_data["business"]
        assert_entitlement_allows(business, EntitlementMetrics.USERS)
        super().perform_create(serializer)


class TeamAccessMixin:
    permission_classes = [IsAuthenticated]
    business_resource = Resources.TEAM

    def accessible_business_ids(self, action=Actions.VIEW):
        businesses = accessible_businesses(self.request.user)
        if is_platform_admin(self.request.user):
            return list(businesses.values_list("id", flat=True))
        return [
            business.id
            for business in businesses
            if can(self.request.user, business, self.business_resource, action).allowed
        ]

    def get_business_from_request(self):
        business_id = self.request.data.get("business") or self.request.query_params.get("business")
        if business_id:
            business = Business.objects.filter(id=business_id).first()
            if not business:
                raise PermissionDenied("Business not found.")
            return business
        instance = getattr(self, "_current_instance", None)
        if instance is not None:
            business = getattr(instance, "business", None)
            if business is None and hasattr(instance, "business_role"):
                business = instance.business_role.business
            if business is None and hasattr(instance, "team"):
                business = instance.team.business
            if business is None and hasattr(instance, "member"):
                business = instance.member.business
            if business:
                return business
        first_business = accessible_businesses(self.request.user).first()
        if not first_business:
            raise PermissionDenied("Business is required.")
        return first_business

    def check_team_permission(self, action=Actions.MANAGE, instance=None):
        if instance is not None:
            self._current_instance = instance
        business = self.get_business_from_request()
        assert_can(self.request.user, business, self.business_resource, action)
        return business

    def perform_create(self, serializer):
        business = self.check_team_permission(Actions.MANAGE)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance, business=business)

    def perform_update(self, serializer):
        instance = self.get_object()
        business = self.check_team_permission(Actions.MANAGE, instance=instance)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, instance, business=business)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        business = self.check_team_permission(Actions.MANAGE, instance=instance)
        write_audit_log(request, AuditLog.Actions.DELETE, instance, business=business, metadata={"repr": str(instance)})
        self.perform_destroy(instance)
        return Response(status=204)


class TeamMemberManagementViewSet(TeamAccessMixin, ModelViewSet):
    serializer_class = TeamMemberManagementSerializer
    queryset = BusinessMember.objects.select_related("business", "user", "business_role").prefetch_related("team_memberships__team")

    def get_queryset(self):
        return self.queryset.filter(business_id__in=self.accessible_business_ids(Actions.VIEW))

    def perform_create(self, serializer):
        business = self.check_team_permission(Actions.MANAGE)
        assert_entitlement_allows(business, EntitlementMetrics.USERS)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance, business=business)


class BusinessRoleViewSet(TeamAccessMixin, ModelViewSet):
    serializer_class = BusinessRoleSerializer
    queryset = BusinessRole.objects.prefetch_related("permissions")

    def get_queryset(self):
        return self.queryset.filter(business_id__in=self.accessible_business_ids(Actions.VIEW))


class RolePermissionViewSet(TeamAccessMixin, ModelViewSet):
    serializer_class = RolePermissionSerializer
    queryset = RolePermission.objects.select_related("business_role", "business_role__business")

    def get_queryset(self):
        return self.queryset.filter(business_role__business_id__in=self.accessible_business_ids(Actions.VIEW))

    def get_business_from_request(self):
        business_role_id = self.request.data.get("business_role")
        if business_role_id:
            role = BusinessRole.objects.filter(id=business_role_id).select_related("business").first()
            if not role:
                raise PermissionDenied("Business role not found.")
            return role.business
        return super().get_business_from_request()

    def perform_create(self, serializer):
        business = self.check_team_permission(Actions.MANAGE)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, instance.business_role, business=business, metadata={"permission": str(instance)})

    def perform_update(self, serializer):
        instance = self.get_object()
        business = self.check_team_permission(Actions.MANAGE, instance=instance)
        before = {"scope": instance.scope, "is_allowed": instance.is_allowed}
        instance = serializer.save()
        write_audit_log(
            self.request,
            AuditLog.Actions.UPDATE,
            instance.business_role,
            business=business,
            metadata={"permission": str(instance), "before": before, "after": {"scope": instance.scope, "is_allowed": instance.is_allowed}},
        )


class TeamViewSet(TeamAccessMixin, ModelViewSet):
    serializer_class = TeamSerializer
    queryset = Team.objects.select_related("business")

    def get_queryset(self):
        return self.queryset.filter(business_id__in=self.accessible_business_ids(Actions.VIEW))


class TeamMembershipViewSet(TeamAccessMixin, ModelViewSet):
    serializer_class = TeamMemberSerializer
    queryset = TeamMember.objects.select_related("team", "team__business", "member", "member__user")

    def get_queryset(self):
        return self.queryset.filter(team__business_id__in=self.accessible_business_ids(Actions.VIEW))

    def get_business_from_request(self):
        team_id = self.request.data.get("team")
        member_id = self.request.data.get("member")
        if team_id:
            team = Team.objects.filter(id=team_id).select_related("business").first()
            if not team:
                raise PermissionDenied("Team not found.")
            return team.business
        if member_id:
            member = BusinessMember.objects.filter(id=member_id).select_related("business").first()
            if not member:
                raise PermissionDenied("Member not found.")
            return member.business
        return super().get_business_from_request()


class BusinessInvitationViewSet(TeamAccessMixin, ModelViewSet):
    serializer_class = BusinessInvitationSerializer
    queryset = BusinessInvitation.objects.select_related("business", "business_role", "invited_by")

    def get_permissions(self):
        if getattr(self, "action", "") in {"accept", "preview"}:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return self.queryset.filter(business_id__in=self.accessible_business_ids(Actions.VIEW))

    def perform_create(self, serializer):
        business = self.check_team_permission(Actions.MANAGE)
        assert_entitlement_allows(business, EntitlementMetrics.USERS)
        role = serializer.validated_data.get("role", BusinessMember.Roles.STAFF)
        business_role = serializer.validated_data.get("business_role")
        if business_role is None:
            business_role = BusinessRole.objects.filter(business=business, preset_key=role, is_active=True).first()
        instance = serializer.save(
            invited_by=self.request.user,
            business_role=business_role,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance, business=business)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        invitation = self.get_object()
        business = self.check_team_permission(Actions.MANAGE, instance=invitation)
        if invitation.accepted_at:
            raise ValidationError("Accepted invitation cannot be revoked.")
        invitation.revoked_at = timezone.now()
        invitation.save(update_fields=["revoked_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.UPDATE, invitation, business=business, metadata={"status": "revoked"})
        return Response(self.get_serializer(invitation).data)

    @action(detail=False, methods=["get"], url_path="preview/(?P<token>[^/.]+)")
    def preview(self, request, token=None):
        invitation = BusinessInvitation.objects.select_related("business").filter(token=token).first()
        if invitation is None:
            raise ValidationError("Invitation was not found.")
        return Response(
            {
                "business_name": invitation.business.name,
                "email": invitation.email,
                "full_name": invitation.full_name,
                "role": invitation.role,
                "status": invitation.status,
                "expires_at": invitation.expires_at,
            }
        )

    @action(detail=False, methods=["post"])
    def accept(self, request):
        serializer = BusinessInvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = BusinessInvitation.objects.select_related("business", "business_role").filter(token=serializer.validated_data["token"]).first()
        if invitation is None:
            raise ValidationError("Invitation was not found.")
        if not invitation.is_pending:
            raise ValidationError(f"Invitation is {invitation.status}.")
        user = User.objects.filter(email__iexact=invitation.email).first()
        full_name = serializer.validated_data.get("full_name") or invitation.full_name
        phone = (serializer.validated_data.get("phone") or invitation.phone or "").strip()
        if user is None:
            user = User.objects.create_user(
                username=invitation.email,
                email=invitation.email,
                password=serializer.validated_data["password"],
                full_name=full_name,
                phone=phone,
                role=_user_role_for_business_member(invitation.role),
            )
        else:
            update_fields = ["role", "is_active"]
            if full_name and not user.full_name:
                user.full_name = full_name
                update_fields.append("full_name")
            if phone and not user.phone:
                user.phone = phone
                update_fields.append("phone")
            if not user.has_usable_password():
                user.set_password(serializer.validated_data["password"])
                update_fields.append("password")
            user.role = _user_role_for_business_member(invitation.role)
            user.is_active = True
            user.save(update_fields=update_fields)
        membership, _ = BusinessMember.objects.update_or_create(
            business=invitation.business,
            user=user,
            defaults={
                "role": invitation.role,
                "business_role": invitation.business_role,
                "is_active": True,
            },
        )
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["accepted_at", "updated_at"])
        write_audit_log(request, AuditLog.Actions.CREATE, membership, business=invitation.business, metadata={"source": "invitation"})
        return Response({"ok": True, "business": invitation.business_id, "email": user.email, "role": membership.role})


def _user_role_for_business_member(role):
    if role in {BusinessMember.Roles.ADMIN, BusinessMember.Roles.MANAGER}:
        return User.Roles.BUSINESS_MANAGER
    if role in {BusinessMember.Roles.OPERATOR, BusinessMember.Roles.MARKETER, BusinessMember.Roles.ACCOUNTANT, BusinessMember.Roles.SUPPORT}:
        return User.Roles.BUSINESS_OPERATOR
    return User.Roles.STAFF


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def team_permissions_catalog(request):
    return Response(PermissionCatalogSerializer({}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def team_performance(request):
    business = _resolve_team_business(request)
    assert_can(request.user, business, Resources.ANALYTICS, Actions.VIEW)
    membership = BusinessMember.objects.filter(business=business, user=request.user, is_active=True).select_related("business_role").first()
    if membership is None and not is_platform_admin(request.user):
        raise PermissionDenied("No active membership.")

    visible_members = _visible_performance_members(request.user, business, membership)
    if not visible_members.exists():
        raise PermissionDenied("Team analytics is not available for this role.")

    visible_members = _apply_member_filters(visible_members, request)
    visible_user_ids = list(visible_members.values_list("user_id", flat=True))
    start_date = parse_date(request.query_params.get("start", "") or "")
    end_date = parse_date(request.query_params.get("end", "") or "")
    source = request.query_params.get("source")
    pipeline = request.query_params.get("pipeline")
    now = timezone.now()
    handoff_deadline = now - timezone.timedelta(minutes=15)

    leads = Lead.objects.filter(business=business, responsible_user_id__in=visible_user_ids)
    leads = _date_filter(leads, "created_at", start_date, end_date)
    if source:
        leads = leads.filter(source=source)

    deals = Deal.objects.filter(business=business, owner_id__in=visible_user_ids)
    deals = _date_filter(deals, "created_at", start_date, end_date)
    if source:
        deals = deals.filter(source=source)
    if pipeline:
        deals = deals.filter(pipeline_id=pipeline)

    appointments = Appointment.objects.filter(business=business, lead__responsible_user_id__in=visible_user_ids)
    appointments = _date_filter(appointments, "created_at", start_date, end_date)

    tasks = Task.objects.filter(business=business).filter(Q(assignee_id__in=visible_user_ids) | Q(completed_by_id__in=visible_user_ids))
    tasks = _date_filter(tasks, "created_at", start_date, end_date)

    conversations = BotConversation.objects.filter(business=business, assigned_to_id__in=visible_user_ids)
    conversations = _date_filter(conversations, "updated_at", start_date, end_date)

    rows = []
    for member in visible_members.select_related("user").prefetch_related("team_memberships__team").order_by("user__email"):
        user = member.user
        user_leads = leads.filter(responsible_user=user)
        user_deals = deals.filter(owner=user)
        user_tasks = tasks.filter(Q(assignee=user) | Q(completed_by=user))
        user_conversations = conversations.filter(assigned_to=user)
        user_appointments = appointments.filter(lead__responsible_user=user)
        active_tasks = user_tasks.exclude(status__in=[Task.Statuses.DONE, Task.Statuses.CANCELLED])
        assigned_leads_count = user_leads.count()
        appointments_created_count = user_appointments.count()
        lost_leads_count = user_leads.filter(status=Lead.Statuses.LOST).count()
        closed_leads_count = user_leads.filter(status=Lead.Statuses.CLOSED).count()
        contacted_leads_count = user_leads.filter(status__in=[Lead.Statuses.CONTACTED, Lead.Statuses.APPOINTMENT_CREATED, Lead.Statuses.CLOSED]).count()
        overdue_handoffs_count = user_conversations.filter(handoff_required=True, last_inbound_at__lt=handoff_deadline).count()
        missed_chat_handoffs_count = user_conversations.filter(handoff_required=True, assigned_to__isnull=False, last_outbound_at__isnull=True).count()
        tasks_overdue_count = active_tasks.filter(due_at__lt=now).count()
        sla_overdue_deals_count = _sla_overdue_deals_count(user_deals, now)
        lost_reasons = list(
            user_leads.filter(status=Lead.Statuses.LOST)
            .exclude(lost_reason="")
            .values("lost_reason")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        rows.append(
            {
                "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
                "role": member.role,
                "teams": [{"id": item.team_id, "name": item.team.name, "is_lead": item.is_lead} for item in member.team_memberships.all()],
                "assigned_leads": assigned_leads_count,
                "contacted_leads": contacted_leads_count,
                "closed_leads": closed_leads_count,
                "lost_leads": lost_leads_count,
                "lost_without_reason": user_leads.filter(status=Lead.Statuses.LOST, lost_reason="").count(),
                "lost_reason_breakdown": lost_reasons,
                "overdue_handoffs": overdue_handoffs_count,
                "missed_chat_handoffs": missed_chat_handoffs_count,
                "avg_response_time_minutes": _avg_response_minutes(user_conversations),
                "appointments_created": appointments_created_count,
                "appointment_conversion_rate": _percent(appointments_created_count, assigned_leads_count),
                "lost_rate": _percent(lost_leads_count, assigned_leads_count),
                "no_show_appointments": user_appointments.filter(status=Appointment.Statuses.NO_SHOW).count(),
                "deals_won": user_deals.filter(status=Deal.Statuses.WON).count(),
                "deals_lost": user_deals.filter(status=Deal.Statuses.LOST).count(),
                "sla_overdue_deals": sla_overdue_deals_count,
                "tasks_overdue": tasks_overdue_count,
                "tasks_completed": user_tasks.filter(status=Task.Statuses.DONE).count(),
                "action_items": _member_action_items(
                    user,
                    overdue_handoffs_count=overdue_handoffs_count,
                    missed_chat_handoffs_count=missed_chat_handoffs_count,
                    tasks_overdue_count=tasks_overdue_count,
                    sla_overdue_deals_count=sla_overdue_deals_count,
                ),
            }
        )

    warnings = _performance_warnings(rows)
    team_rows = _team_performance_summary(rows)
    totals = {
        "assigned_leads": sum(row["assigned_leads"] for row in rows),
        "contacted_leads": sum(row["contacted_leads"] for row in rows),
        "closed_leads": sum(row["closed_leads"] for row in rows),
        "lost_leads": sum(row["lost_leads"] for row in rows),
        "overdue_handoffs": sum(row["overdue_handoffs"] for row in rows),
        "missed_chat_handoffs": sum(row["missed_chat_handoffs"] for row in rows),
        "tasks_overdue": sum(row["tasks_overdue"] for row in rows),
        "deals_won": sum(row["deals_won"] for row in rows),
        "deals_lost": sum(row["deals_lost"] for row in rows),
        "sla_overdue_deals": sum(row["sla_overdue_deals"] for row in rows),
        "no_show_appointments": sum(row["no_show_appointments"] for row in rows),
    }
    totals["appointment_conversion_rate"] = _percent(totals["assigned_leads"] and sum(row["appointments_created"] for row in rows), totals["assigned_leads"])
    totals["lost_rate"] = _percent(totals["lost_leads"], totals["assigned_leads"])
    return Response({
        "business": business.id,
        "scope": _performance_scope(membership),
        "totals": totals,
        "members": rows,
        "teams": team_rows,
        "warnings": warnings,
        "action_items": _top_action_items(rows),
    })


def _resolve_team_business(request):
    business_id = request.query_params.get("business")
    businesses = accessible_businesses(request.user)
    if business_id:
        business = businesses.filter(id=business_id).first()
        if business is None:
            raise PermissionDenied("Business is not available.")
        return business
    business = businesses.first()
    if business is None:
        raise PermissionDenied("Business is required.")
    return business


def _visible_performance_members(user, business, membership):
    queryset = BusinessMember.objects.filter(business=business, is_active=True)
    if is_platform_admin(user) or membership.role in {BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN}:
        return queryset
    lead_team_ids = list(membership.team_memberships.filter(is_lead=True).values_list("team_id", flat=True))
    if lead_team_ids:
        member_ids = TeamMember.objects.filter(team_id__in=lead_team_ids).values_list("member_id", flat=True)
        return queryset.filter(id__in=member_ids)
    if can(user, business, Resources.ANALYTICS, Actions.VIEW).allowed and membership.role in {
        BusinessMember.Roles.MANAGER,
        BusinessMember.Roles.MARKETER,
        BusinessMember.Roles.ACCOUNTANT,
    }:
        return queryset.filter(id=membership.id)
    return queryset.none()


def _performance_scope(membership):
    if membership is None:
        return "business"
    if membership.role in {BusinessMember.Roles.OWNER, BusinessMember.Roles.ADMIN}:
        return "business"
    if membership.team_memberships.filter(is_lead=True).exists():
        return "team"
    return "own"


def _apply_member_filters(queryset, request):
    team_id = request.query_params.get("team")
    manager_id = request.query_params.get("manager")
    if team_id:
        queryset = queryset.filter(team_memberships__team_id=team_id)
    if manager_id:
        queryset = queryset.filter(user_id=manager_id)
    return queryset.distinct()


def _date_filter(queryset, field, start_date, end_date):
    if start_date:
        queryset = queryset.filter(**{f"{field}__date__gte": start_date})
    if end_date:
        queryset = queryset.filter(**{f"{field}__date__lte": end_date})
    return queryset


def _percent(value, total):
    if not total:
        return 0
    return round((value / total) * 100)


def _avg_response_minutes(conversations):
    diffs = []
    for conversation in conversations.only("last_inbound_at", "last_outbound_at"):
        if conversation.last_inbound_at and conversation.last_outbound_at and conversation.last_outbound_at >= conversation.last_inbound_at:
            diffs.append((conversation.last_outbound_at - conversation.last_inbound_at).total_seconds() / 60)
    if not diffs:
        return None
    return round(sum(diffs) / len(diffs))


def _sla_overdue_deals_count(deals, now):
    count = 0
    for deal in deals.select_related("stage").only("stage_entered_at", "stage__sla_minutes"):
        if deal.stage and deal.stage.sla_minutes and deal.stage_entered_at:
            if now > deal.stage_entered_at + timezone.timedelta(minutes=deal.stage.sla_minutes):
                count += 1
    return count


def _member_action_items(user, *, overdue_handoffs_count, missed_chat_handoffs_count, tasks_overdue_count, sla_overdue_deals_count):
    name = user.full_name or user.email
    actions = []
    if overdue_handoffs_count:
        actions.append({
            "type": "overdue_handoff",
            "severity": "critical",
            "user_id": user.id,
            "title": "Разобрать просроченные handoff",
            "description": f"{name}: {overdue_handoffs_count} чат(ов) ждут подключения менеджера.",
            "route": "/dashboard/conversations",
            "count": overdue_handoffs_count,
        })
    if missed_chat_handoffs_count:
        actions.append({
            "type": "missed_chat",
            "severity": "critical",
            "user_id": user.id,
            "title": "Ответить в чатах без исходящего сообщения",
            "description": f"{name}: {missed_chat_handoffs_count} чат(ов) назначены, но не получили ответа.",
            "route": "/dashboard/conversations",
            "count": missed_chat_handoffs_count,
        })
    if sla_overdue_deals_count:
        actions.append({
            "type": "sla_overdue_deal",
            "severity": "warning",
            "user_id": user.id,
            "title": "Проверить сделки с просроченным SLA",
            "description": f"{name}: {sla_overdue_deals_count} сделк(и) зависли на этапе дольше нормы.",
            "route": "/dashboard/deals",
            "count": sla_overdue_deals_count,
        })
    if tasks_overdue_count:
        actions.append({
            "type": "overdue_task",
            "severity": "warning",
            "user_id": user.id,
            "title": "Закрыть просроченные задачи",
            "description": f"{name}: {tasks_overdue_count} задач(и) просрочены.",
            "route": "/dashboard/tasks",
            "count": tasks_overdue_count,
        })
    return actions


def _top_action_items(rows):
    actions = []
    for row in rows:
        actions.extend(row.get("action_items", []))
    severity_weight = {"critical": 0, "warning": 1, "info": 2}
    return sorted(actions, key=lambda item: (severity_weight.get(item["severity"], 9), -item["count"]))[:8]


def _team_performance_summary(rows):
    teams = {}
    for row in rows:
        for team in row["teams"]:
            bucket = teams.setdefault(
                team["id"],
                {
                    "id": team["id"],
                    "name": team["name"],
                    "members_count": 0,
                    "assigned_leads": 0,
                    "lost_leads": 0,
                    "overdue_handoffs": 0,
                    "missed_chat_handoffs": 0,
                    "tasks_overdue": 0,
                    "sla_overdue_deals": 0,
                    "deals_won": 0,
                    "deals_lost": 0,
                    "no_show_appointments": 0,
                },
            )
            bucket["members_count"] += 1
            for key in [
                "assigned_leads",
                "lost_leads",
                "overdue_handoffs",
                "missed_chat_handoffs",
                "tasks_overdue",
                "sla_overdue_deals",
                "deals_won",
                "deals_lost",
                "no_show_appointments",
            ]:
                bucket[key] += row[key]
    for bucket in teams.values():
        bucket["lost_rate"] = _percent(bucket["lost_leads"], bucket["assigned_leads"])
    return list(teams.values())


def _performance_warnings(rows):
    warnings = []
    for row in rows:
        name = row["user"]["full_name"] or row["user"]["email"]
        for key, label in [
            ("lost_without_reason", "lost без причины"),
            ("overdue_handoffs", "handoff просрочен"),
            ("missed_chat_handoffs", "чат без ответа"),
            ("sla_overdue_deals", "SLA сделки просрочен"),
            ("tasks_overdue", "задачи просрочены"),
        ]:
            count = row.get(key, 0)
            if count:
                warnings.append({"type": key, "severity": "warning", "user_id": row["user"]["id"], "message": f"{name}: {label}", "count": count})
    return warnings
