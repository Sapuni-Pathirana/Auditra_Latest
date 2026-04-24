"""
Central notification service.

Usage:
    from notifications.services import notify
    notify(user, category='project', title='...', message='...', meta={}, action_url='')
"""
import logging
from django.conf import settings
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


def notify(user, category='general', title='', message='', meta=None, action_url='', severity='info', email_subject=None):
    """
    Create a DB notification, push over WebSocket, optionally send FCM push + email.
    Safe to call synchronously from Django views/signals.
    """
    if meta is None:
        meta = {}

    from notifications.models import Notification, NotificationPreference, DeviceToken

    # 1. Check preference (default: in_app=True for all categories)
    pref, _ = NotificationPreference.objects.get_or_create(
        user=user,
        category=category,
        defaults={'in_app': True, 'email': False, 'push': False},
    )

    # 2. Create DB row if in_app
    notification = None
    if pref.in_app:
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            category=category,
            severity=severity,
            action_url=action_url,
            meta=meta,
        )

    # 3. WebSocket push (non-blocking)
    _push_websocket(user.id, notification)

    # 4. FCM push
    if pref.push:
        tokens = list(DeviceToken.objects.filter(user=user).values_list('token', flat=True))
        if tokens:
            _send_fcm(tokens, title, message, meta)

    # 5. Email
    if pref.email:
        _send_email(user, email_subject or title, message)

    return notification


def _push_websocket(user_id, notification):
    """Fire-and-forget channel layer push."""
    try:
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        payload = {
            'type': 'notification.message',
            'id': notification.id if notification else None,
            'title': notification.title if notification else '',
            'message': notification.message if notification else '',
            'category': notification.category if notification else 'general',
            'severity': notification.severity if notification else 'info',
            'action_url': notification.action_url if notification else '',
            'created_at': notification.created_at.isoformat() if notification else '',
        }
        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}',
            payload,
        )
    except Exception as exc:
        logger.warning("WebSocket push failed: %s", exc)


def _send_fcm(tokens, title, body, data):
    """Send FCM push notification."""
    try:
        import firebase_admin
        from firebase_admin import messaging, credentials

        creds_path = getattr(settings, 'FCM_CREDENTIALS_PATH', '')
        if not creds_path:
            return

        if not firebase_admin._apps:
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)

        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={str(k): str(v) for k, v in data.items()},
            tokens=tokens,
        )
        messaging.send_each_for_multicast(message)
    except Exception as exc:
        logger.warning("FCM push failed: %s", exc)


def _send_email(user, subject, body):
    """Send email notification."""
    try:
        from django.core.mail import send_mail
        from django.conf import settings as djsettings
        if not user.email:
            return
        send_mail(
            subject=subject,
            message=body,
            from_email=djsettings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as exc:
        logger.warning("Email notification failed: %s", exc)


# ------------------------------------------------------------------
# Bulk helpers for project/valuation events
# ------------------------------------------------------------------

def notify_project_team(project, category, title_template, message_template, meta=None, exclude_roles=None, action_url=''):
    """Notify all assigned project members according to role-based templates."""
    exclude_roles = exclude_roles or []
    role_users = _get_project_users(project, exclude_roles)
    for user, role in role_users:
        t = title_template.replace('{role}', role).replace('{project}', project.title)
        m = message_template.replace('{role}', role).replace('{project}', project.title)
        notify(user, category=category, title=t, message=m, meta=meta or {}, action_url=action_url)


def _get_project_users(project, exclude_roles=None):
    """Return list of (user, role_name) tuples for all assigned project users."""
    exclude_roles = exclude_roles or []
    pairs = []

    def add(user, role_name):
        if user and role_name not in exclude_roles:
            pairs.append((user, role_name))

    add(project.coordinator, 'coordinator')
    add(project.assigned_field_officer, 'field_officer')
    add(project.assigned_accessor, 'accessor')
    add(project.assigned_senior_valuer, 'senior_valuer')
    if project.has_agent:
        add(project.assigned_agent, 'agent')
    add(project.assigned_client, 'client')
    return pairs
