from django.db import models
from django.contrib.auth.models import User


class Notification(models.Model):
    """Unified in-app notification for all workflow events."""

    CATEGORY_CHOICES = [
        ('project', 'Project'),
        ('valuation', 'Valuation'),
        ('chat', 'Chat Mention'),
        ('visit', 'Site Visit'),
        ('payment', 'Payment'),
        ('account', 'Account'),
        ('leave', 'Leave'),
        ('attendance', 'Attendance'),
        ('submission', 'Form Submission'),
        ('document', 'Document'),
        ('general', 'General'),
    ]

    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='app_notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='general')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='info')
    is_read = models.BooleanField(default=False)
    action_url = models.CharField(max_length=500, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'app_notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} -> {self.user.username}"


class NotificationPreference(models.Model):
    """Per-user per-category notification preferences."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_prefs')
    category = models.CharField(max_length=30, choices=Notification.CATEGORY_CHOICES)
    in_app = models.BooleanField(default=True)
    email = models.BooleanField(default=False)
    push = models.BooleanField(default=False)

    class Meta:
        db_table = 'notification_preferences'
        unique_together = ('user', 'category')

    def __str__(self):
        return f"{self.user.username} / {self.category}"


class DeviceToken(models.Model):
    """FCM device tokens for push notifications."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='device_tokens')
    token = models.TextField(unique=True)
    platform = models.CharField(max_length=20, choices=[('android', 'Android'), ('ios', 'iOS'), ('web', 'Web')], default='android')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'device_tokens'

    def __str__(self):
        return f"{self.user.username} - {self.platform}"
