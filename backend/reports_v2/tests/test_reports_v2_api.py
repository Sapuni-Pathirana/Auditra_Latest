"""Reports v2 API smoke tests."""
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase


class TestReportsV2API(BaseAuthAPITestCase):
    def test_report_items_list_requires_auth_401(self):
        """ReportItemListCreateView: anonymous (negative)."""
        res = self.client.get('/api/projects/1/report-items/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
