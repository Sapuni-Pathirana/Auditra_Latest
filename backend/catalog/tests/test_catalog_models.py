"""Model tests: ItemCatalog, ExternalSource, DepreciationPolicy."""
import uuid
from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase

from auditra_backend.test_helpers import user_with_role
from catalog.models import DepreciationPolicy, ExternalSource, ItemCatalog


class TestCatalogModels(TestCase):
    def test_item_catalog_str(self):
        u = user_with_role(f'cc_{uuid.uuid4().hex[:8]}', 'coordinator')
        it = ItemCatalog.objects.create(
            title='Plot A', category='land', created_by=u, source='internal'
        )
        self.assertIn('Plot A', str(it))
        self.assertIn('land', str(it))

    def test_item_catalog_unique_title_category(self):
        ItemCatalog.objects.create(title='X', category='other', source='internal')
        with self.assertRaises(IntegrityError):
            ItemCatalog.objects.create(title='X', category='other', source='external')

    def test_external_source_str(self):
        s = ExternalSource.objects.create(name='src1', is_active=True)
        self.assertIn('active', str(s).lower())
        s.is_active = False
        s.save()
        self.assertIn('inactive', str(s).lower())

    def test_depreciation_policy_str_and_uniqueness(self):
        p, _ = DepreciationPolicy.objects.get_or_create(
            category='vehicle',
            method='diminishing_balance',
            defaults={'default_rate': Decimal('0.1')},
        )
        self.assertIn('vehicle', str(p).lower())
        with self.assertRaises(IntegrityError):
            DepreciationPolicy.objects.create(
                category='vehicle',
                method='diminishing_balance',
                default_rate=Decimal('0.2'),
            )
