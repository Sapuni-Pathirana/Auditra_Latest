"""System logs API tests."""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestSystemLogsAPI(BaseAuthAPITestCase):
    def test_log_list_forbidden_non_admin_403(self):
        """SystemLogListView: non-admin (negative)."""
        u = user_with_role(f'u_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/system-logs/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_log_list_admin_200(self):
        """SystemLogListView: admin can list (success)."""
        admin = user_with_role(f'a_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/system-logs/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('results', res.data)
