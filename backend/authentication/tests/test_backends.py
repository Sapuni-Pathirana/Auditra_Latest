"""
Tests for EmailOrUsernameBackend (authentication.backends).
"""
from django.contrib.auth.models import User
from django.test import TestCase

from authentication.backends import EmailOrUsernameBackend


class TestEmailOrUsernameBackend(TestCase):
    def setUp(self):
        self.backend = EmailOrUsernameBackend()
        self.user = User.objects.create_user(
            'backuser', 'backuser@example.com', 'SecretPassword123!'
        )

    def test_authenticate_username(self):
        """EmailOrUsernameBackend.authenticate: login with username."""
        u = self.backend.authenticate(
            None, username='backuser', password='SecretPassword123!'
        )
        self.assertEqual(u.id, self.user.id)

    def test_authenticate_email(self):
        """EmailOrUsernameBackend.authenticate: login with email."""
        u = self.backend.authenticate(
            None, username='backuser@example.com', password='SecretPassword123!'
        )
        self.assertEqual(u.id, self.user.id)

    def test_authenticate_wrong_password_none(self):
        """EmailOrUsernameBackend.authenticate: wrong password returns None (fail)."""
        u = self.backend.authenticate(None, username='backuser', password='wrong')
        self.assertIsNone(u)

    def test_authenticate_missing_credentials_none(self):
        """EmailOrUsernameBackend.authenticate: missing username/password returns None."""
        self.assertIsNone(self.backend.authenticate(None, username='', password='x'))
        self.assertIsNone(self.backend.authenticate(None, username='backuser', password=''))
