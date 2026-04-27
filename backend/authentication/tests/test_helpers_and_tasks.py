"""
Tests for views.generate_password, authentication.tasks.compute_leave_deductions, and _notify_auth_users.
"""
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from authentication.views import _notify_auth_users, generate_password


class TestGeneratePassword(TestCase):
    def test_generate_password_length(self):
        """generate_password: returns requested length."""
        p = generate_password(12)
        self.assertEqual(len(p), 12)


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class TestComputeLeaveDeductions(TestCase):
    def test_compute_leave_deductions_runs(self):
        """compute_leave_deductions task: callable without error on empty DB."""
        from authentication.tasks import compute_leave_deductions

        out = compute_leave_deductions()
        self.assertEqual(out, 'ok')


class TestNotifyAuthUsers(TestCase):
    @patch('notifications.services.notify')
    def test_notify_skips_actor(self, mock_notify):
        """_notify_auth_users: skips notify for actor user (best-effort helper)."""
        actor = User.objects.create_user('actor_n', 'actor_n@example.com', 'TestPassword123!')
        other = User.objects.create_user('other_n', 'other_n@example.com', 'TestPassword123!')
        _notify_auth_users(
            [actor, other],
            category='t',
            severity='info',
            title='T',
            message='M',
            actor=actor,
        )
        notified_ids = {getattr(call[1]['user'], 'id', None) for call in mock_notify.call_args_list}
        self.assertNotIn(actor.id, notified_ids)
        self.assertIn(other.id, notified_ids)
