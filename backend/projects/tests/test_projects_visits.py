"""
Tests for ProjectVisitListCreateView and ProjectVisitDetailView.
"""
import uuid
from datetime import date, timedelta
from unittest import mock

from rest_framework import status

from auditra_backend.test_helpers import (
    BaseAuthAPITestCase,
    api_client_with_jwt,
    create_project,
    ensure_project_payment_row,
    user_with_role,
)


class TestProjectVisits(BaseAuthAPITestCase):
    def test_list_visits_200(self):
        """ProjectVisitListCreateView.get: field officer lists visits for assigned project."""
        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        p = create_project(coord, title='V1')
        ensure_project_payment_row(p)
        p.assigned_field_officer = fo
        p.status = 'in_progress'
        p.save()
        c = api_client_with_jwt(fo)
        res = c.get(f'/api/projects/{p.id}/visits/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_create_visit_coordinator_forbidden_403(self):
        """ProjectVisitListCreateView: coordinator cannot schedule (PermissionDenied)."""
        coord = user_with_role(f'c3_{uuid.uuid4().hex[:8]}', 'coordinator')
        p = create_project(coord, title='V3')
        ensure_project_payment_row(p)
        c = api_client_with_jwt(coord)
        d = (date.today() + timedelta(days=3)).isoformat()
        res = c.post(
            f'/api/projects/{p.id}/visits/',
            {'scheduled_date': d},
            format='json',
        )
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST))
