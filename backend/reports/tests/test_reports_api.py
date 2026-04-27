"""Reports (legacy) API smoke tests."""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestReportsAPI(BaseAuthAPITestCase):
    def test_get_report_requires_auth_401(self):
        """get_or_create_report: unauthenticated (negative)."""
        res = self.client.get('/api/reports/projects/1/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_report_field_officer_200_or_403_or_404(self):
        """get_or_create_report: field officer (response depends on project access)."""
        u = user_with_role(f'u_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/reports/projects/999999/')
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
