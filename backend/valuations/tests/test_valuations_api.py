"""Valuations API tests."""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestValuationsAPI(BaseAuthAPITestCase):
    def test_valuation_list_requires_auth_401(self):
        """ValuationListCreateView: anonymous (negative)."""
        res = self.client.get('/api/valuations/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_valuation_list_authenticated_200(self):
        """ValuationListCreateView.get: authenticated user gets list (may be empty)."""
        u = user_with_role(f'v_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/valuations/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
