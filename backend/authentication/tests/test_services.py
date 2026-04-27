"""Unit tests for authentication.services.EmailService (locmem backend)."""
import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core import mail
from django.test import TestCase, override_settings

from auditra_backend.test_helpers import create_user, set_user_role, user_with_role
from authentication.services import EmailService


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='noreply@test.example.com',
    FRONTEND_URL='http://test-frontend.example',
)
class TestEmailService(TestCase):
    def setUp(self):
        mail.outbox.clear()

    def test_send_otp_email_sends_message(self):
        ok = EmailService.send_otp_email('user@test.example.com', '123456')
        self.assertTrue(ok)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('123456', mail.outbox[0].body)
        self.assertIn('Password Reset', mail.outbox[0].subject)

    def test_send_account_credentials_sends_html_and_plain(self):
        ok = EmailService.send_account_credentials(
            'new@test.example.com',
            'newuser',
            'TempPass9!',
            'employee',
            name='Test User',
            role='Field Officer',
            salary=Decimal('50000.00'),
        )
        self.assertTrue(ok)
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertIn('newuser', msg.body)
        self.assertIn('Field Officer', msg.body)
        self.assertTrue(msg.alternatives)
        self.assertIn('Welcome to Auditra', msg.alternatives[0][0])

    def test_send_submission_confirmation(self):
        ok = EmailService.send_submission_confirmation(
            'sub@test.example.com',
            'Applicant',
            'client',
            project_title='My Project',
        )
        self.assertTrue(ok)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('My Project', mail.outbox[0].alternatives[0][0])

    def test_send_payment_request_no_client_email_returns_false(self):
        from projects.models import Project

        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        client = create_user(f'cl_{uuid.uuid4().hex[:8]}', email='')
        set_user_role(client, 'client')
        proj = Project.objects.create(coordinator=coord, title='P1', description='d')
        ok = EmailService.send_payment_request_to_client(
            proj, client, Decimal('100.00')
        )
        self.assertFalse(ok)
        self.assertEqual(len(mail.outbox), 0)

    def test_send_employee_status_update_no_email_returns_false(self):
        sub = SimpleNamespace(
            email='',
            STATUS_CHOICES=[('pending', 'Pending')],
            first_name='A',
            last_name='B',
        )
        ok = EmailService.send_employee_status_update(sub, 'pending')
        self.assertFalse(ok)

    def test_send_mail_exception_returns_false(self):
        with patch('authentication.services.send_mail', side_effect=RuntimeError('smtp down')):
            ok = EmailService.send_otp_email('x@test.example.com', '111')
        self.assertFalse(ok)

    def test_send_assignment_rejection_to_admin_with_admin(self):
        # Pass email in user_with_role; do not call user.save() afterwards — a second save
        # can trigger save_user_role with a stale `user.role` cache and reset role to unassigned.
        admin_u = user_with_role(
            f'adm_{uuid.uuid4().hex[:8]}',
            'admin',
            email='admin_reject_test@example.com',
        )
        sub = MagicMock()
        sub.project_title = 'Proj A'
        sub.first_name = 'John'
        sub.last_name = 'Doe'
        coord = create_user('coord_rj', email='coord@example.com')
        ok = EmailService.send_assignment_rejection_to_admin(
            sub, coord, 'Too busy'
        )
        self.assertTrue(ok)
        self.assertGreaterEqual(len(mail.outbox), 1)
