"""
Tests for ProjectListView and ProjectDetailView.

Note: list/detail responses use ProjectSerializer with nested `payment` and
prefetch paths; integration tests that create projects also call
`ensure_project_payment_row` from `auditra_backend.test_helpers` when a full
list/detail body is required.
"""
import uuid
from unittest import mock

from rest_framework import status

from auditra_backend.test_helpers import (
    BaseAuthAPITestCase,
    api_client_with_jwt,
    user_with_role,
)


@mock.patch('system_logs.utils.log_action', mock.Mock())
class TestProjectListDetail(BaseAuthAPITestCase):
    def test_project_list_requires_auth_401(self):
        """ProjectListView.get: anonymous user cannot list."""
        res = self.client.get('/api/projects/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_empty_project_list_200(self):
        """ProjectListView.get: admin with no projects returns 200 and empty list."""
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/projects/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_project_detail_404_wrong_id(self):
        """ProjectDetailView: nonexistent id returns 404."""
        u = user_with_role(f'adm2_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(u)
        res = c.get('/api/projects/999999999/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
