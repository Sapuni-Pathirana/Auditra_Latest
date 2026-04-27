"""
Tests for UserProfileMeView and UserAvatarUploadView.
"""
import uuid

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestProfileMeAvatar(BaseAuthAPITestCase):
    def test_profile_me_get_200(self):
        """UserProfileMeView.get: returns user + profile block."""
        u = user_with_role(f'u_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/auth/profile/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('email'), u.email)

    def test_profile_me_patch_theme_200(self):
        """UserProfileMeView.patch: updates theme (success)."""
        u = user_with_role(f'u2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.patch(
            '/api/auth/profile/me/',
            {'theme_preference': 'dark'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_avatar_upload_missing_400(self):
        """UserAvatarUploadView: missing file (negative)."""
        u = user_with_role(f'u3_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.post('/api/auth/profile/me/avatar/', {}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_avatar_upload_success_200(self):
        """UserAvatarUploadView: small PNG upload (success)."""
        u = user_with_role(f'u4_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        img = SimpleUploadedFile(
            'a.png', b'\x89PNG\r\n\x1a\n' + b'\x00' * 20, content_type='image/png'
        )
        res = c.post('/api/auth/profile/me/avatar/', {'avatar': img}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('profile_image_url', res.data)
