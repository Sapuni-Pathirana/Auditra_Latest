"""
Tests for RegisterView, LoginView, and JWT refresh (SimpleJWT TokenRefreshView).

Each test documents the view and whether it expects success or a negative outcome.
"""
import uuid

from django.urls import reverse
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, refresh_pair_for, user_with_role


class TestRegisterLoginRefresh(BaseAuthAPITestCase):
    """RegisterView, LoginView, token refresh."""

    def test_register_success_201(self):
        """RegisterView.create: valid payload returns 201 with tokens."""
        uid = uuid.uuid4().hex[:10]
        res = self.client.post(
            '/api/auth/register/',
            {
                'username': f'reg_{uid}',
                'email': f'reg_{uid}@example.com',
                'password': 'TestPassword123!',
                'password2': 'TestPassword123!',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)

    def test_register_password_mismatch_400(self):
        """RegisterView: mismatching password2 fails validation (fail case)."""
        uid = uuid.uuid4().hex[:10]
        res = self.client.post(
            '/api/auth/register/',
            {
                'username': f'bad_{uid}',
                'email': f'bad_{uid}@example.com',
                'password': 'TestPassword123!',
                'password2': 'OtherPassword123!',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success_200(self):
        """LoginView.post: correct credentials return 200 and JWT."""
        u = user_with_role(f'log_{uuid.uuid4().hex[:8]}', 'field_officer')
        u.set_password('TestPassword123!')
        u.save()
        res = self.client.post(
            '/api/auth/login/',
            {'username': u.username, 'password': 'TestPassword123!'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_login_wrong_password_401(self):
        """LoginView.post: wrong password (negative test)."""
        u = user_with_role(f'fail_{uuid.uuid4().hex[:8]}', 'field_officer')
        u.set_password('TestPassword123!')
        u.save()
        res = self.client.post(
            '/api/auth/login/',
            {'username': u.username, 'password': 'WrongPassword999!'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_email_fallback_backend(self):
        """Login + EmailOrUsernameBackend: login using email as username."""
        uid = uuid.uuid4().hex[:8]
        email = f'emailonly_{uid}@example.com'
        u = user_with_role(f'u_{uid}', 'general_employee', email=email)
        u.set_password('TestPassword123!')
        u.save()
        res = self.client.post(
            '/api/auth/login/',
            {'username': email, 'password': 'TestPassword123!'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_jwt_refresh_success(self):
        """TokenRefreshView: valid refresh issues new access token."""
        u = user_with_role(f'ref_{uuid.uuid4().hex[:8]}', 'general_employee')
        refresh, _access = refresh_pair_for(u)
        res = self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_jwt_refresh_invalid_401(self):
        """TokenRefreshView: garbage refresh token (negative)."""
        res = self.client.post(
            '/api/auth/refresh/', {'refresh': 'not-a-valid-refresh'}, format='json'
        )
        self.assertIn(res.status_code, (400, 401))

    def test_profile_requires_auth_401(self):
        """UserProfileView: unauthenticated request returns 401."""
        res = self.client.get('/api/auth/profile/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_authenticated_200(self):
        """UserProfileView: authenticated user gets own profile."""
        u = user_with_role(f'pr_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/auth/profile/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('username'), u.username)
