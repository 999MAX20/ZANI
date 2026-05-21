from rest_framework import serializers

from apps.accounts.models import User
from apps.businesses.access import PERMISSION_CATALOG
from apps.businesses.models import Business, BusinessMember, BusinessRole, RolePermission, RolePreset, Team, TeamMember


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = "__all__"
        read_only_fields = ["owner", "created_at", "updated_at"]


class BusinessMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)
    role_name = serializers.CharField(source="business_role.name", read_only=True)

    class Meta:
        model = BusinessMember
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_teams(self, obj):
        return [
            {"id": membership.team_id, "name": membership.team.name, "is_lead": membership.is_lead}
            for membership in obj.team_memberships.select_related("team").all()
        ]


class PermissionCatalogSerializer(serializers.Serializer):
    resources = serializers.SerializerMethodField()
    scopes = serializers.SerializerMethodField()

    def get_resources(self, obj):
        return [{"resource": resource, "actions": actions} for resource, actions in PERMISSION_CATALOG.items()]

    def get_scopes(self, obj):
        return [{"value": value, "label": label} for value, label in RolePermission.Scopes.choices]
