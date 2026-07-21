from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.businesses.access import Actions, Resources, assert_can
from apps.onboarding.serializers import (
    ApplyOnboardingTemplateSerializer,
    OnboardingChannelSetupSerializer,
    OnboardingDemoDataSerializer,
    OnboardingFirstMessageSerializer,
    OnboardingStatusQuerySerializer,
    OnboardingTemplateSerializer,
)
from apps.onboarding.services import apply_niche_template, create_demo_data, create_first_channel_message, get_onboarding_status, list_onboarding_templates, setup_first_channel


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def onboarding_templates(request):
    return Response(OnboardingTemplateSerializer(list_onboarding_templates(), many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def onboarding_status(request):
    serializer = OnboardingStatusQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    business = serializer.validated_data["business"]
    assert_can(request.user, business, Resources.SETTINGS, Actions.VIEW)
    return Response(get_onboarding_status(business))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_onboarding_template(request):
    serializer = ApplyOnboardingTemplateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    business = serializer.validated_data["business"]
    assert_can(request.user, business, Resources.SETTINGS, Actions.UPDATE)
    result = apply_niche_template(business, serializer.validated_data["template_key"], actor=request.user)
    return Response(
        {
            "business": result["business"].id,
            "template_key": result["template_key"],
            "pipeline": result["pipeline"].id,
            "services_count": result["services_count"],
            "resources_count": result["resources_count"],
            "quick_replies_count": result["quick_replies_count"],
            "automations_count": result["automations_count"],
            "checklist": result["checklist"],
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def onboarding_demo_data(request):
    if not getattr(settings, "ALLOW_DEMO_MERCHANT_FLOWS", False):
        raise PermissionDenied("Demo data creation is disabled in this environment.")
    serializer = OnboardingDemoDataSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    business = serializer.validated_data["business"]
    assert_can(request.user, business, Resources.SETTINGS, Actions.UPDATE)
    return Response(create_demo_data(business, actor=request.user), status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def onboarding_setup_channel(request):
    serializer = OnboardingChannelSetupSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    business = serializer.validated_data["business"]
    assert_can(request.user, business, Resources.SETTINGS, Actions.UPDATE)
    return Response(setup_first_channel(business, serializer.validated_data["channel"], actor=request.user), status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def onboarding_first_message(request):
    serializer = OnboardingFirstMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    business = serializer.validated_data["business"]
    assert_can(request.user, business, Resources.SETTINGS, Actions.UPDATE)
    return Response(create_first_channel_message(business, actor=request.user), status=201)
