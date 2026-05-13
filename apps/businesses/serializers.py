from rest_framework import serializers

from apps.businesses.models import Business, BusinessMember


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = "__all__"
        read_only_fields = ["owner", "created_at", "updated_at"]


class BusinessMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessMember
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]
