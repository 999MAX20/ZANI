from rest_framework import serializers

from apps.scheduling.models import ScheduleException


class WeeklyDaySerializer(serializers.Serializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    is_day_off = serializers.BooleanField(default=False)


class ScheduleExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleException
        fields = ["id", "business", "resource", "date", "start_time", "end_time", "is_day_off"]

    def validate(self, attrs):
        business = attrs.get("business", getattr(self.instance, "business", None))
        resource = attrs.get("resource", getattr(self.instance, "resource", None))
        if resource and business and resource.business_id != business.id:
            raise serializers.ValidationError({"resource": "Resource must belong to this business."})
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": "End time must be after start time."})
        return attrs
