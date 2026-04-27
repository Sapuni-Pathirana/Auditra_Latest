"""
Tests for ClientRegistrationView and EmployeeRegistrationView (public endpoints).
"""
import uuid
from unittest.mock import patch

from django.test import override_settings
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, user_with_role


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class TestClientEmployeeRegister(BaseAuthAPITestCase):
    def test_client_registration_success_201(self):
        """ClientRegistrationView: valid data creates submission (success)."""
        uid = uuid.uuid4().hex[:8]
        res = self.client.post(
            '/api/clients/register/',
            {
                'first_name': 'A',
                'last_name': 'B',
                'email': f'c_{uid}@example.com',
                'project_title': f'Proj {uid}',
                'project_description': 'Description text here.',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))

    def test_client_registration_validation_400(self):
        """ClientRegistrationView: missing required project_description (fail)."""
        res = self.client.post(
            '/api/clients/register/',
            {
                'email': 'x@y.com',
                'project_title': 't',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('authentication.services.EmailService.send_submission_confirmation')
    def test_employee_registration_success_201(self, _m):
        """EmployeeRegistrationView: creates employee submission (success)."""
        uid = uuid.uuid4().hex[:8]
        res = self.client.post(
            '/api/employees/register/',
            {
                'first_name': 'E',
                'last_name': 'F',
                'email': f'emp_{uid}@example.com',
                'birthday': '1991-05-15',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_employee_registration_duplicate_email_400(self):
        """EmployeeRegistrationView: email already on User account (negative)."""
        uid = uuid.uuid4().hex[:8]
        u = user_with_role(f'u_{uid}', 'general_employee', email=f'taken_{uid}@example.com')
        res = self.client.post(
            '/api/employees/register/',
            {
                'first_name': 'E',
                'last_name': 'F',
                'email': u.email,
                'birthday': '1991-01-01',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
