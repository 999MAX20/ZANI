from django.test import SimpleTestCase

from apps.activities.serializers import ActivityEventSerializer, NoteSerializer, SegmentFilterSerializer, SegmentSerializer, TagSerializer, TaggedObjectSerializer
from apps.analytics.serializers import AnalyticsEventSerializer, ReportWidgetSerializer, ScheduledReportSerializer
from apps.automations.serializers import AutomationActionSerializer, AutomationConditionSerializer, AutomationRuleSerializer, AutomationRunSerializer
from apps.billing.serializers import SubscriptionPlanSerializer, SubscriptionSerializer, UsageCounterSerializer
from apps.bots.serializers import BotChannelSerializer, BotConversationSerializer, BotMessageSerializer, BotSerializer
from apps.clients.serializers import ClientSerializer
from apps.conversations.serializers import ConversationSerializer, MessageSerializer, QuickReplyTemplateSerializer
from apps.core.serializers import (
    AuditLogSerializer,
    CustomFieldDefinitionSerializer,
    CustomFieldValueSerializer,
    LoginHistorySerializer,
    SupportAccessGrantSerializer,
)
from apps.crm.serializers import DealSerializer, PipelineSerializer, PipelineStageSerializer, StageTransitionSerializer
from apps.leads.serializers import LeadFormFieldSerializer, LeadFormSerializer, LeadFormSubmissionErrorSerializer, LeadFormSubmissionSerializer, LeadSerializer
from apps.notifications.serializers import NotificationPreferenceSerializer, NotificationSerializer
from apps.outreach.serializers import OutreachCampaignSerializer, OutreachConsentSerializer, OutreachRecipientSerializer, OutreachTemplateSerializer
from apps.scheduling.serializers import AppointmentMessageSettingSerializer, AppointmentSerializer, ResourceSerializer, WorkingHoursSerializer
from apps.tasks.serializers import TaskSerializer


class ApiContractSerializerTests(SimpleTestCase):
    def test_crm_serializers_use_explicit_fields(self):
        serializers = [
            PipelineStageSerializer,
            PipelineSerializer,
            DealSerializer,
            StageTransitionSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")

    def test_custom_field_serializers_use_explicit_fields(self):
        serializers = [
            CustomFieldDefinitionSerializer,
            CustomFieldValueSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")

    def test_lifecycle_serializers_use_explicit_fields(self):
        serializers = [
            LeadSerializer,
            AppointmentSerializer,
            TaskSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")

    def test_adjacent_crm_serializers_use_explicit_fields(self):
        serializers = [
            ClientSerializer,
            ConversationSerializer,
            MessageSerializer,
            QuickReplyTemplateSerializer,
            ActivityEventSerializer,
            NoteSerializer,
            TagSerializer,
            TaggedObjectSerializer,
            SegmentFilterSerializer,
            SegmentSerializer,
            BotSerializer,
            BotChannelSerializer,
            BotConversationSerializer,
            BotMessageSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")

    def test_lead_form_and_scheduling_settings_serializers_use_explicit_fields(self):
        serializers = [
            LeadFormFieldSerializer,
            LeadFormSerializer,
            LeadFormSubmissionSerializer,
            LeadFormSubmissionErrorSerializer,
            ResourceSerializer,
            WorkingHoursSerializer,
            AppointmentMessageSettingSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")

    def test_security_serializers_use_explicit_fields(self):
        serializers = [
            AuditLogSerializer,
            LoginHistorySerializer,
            SupportAccessGrantSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")

    def test_platform_module_serializers_use_explicit_fields(self):
        serializers = [
            AnalyticsEventSerializer,
            ReportWidgetSerializer,
            ScheduledReportSerializer,
            AutomationConditionSerializer,
            AutomationActionSerializer,
            AutomationRuleSerializer,
            AutomationRunSerializer,
            SubscriptionPlanSerializer,
            SubscriptionSerializer,
            UsageCounterSerializer,
            NotificationSerializer,
            NotificationPreferenceSerializer,
            OutreachTemplateSerializer,
            OutreachCampaignSerializer,
            OutreachRecipientSerializer,
            OutreachConsentSerializer,
        ]

        for serializer_class in serializers:
            self.assertIsInstance(serializer_class.Meta.fields, list, serializer_class.__name__)
            self.assertNotEqual(serializer_class.Meta.fields, "__all__")
