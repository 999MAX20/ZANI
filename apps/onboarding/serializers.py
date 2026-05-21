from rest_framework import serializers

from apps.businesses.models import Business
from apps.onboarding.templates import NICHES


class OnboardingTemplateSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    services = serializers.ListField(child=serializers.CharField())
    resources = serializers.ListField(child=serializers.CharField())
    stages = serializers.ListField(child=serializers.CharField())
    quick_replies = serializers.ListField(child=serializers.CharField())


class ApplyOnboardingTemplateSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    template_key = serializers.ChoiceField(choices=[(key, key) for key in NICHES.keys()])


class OnboardingDemoDataSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())


class OnboardingChannelSetupSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
    channel = serializers.ChoiceField(choices=[("website", "website"), ("telegram", "telegram"), ("whatsapp", "whatsapp")], default="website")


class OnboardingFirstMessageSerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())


class OnboardingStatusQuerySerializer(serializers.Serializer):
    business = serializers.PrimaryKeyRelatedField(queryset=Business.objects.all())
