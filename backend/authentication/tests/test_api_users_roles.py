"""
Tests for AssignRoleView, DeleteUserView, AllUsersView, RoleListView, MyRoleView.
"""
import uuid
from unittest import mock

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, create_user, user_with_role


@mock.patch('authentication.views._notify_auth_users', mock.Mock())
@mock.patch('system_logs.utils.log_action', mock.Mock())
class TestUsersAndRoles(BaseAuthAPITestCase):
    """Role and user management endpoints."""

    def test_assign_role_forbidden_for_non_admin_403(self):
        """AssignRoleView: non-admin cannot assign roles (negative)."""
        user_with_role(f'a_{uuid.uuid4().hex[:8]}', 'admin')
        target = user_with_role(f't_{uuid.uuid4().hex[:8]}', 'unassigned')
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.post(
            '/api/auth/assign-role/',
            {'user_id': target.id, 'role': 'coordinator'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_assign_role_success_200(self):
        """AssignRoleView: admin assigns a non-admin role (success)."""
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        target = create_user(f'tgt_{uuid.uuid4().hex[:8]}')
        c = api_client_with_jwt(admin)
        res = c.post(
            '/api/auth/assign-role/',
            {'user_id': target.id, 'role': 'field_officer'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertEqual(target.role.role, 'field_officer')

    def test_delete_user_forbidden_non_admin_403(self):
        """DeleteUserView: field officer cannot delete (negative)."""
        user_with_role(f'adm2_{uuid.uuid4().hex[:8]}', 'admin')
        target = user_with_role(f'victim_{uuid.uuid4().hex[:8]}', 'client')
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.delete(f'/api/auth/users/{target.id}/delete/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_user_not_found_404(self):
        """DeleteUserView.delete: unknown user id returns 404 (negative)."""
        admin = user_with_role(f'adm3_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.delete('/api/auth/users/999999999/delete/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_all_users_empty_for_field_officer(self):
        """AllUsersView: non-admin/hr gets empty list (queryset none)."""
        fo = user_with_role(f'fo3_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_all_users_hr_head_sees_users(self):
        """AllUsersView: HR head can list users (success)."""
        from authentication.models import UserRole

        UserRole.objects.filter(role='hr_head').update(role='general_employee')
        hr = user_with_role(f'hr_{uuid.uuid4().hex[:8]}', 'hr_head')
        c = api_client_with_jwt(hr)
        res = c.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data), 1)

    def test_role_list_authenticated_200(self):
        """RoleListView.get: any authenticated user receives role list."""
        u = user_with_role(f'rl_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/auth/roles/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('roles', res.data)

    def test_my_role_200(self):
        """MyRoleView.get: returns current user's role."""
        u = user_with_role(f'mr_{uuid.uuid4().hex[:8]}', 'accessor')
        c = api_client_with_jwt(u)
        res = c.get('/api/auth/my-role/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('role'), 'accessor')
