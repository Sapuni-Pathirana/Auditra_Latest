"""Model tests: SystemLog.__str__ and compute_hash."""
import uuid
from datetime import datetime, timezone as dt_timezone

from django.contrib.auth.models import User
from django.test import TestCase

from system_logs.models import SystemLog


class TestSystemLogModel(TestCase):
    def _make(self, **kwargs):
        defaults = {
            'block_index': 1,
            'action': 'USER_LOGIN',
            'category': 'auth',
            'description': 'Test action',
            'previous_hash': '0' * 64,
            'current_hash': '1' * 64,
        }
        defaults.update(kwargs)
        return SystemLog.objects.create(**defaults)

    def test_str(self):
        u = User.objects.create_user('sl_u', f'{uuid.uuid4().hex}@t.com', 'P@ss1!')
        log = self._make(
            user=u,
            block_index=42,
            action='USER_LOGIN',
        )
        s = str(log)
        self.assertIn('42', s)
        self.assertIn('USER_LOGIN', s)

    def test_compute_hash_deterministic(self):
        u = User.objects.create_user('sl_h', f'{uuid.uuid4().hex}@h.com', 'P@ss1!')
        ts = datetime(2025, 1, 1, 12, 0, 0, tzinfo=dt_timezone.utc)
        log = SystemLog(
            block_index=5,
            action='VALUATION_CREATED',
            category='valuation',
            user=u,
            description='d',
            previous_hash='a' * 64,
            current_hash='b' * 64,
        )
        log.timestamp = ts
        h1 = log.compute_hash()
        h2 = log.compute_hash()
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)
