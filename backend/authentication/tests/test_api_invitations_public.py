"""
Tests for InvitationListView and PublicCheckEmailView.
"""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from authentication.models import Invitation


class TestInvitationsAndPublic(BaseAuthAPITestCase):
    def test_invitations_forbidden_non_admin_403(self):
        """InvitationListView: non-admin (negative)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/invitations/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_invitations_admin_200(self):
        """InvitationListView: admin lists invitations (success)."""
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        Invitation.objects.create(
            email=f'inv_{uuid.uuid4().hex[:8]}@example.com',
            role='client',
            status='sent',
            invited_by=admin,
        )
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/invitations/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)

    def test_public_check_email_missing_params_400(self):
        """PublicCheckEmailView: missing email/intent (negative)."""
        res = self.client.get('/api/auth/public/check-email/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_check_email_new_user_200(self):
        """PublicCheckEmailView: unknown email returns exists false (success)."""
        res = self.client.get(
            '/api/auth/public/check-email/',
            {'email': f'new_{uuid.uuid4().hex[:8]}@example.com', 'intent': 'client'},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data.get('exists'))

    def test_public_check_email_conflict(self):
        """PublicCheckEmailView: existing user with different role may conflict."""
        u = user_with_role(f'ex_{uuid.uuid4().hex[:8]}', 'client')
        res = self.client.get(
            '/api/auth/public/check-email/',
            {'email': u.email, 'intent': 'field_officer'},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('exists'))
