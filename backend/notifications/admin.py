from django.contrib import admin
from .models import Notification, NotificationPreference, DeviceToken


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'category', 'severity', 'is_read', 'created_at']
    list_filter = ['category', 'severity', 'is_read']
    search_fields = ['user__username', 'title']


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'category', 'in_app', 'email', 'push']
    list_filter = ['category']


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'platform', 'created_at']
    list_filter = ['platform']
