"""
Unit tests for authentication.serializers (validation rules).
"""
from django.contrib.auth.models import User
from django.test import TestCase

from authentication.models import UserRole
from authentication.serializers import (
    AssignRoleSerializer,
    UserRegistrationSerializer,
)


class TestUserRegistrationSerializer(TestCase):
    def test_password_mismatch_validation(self):
        """UserRegistrationSerializer.validate: mismatching passwords raise error."""
        s = UserRegistrationSerializer(
            data={
                'username': 't1',
                'email': 't1@example.com',
                'password': 'TestPassword123!',
                'password2': 'Other123!',
            }
        )
        self.assertFalse(s.is_valid())
        self.assertIn('password', s.errors)

    def test_create_user(self):
        """UserRegistrationSerializer.create: persists user."""
        s = UserRegistrationSerializer(
            data={
                'username': 't2user',
                'email': 't2@example.com',
                'password': 'TestPassword123!',
                'password2': 'TestPassword123!',
            }
        )
        self.assertTrue(s.is_valid(), s.errors)
        user = s.save()
        self.assertTrue(User.objects.filter(username='t2user').exists())
        self.assertTrue(user.check_password('TestPassword123!'))


class TestAssignRoleSerializer(TestCase):
    def test_invalid_user_id(self):
        """AssignRoleSerializer.validate_user_id: unknown id fails."""
        s = AssignRoleSerializer(data={'user_id': 99999999, 'role': 'field_officer'})
        self.assertFalse(s.is_valid())

    def test_admin_role_forbidden(self):
        """AssignRoleSerializer.validate_role: admin role rejected."""
        u = User.objects.create_user(username='x', email='x@y.com', password='p')
        UserRole.objects.filter(user=u).update(role='unassigned')
        s = AssignRoleSerializer(data={'user_id': u.id, 'role': 'admin'})
        self.assertFalse(s.is_valid())
