from rest_framework.decorators import action
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.activities.services import write_activity_event
from apps.businesses.access import Actions, assert_can, can, scope_queryset
from apps.core.archive import archive_instance, can_hard_delete, restore_instance, supports_archive
from apps.core.audit import write_audit_log
from apps.core.models import AuditLog
from apps.core.permissions import IsTenantMember, accessible_businesses, is_platform_admin, user_can_access_business


class TenantModelViewSet(ModelViewSet):
    permission_classes = [IsTenantMember]
    business_lookup = "business"
    access_resource = None

    access_resource_map = {
        "Client": "clients",
        "Lead": "leads",
        "Deal": "deals",
        "Pipeline": "deals",
        "PipelineStage": "deals",
        "StageTransition": "deals",
        "Service": "settings",
        "Resource": "settings",
        "WorkingHours": "settings",
        "Appointment": "appointments",
        "Task": "tasks",
        "Bot": "integrations",
        "BotChannel": "integrations",
        "BotConversation": "conversations",
        "BotMessage": "conversations",
        "Conversation": "conversations",
        "Message": "conversations",
        "Notification": "notifications",
        "AnalyticsEvent": "analytics",
        "ActivityEvent": "analytics",
        "Note": "clients",
        "Tag": "clients",
        "TaggedObject": "clients",
        "Segment": "clients",
        "SegmentFilter": "clients",
        "AutomationRule": "automations",
        "AutomationCondition": "automations",
        "AutomationAction": "automations",
        "AutomationRun": "automations",
        "CustomFieldDefinition": "settings",
        "CustomFieldValue": "settings",
        "ImportJob": "clients",
        "AIRequestLog": "analytics",
        "BusinessKnowledgeItem": "settings",
        "AgentProfile": "settings",
        "BusinessConnector": "integrations",
        "ConnectorCredential": "integrations",
    }

    action_permission_map = {
        "list": Actions.VIEW,
        "retrieve": Actions.VIEW,
        "create": Actions.CREATE,
        "update": Actions.UPDATE,
        "partial_update": Actions.UPDATE,
        "destroy": Actions.DELETE,
    }

    def get_access_resource(self):
        if self.access_resource:
            return self.access_resource
        if getattr(self, "queryset", None) is not None:
            model = self.queryset.model
        else:
            model = self.get_serializer_class().Meta.model
        return self.access_resource_map.get(model.__name__)

    def get_access_action(self):
        return self.action_permission_map.get(getattr(self, "action", ""), Actions.VIEW)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if is_platform_admin(user):
            return queryset

        businesses = list(accessible_businesses(user))
        filtered = queryset.filter(**{f"{self.business_lookup}__in": [business.id for business in businesses]})
        if (
            supports_archive(queryset.model)
            and self.request.query_params.get("include_archived") != "true"
            and getattr(self, "action", "") != "restore"
        ):
            filtered = filtered.filter(is_archived=False)
        resource = self.get_access_resource()
        if resource is None:
            return filtered

        scoped_queryset = queryset.none()
        for business in businesses:
            if not can(user, business, resource, Actions.VIEW).allowed:
                continue
            business_queryset = filtered.filter(**{self.business_lookup: business})
            scoped_queryset = scoped_queryset | scope_queryset(business_queryset, user, business, resource, Actions.VIEW)
        ordering = getattr(queryset.model._meta, "ordering", None) or ["pk"]
        return scoped_queryset.distinct().order_by(*ordering)

    def _business_from_serializer(self, serializer):
        business = serializer.validated_data.get("business")
        if business is None and "conversation" in serializer.validated_data:
            business = serializer.validated_data["conversation"].business
        if business is None and "bot" in serializer.validated_data:
            business = serializer.validated_data["bot"].business
        if business is None and "rule" in serializer.validated_data:
            business = serializer.validated_data["rule"].business
        if business is None and serializer.instance is not None:
            business = getattr(serializer.instance, "business", None)
            if business is None and hasattr(serializer.instance, "conversation"):
                business = serializer.instance.conversation.business
            if business is None and hasattr(serializer.instance, "bot"):
                business = serializer.instance.bot.business
            if business is None and hasattr(serializer.instance, "rule"):
                business = serializer.instance.rule.business
        return business

    def get_object(self):
        instance = super().get_object()
        resource = self.get_access_resource()
        business = getattr(instance, "business", None)
        if business is None and hasattr(instance, "conversation"):
            business = instance.conversation.business
        if business is None and hasattr(instance, "bot"):
            business = instance.bot.business
        if business is None and hasattr(instance, "rule"):
            business = instance.rule.business
        if resource is not None:
            assert_can(self.request.user, business, resource, Actions.VIEW, obj=instance)
        return instance

    def _enforce_business_access(self, serializer):
        business = self._business_from_serializer(serializer)
        if not user_can_access_business(self.request.user, business):
            raise PermissionDenied("You do not have access to this business.")
        resource = self.get_access_resource()
        if resource is not None:
            assert_can(self.request.user, business, resource, self.get_access_action(), obj=serializer.instance)

    def perform_create(self, serializer):
        self._enforce_business_access(serializer)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.CREATE, instance)
        write_activity_event(self.request, f"{instance.__class__.__name__.lower()}.created", instance)

    def perform_update(self, serializer):
        self._enforce_business_access(serializer)
        instance = serializer.save()
        write_audit_log(self.request, AuditLog.Actions.UPDATE, instance)
        write_activity_event(self.request, f"{instance.__class__.__name__.lower()}.updated", instance)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        resource = self.get_access_resource()
        business = getattr(instance, "business", None)
        if business is None and hasattr(instance, "conversation"):
            business = instance.conversation.business
        if business is None and hasattr(instance, "bot"):
            business = instance.bot.business
        if business is None and hasattr(instance, "rule"):
            business = instance.rule.business
        if supports_archive(instance) and request.query_params.get("hard_delete") != "true":
            if resource is not None:
                assert_can(request.user, business, resource, Actions.UPDATE, obj=instance)
            archive_instance(request, instance, reason=request.data.get("reason", "") if hasattr(request, "data") else "")
            return Response(status=204)
        if resource is not None:
            assert_can(request.user, business, resource, Actions.DELETE, obj=instance)
        if supports_archive(instance) and not can_hard_delete(request.user, business, resource):
            raise PermissionDenied("Only owner/admin can hard-delete critical CRM records.")
        write_audit_log(request, AuditLog.Actions.DELETE, instance, metadata={"repr": str(instance)})
        write_activity_event(request, f"{instance.__class__.__name__.lower()}.deleted", instance)
        self.perform_destroy(instance)
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        instance = self.get_object()
        resource = self.get_access_resource()
        business = self._business_from_instance(instance)
        if resource is not None:
            assert_can(request.user, business, resource, Actions.UPDATE, obj=instance)
        reason = request.data.get("reason", "")
        instance = archive_instance(request, instance, reason=reason)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        instance = self.get_object()
        business = self._business_from_instance(instance)
        if not can_hard_delete(request.user, business, self.get_access_resource()):
            raise PermissionDenied("Only owner/admin can restore archived critical CRM records.")
        instance = restore_instance(request, instance)
        return Response(self.get_serializer(instance).data)

    def _business_from_instance(self, instance):
        business = getattr(instance, "business", None)
        if business is None and hasattr(instance, "conversation"):
            business = instance.conversation.business
        if business is None and hasattr(instance, "bot"):
            business = instance.bot.business
        if business is None and hasattr(instance, "rule"):
            business = instance.rule.business
        if business is None:
            raise ValidationError("Business is required.")
        return business
