"""Catalog and depreciation API tests."""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestCatalogAPI(BaseAuthAPITestCase):
    def test_item_catalog_requires_auth_401(self):
        """ItemCatalogListView: anonymous (negative)."""
        res = self.client.get('/api/catalog/items/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_item_catalog_200(self):
        """ItemCatalogListView: authenticated list."""
        u = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/catalog/items/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_depreciation_policies_200(self):
        """DepreciationPolicyListView.get."""
        u = user_with_role(f'c2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/catalog/depreciation/policies/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
