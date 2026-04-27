"""
Tests for AdminDashboardStatsView and AdminKPIView.
"""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestAdminKPI(BaseAuthAPITestCase):
    def test_dashboard_stats_forbidden_non_admin_403(self):
        """AdminDashboardStatsView: non-admin (negative)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/admin-dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_stats_admin_200(self):
        """AdminDashboardStatsView: admin receives stats (success)."""
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/admin-dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_users', res.data)

    def test_admin_kpi_forbidden_403(self):
        """AdminKPIView: non-admin (negative)."""
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/admin-kpis/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_kpi_admin_200(self):
        """AdminKPIView: admin receives KPI payload (success)."""
        admin = user_with_role(f'adm2_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/admin-kpis/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('on_time_delivery', res.data)
