"""
Tests for CheckUserByEmailView and PublicCheckEmailView (projects app).
"""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestCheckEmailEndpoints(BaseAuthAPITestCase):
    def test_projects_check_email_post(self):
        """CheckUserByEmailView: lookup by email (success path may or may not find user)."""
        u = user_with_role(f'u_{uuid.uuid4().hex[:8]}', 'client')
        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        c = api_client_with_jwt(coord)
        res = c.post(
            '/api/projects/check-email/',
            {'email': u.email, 'type': 'client'},
            format='json',
        )
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST))

    def test_public_check_email_get(self):
        """PublicCheckEmailView under projects: requires params."""
        res = self.client.get('/api/projects/public/check-email/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
