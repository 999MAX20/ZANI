from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.businesses.access import PERMISSION_CATALOG
from apps.businesses.models import (
    Business,
    BusinessCapability,
    BusinessInvitation,
    BusinessMember,
    BusinessRole,
    RolePermission,
    RolePreset,
    RoutingPolicy,
    Team,
    TeamMember,
)


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = "__all__"
    read_only_fields = ["owner", "created_at", "updated_at"]


class BusinessCapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessCapability
        fields = ["id", "business", "module_key", "is_enabled", "configured_by", "created_at", "updated_at"]
        read_only_fields = ["business", "module_key", "configured_by", "created_at", "updated_at"]


class RoutingPolicySerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    last_assigned_user_id = serializers.IntegerField(source="last_assigned_member.user_id", read_only=True)

    class Meta:
        model = RoutingPolicy
        fields = [
            "id",
            "business",
            "resource",
            "mode",
            "team",
            "team_name",
            "unavailable_strategy",
            "eligible_roles",
            "sla_minutes",
            "last_assigned_member",
            "last_assigned_user_id",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "last_assigned_member",
            "last_assigned_user_id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        team = attrs.get("team") if "team" in attrs else getattr(self.instance, "team", None)
        if self.instance is not None and business and business.id != self.instance.business_id:
            raise serializers.ValidationError({"business": "Routing policy business cannot be changed."})
        if team and business and team.business_id != business.id:
            raise serializers.ValidationError({"team": "Routing team must belong to the selected business."})
        if team and not team.is_active:
            raise serializers.ValidationError({"team": "Routing team must be active."})
        resource = attrs.get("resource") or getattr(self.instance, "resource", None)
        eligible_roles = attrs.get("eligible_roles")
        if eligible_roles is not None:
            if not isinstance(eligible_roles, list) or any(not isinstance(role, str) for role in eligible_roles):
                raise serializers.ValidationError({"eligible_roles": "Eligible roles must be a list of role keys."})
            valid_roles = set(BusinessMember.Roles.values)
            invalid = sorted(set(eligible_roles) - valid_roles)
            if invalid:
                raise serializers.ValidationError({"eligible_roles": f"Unsupported roles: {', '.join(invalid)}."})
            from apps.businesses.assignment_policy import ELIGIBLE_ROLES

            resource_roles = ELIGIBLE_ROLES.get(resource, set())
            ineligible = sorted(set(eligible_roles) - resource_roles)
            if ineligible:
                raise serializers.ValidationError(
                    {"eligible_roles": f"Roles are not eligible for {resource}: {', '.join(ineligible)}."}
                )
            attrs["eligible_roles"] = list(dict.fromkeys(eligible_roles))
        return attrs


class BusinessMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    role_name = serializers.CharField(source="business_role.name", read_only=True)

    class Meta:
        model = BusinessMember
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        user = attrs.get("user") or getattr(self.instance, "user", None)
        business_role = attrs.get("business_role") if "business_role" in attrs else getattr(self.instance, "business_role", None)
        role = attrs.get("role") or getattr(self.instance, "role", BusinessMember.Roles.STAFF)
        fallback_member = attrs.get("fallback_member") if "fallback_member" in attrs else getattr(self.instance, "fallback_member", None)

        if self.instance is not None:
            if business and business.id != self.instance.business_id:
                raise serializers.ValidationError({"business": "Membership business cannot be changed."})
            if user and user.id != self.instance.user_id:
                raise serializers.ValidationError({"user": "Membership user cannot be changed."})
        if business_role and business and business_role.business_id != business.id:
            raise serializers.ValidationError({"business_role": "Business role must belong to the selected business."})
        if fallback_member and business and fallback_member.business_id != business.id:
            raise serializers.ValidationError({"fallback_member": "Fallback member must belong to the selected business."})
        if fallback_member and self.instance and fallback_member.id == self.instance.id:
            raise serializers.ValidationError({"fallback_member": "A member cannot be their own fallback."})
        if fallback_member and not fallback_member.is_active:
            raise serializers.ValidationError({"fallback_member": "Fallback member must be active."})
        if business_role and not business_role.is_active:
            raise serializers.ValidationError({"business_role": "Business role must be active."})
        if role == BusinessMember.Roles.OWNER and (
            self.instance is None or self.instance.role != BusinessMember.Roles.OWNER
        ):
            raise serializers.ValidationError({"role": "Ownership transfer must be handled explicitly."})
        if self.instance is not None and self.instance.role == BusinessMember.Roles.OWNER:
            if role != BusinessMember.Roles.OWNER:
                raise serializers.ValidationError({"role": "Business owner role cannot be changed here."})
            if attrs.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "Business owner cannot be deactivated here."})
        return attrs


class TeamUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "phone", "role"]


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ["id", "business_role", "resource", "action", "scope", "is_allowed", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class BusinessRoleSerializer(serializers.ModelSerializer):
    permissions = RolePermissionSerializer(many=True, read_only=True)

    class Meta:
        model = BusinessRole
        fields = [
            "id",
            "business",
            "name",
            "preset_key",
            "description",
            "permissions_json",
            "is_system",
            "is_active",
            "permissions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class RolePresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePreset
        fields = ["id", "key", "name", "description", "permissions_json", "is_active", "created_at", "updated_at"]


class TeamSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(source="team_members.count", read_only=True)

    class Meta:
        model = Team
        fields = ["id", "business", "name", "description", "is_active", "members_count", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class TeamMemberSerializer(serializers.ModelSerializer):
    member_email = serializers.EmailField(source="member.user.email", read_only=True)
    member_full_name = serializers.CharField(source="member.user.full_name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)

    class Meta:
        model = TeamMember
        fields = ["id", "team", "team_name", "member", "member_email", "member_full_name", "is_lead", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        team = attrs.get("team") or getattr(self.instance, "team", None)
        member = attrs.get("member") or getattr(self.instance, "member", None)
        if team and member and team.business_id != member.business_id:
            raise serializers.ValidationError({"member": "Team member must belong to the same business as the team."})
        return attrs


class TeamMemberManagementSerializer(serializers.ModelSerializer):
    user = TeamUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source="user", queryset=User.objects.all(), write_only=True, required=False)
    business_role_name = serializers.CharField(source="business_role.name", read_only=True)
    teams = serializers.SerializerMethodField()

    class Meta:
        model = BusinessMember
        fields = [
            "id",
            "business",
            "user",
            "user_id",
            "role",
            "business_role",
            "business_role_name",
            "teams",
            "is_active",
            "availability_status",
            "unavailable_until",
            "fallback_member",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_teams(self, obj):
        return [
            {"id": membership.team_id, "name": membership.team.name, "is_lead": membership.is_lead}
            for membership in obj.team_memberships.select_related("team").all()
        ]

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        user = attrs.get("user") or getattr(self.instance, "user", None)
        business_role = attrs.get("business_role") if "business_role" in attrs else getattr(self.instance, "business_role", None)
        fallback_member = attrs.get("fallback_member") if "fallback_member" in attrs else getattr(self.instance, "fallback_member", None)
        role = attrs.get("role")
        is_active = attrs.get("is_active")
        current_role = getattr(self.instance, "role", None)
        if self.instance is not None:
            if business and business.id != self.instance.business_id:
                raise serializers.ValidationError({"business": "Membership business cannot be changed."})
            if user and user.id != self.instance.user_id:
                raise serializers.ValidationError({"user_id": "Membership user cannot be changed."})
        if business_role and business and business_role.business_id != business.id:
            raise serializers.ValidationError({"business_role": "Business role must belong to the selected business."})
        if fallback_member and business and fallback_member.business_id != business.id:
            raise serializers.ValidationError({"fallback_member": "Fallback member must belong to the selected business."})
        if fallback_member and self.instance and fallback_member.id == self.instance.id:
            raise serializers.ValidationError({"fallback_member": "A member cannot be their own fallback."})
        if fallback_member and not fallback_member.is_active:
            raise serializers.ValidationError({"fallback_member": "Fallback member must be active."})
        if business_role and not business_role.is_active:
            raise serializers.ValidationError({"business_role": "Business role must be active."})
        if role == BusinessMember.Roles.OWNER and current_role != BusinessMember.Roles.OWNER:
            raise serializers.ValidationError("Ownership transfer must be handled explicitly.")
        if current_role == BusinessMember.Roles.OWNER and role and role != BusinessMember.Roles.OWNER:
            raise serializers.ValidationError("Business owner role cannot be changed from the team screen.")
        if current_role == BusinessMember.Roles.OWNER and is_active is False:
            raise serializers.ValidationError("Business owner cannot be deactivated from the team screen.")
        return attrs


class BusinessInvitationSerializer(serializers.ModelSerializer):
    invited_by_email = serializers.EmailField(source="invited_by.email", read_only=True)
    business_name = serializers.CharField(source="business.name", read_only=True)
    business_role_name = serializers.CharField(source="business_role.name", read_only=True)
    status = serializers.CharField(read_only=True)
    invite_path = serializers.SerializerMethodField()

    class Meta:
        model = BusinessInvitation
        fields = [
            "id",
            "business",
            "business_name",
            "email",
            "phone",
            "telegram",
            "full_name",
            "role",
            "business_role",
            "business_role_name",
            "team",
            "invited_by",
            "invited_by_email",
            "delivery_channel",
            "token",
            "invite_path",
            "expires_at",
            "accepted_at",
            "revoked_at",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["token", "invited_by", "expires_at", "accepted_at", "revoked_at", "created_at", "updated_at"]

    def get_invite_path(self, obj):
        return f"/invite/{obj.token}"

    def validate(self, attrs):
        business = attrs.get("business") or getattr(self.instance, "business", None)
        email = (attrs.get("email") or getattr(self.instance, "email", "") or "").strip().lower()
        phone = (attrs.get("phone") or getattr(self.instance, "phone", "") or "").strip()
        telegram = (attrs.get("telegram") or getattr(self.instance, "telegram", "") or "").strip()
        delivery_channel = attrs.get("delivery_channel") or getattr(self.instance, "delivery_channel", BusinessInvitation.DeliveryChannels.MANUAL)
        role = attrs.get("role") or getattr(self.instance, "role", BusinessMember.Roles.STAFF)
        business_role = attrs.get("business_role") or getattr(self.instance, "business_role", None)
        team = attrs.get("team") if "team" in attrs else getattr(self.instance, "team", None)
        if email:
            attrs["email"] = email
        attrs["phone"] = phone
        attrs["telegram"] = telegram
        if delivery_channel == BusinessInvitation.DeliveryChannels.WHATSAPP and not phone:
            raise serializers.ValidationError("Phone is required for WhatsApp delivery.")
        if delivery_channel == BusinessInvitation.DeliveryChannels.TELEGRAM and not telegram:
            raise serializers.ValidationError("Telegram username or phone is required for Telegram delivery.")
        if business_role and business and business_role.business_id != business.id:
            raise serializers.ValidationError("Business role must belong to the selected business.")
        if team and business and team.business_id != business.id:
            raise serializers.ValidationError("Team must belong to the selected business.")
        if business and email and business.members.filter(user__email__iexact=email, is_active=True).exists():
            raise serializers.ValidationError("This user is already an active member of the business.")
        if business and email and business.invitations.filter(
            email__iexact=email,
            accepted_at__isnull=True,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).exclude(id=getattr(self.instance, "id", None)).exists():
            raise serializers.ValidationError("A pending invitation already exists for this user.")
        if role == BusinessMember.Roles.OWNER:
            raise serializers.ValidationError("Invite admins or staff from this screen. Ownership transfer must be explicit.")
        return attrs


class BusinessInvitationAcceptSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)

    def validate_password(self, value):
        validate_password(value)
        return value


class PermissionCatalogSerializer(serializers.Serializer):
    resources = serializers.SerializerMethodField()
    scopes = serializers.SerializerMethodField()

    def get_resources(self, obj):
        return [{"resource": resource, "actions": actions} for resource, actions in PERMISSION_CATALOG.items()]

    def get_scopes(self, obj):
        return [{"value": value, "label": label} for value, label in RolePermission.Scopes.choices]


class ActivateLandingBusinessSerializer(serializers.Serializer):
    landing_id = serializers.CharField(max_length=128)
    owner_email = serializers.EmailField()
    owner_password = serializers.CharField(required=False, allow_blank=True, write_only=True, min_length=8)
    owner_full_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    business_name = serializers.CharField(max_length=255)
    business_type = serializers.ChoiceField(choices=Business.BusinessTypes.choices, required=False, default=Business.BusinessTypes.OTHER)
    landing_domain = serializers.CharField(required=False, allow_blank=True, max_length=255)
    landing_preview_url = serializers.URLField(required=False, allow_blank=True)
    city = serializers.CharField(required=False, allow_blank=True, max_length=128)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
