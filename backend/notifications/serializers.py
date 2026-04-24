from rest_framework import serializers
from .models import Notification, NotificationPreference, DeviceToken


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'category', 'severity', 'is_read', 'action_url', 'meta', 'created_at']
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ['id', 'category', 'in_app', 'email', 'push']


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ['id', 'token', 'platform', 'created_at']
        read_only_fields = ['id', 'created_at']
