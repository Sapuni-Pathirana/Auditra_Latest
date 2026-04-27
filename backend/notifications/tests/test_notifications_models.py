"""Model tests for notifications app."""
import uuid

from django.db import IntegrityError
from django.test import TestCase

from auditra_backend.test_helpers import user_with_role
from notifications.models import DeviceToken, Notification, NotificationPreference


class TestNotificationModels(TestCase):
    def test_notification_str(self):
        u = user_with_role(f'mn_{uuid.uuid4().hex[:8]}', 'client')
        n = Notification.objects.create(user=u, title='Hello', message='Body', category='general')
        self.assertIn('Hello', str(n))
        self.assertIn(u.username, str(n))

    def test_notification_preference_str_and_uniqueness(self):
        u = user_with_role(f'mp_{uuid.uuid4().hex[:8]}', 'client')
        p = NotificationPreference.objects.create(
            user=u, category='project', in_app=True, email=False, push=False
        )
        self.assertIn('project', str(p))
        self.assertIn(u.username, str(p))
        with self.assertRaises(IntegrityError):
            NotificationPreference.objects.create(
                user=u, category='project', in_app=False, email=True, push=True
            )

    def test_device_token_str(self):
        u = user_with_role(f'md_{uuid.uuid4().hex[:8]}', 'field_officer')
        d = DeviceToken.objects.create(user=u, token='unique_tok_1', platform='web')
        self.assertIn('web', str(d))
        self.assertIn(u.username, str(d))
