"""
Tests for ChangePasswordView and password reset flow (PasswordResetRequestView,
PasswordResetVerifyOTPView, PasswordResetConfirmView).
"""
import uuid
from unittest.mock import patch

from django.test import override_settings
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestChangePassword(BaseAuthAPITestCase):
    """ChangePasswordView.post"""

    def test_change_password_missing_fields_400(self):
        """ChangePasswordView: missing old_password (negative)."""
        u = user_with_role(f'cp_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.post('/api/auth/change-password/', {'new_password': 'Newpass123!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_wrong_old_400(self):
        """ChangePasswordView: wrong old password (negative)."""
        u = user_with_role(f'cp2_{uuid.uuid4().hex[:8]}', 'field_officer')
        u.set_password('OldPassword123!')
        u.save()
        c = api_client_with_jwt(u)
        res = c.post(
            '/api/auth/change-password/',
            {'old_password': 'Wrong', 'new_password': 'NewPassword99!'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_success_200(self):
        """ChangePasswordView: valid old + new password (success)."""
        u = user_with_role(f'cp3_{uuid.uuid4().hex[:8]}', 'field_officer')
        u.set_password('OldPassword123!')
        u.save()
        c = api_client_with_jwt(u)
        res = c.post(
            '/api/auth/change-password/',
            {'old_password': 'OldPassword123!', 'new_password': 'NewPassword99!'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        u.refresh_from_db()
        self.assertTrue(u.check_password('NewPassword99!'))


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class TestPasswordResetFlow(BaseAuthAPITestCase):
    """Password reset views"""

    @patch('authentication.services.EmailService.send_otp_email', return_value=True)
    def test_reset_request_success_200(self, _mock_send):
        """PasswordResetRequestView: existing user receives 200 when email sends."""
        u = user_with_role(f'prq_{uuid.uuid4().hex[:8]}', 'general_employee')
        res = self.client.post('/api/auth/password-reset/request/', {'email': u.email}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_reset_request_unknown_email_404(self):
        """PasswordResetRequestView: unknown email (negative)."""
        res = self.client.post(
            '/api/auth/password-reset/request/',
            {'email': 'missing_nobody@example.com'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    @patch('authentication.services.EmailService.send_otp_email', return_value=True)
    def test_verify_and_confirm_flow(self, _mock_send):
        """PasswordResetVerifyOTPView + PasswordResetConfirmView end-to-end."""
        u = user_with_role(f'pvc_{uuid.uuid4().hex[:8]}', 'general_employee')
        self.client.post('/api/auth/password-reset/request/', {'email': u.email}, format='json')
        from authentication.models import PasswordResetOTP

        otp_obj = PasswordResetOTP.objects.filter(email__iexact=u.email).first()
        self.assertIsNotNone(otp_obj)
        res = self.client.post(
            '/api/auth/password-reset/verify-otp/',
            {'email': u.email, 'otp': otp_obj.otp},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res2 = self.client.post(
            '/api/auth/password-reset/confirm/',
            {'email': u.email, 'new_password': 'ResetPass99!'},
            format='json',
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        u.refresh_from_db()
        self.assertTrue(u.check_password('ResetPass99!'))

    def test_verify_otp_invalid_400(self):
        """PasswordResetVerifyOTPView: bad OTP (negative)."""
        res = self.client.post(
            '/api/auth/password-reset/verify-otp/',
            {'email': 'x@y.com', 'otp': '000000'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
