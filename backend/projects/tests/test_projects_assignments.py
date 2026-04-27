"""
Tests for assignment views and "available" user lists.
"""
import uuid
from unittest import mock

from rest_framework import status

from auditra_backend.test_helpers import (
    BaseAuthAPITestCase,
    api_client_with_jwt,
    create_project,
    ensure_project_payment_row,
    user_with_role,
)


class TestProjectAssignments(BaseAuthAPITestCase):
    def test_available_field_officers_200(self):
        """AvailableFieldOfficersView: coordinator can list field officers."""
        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(coord)
        res = c.get('/api/projects/field-officers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_assign_field_officer_forbidden_client_403(self):
        """AssignFieldOfficerView: client cannot assign field officer (negative)."""
        coord = user_with_role(f'c2_{uuid.uuid4().hex[:8]}', 'coordinator')
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        cli = user_with_role(f'cl_{uuid.uuid4().hex[:8]}', 'client')
        p = create_project(coord, title='X')
        c = api_client_with_jwt(cli)
        res = c.post(
            f'/api/projects/{p.id}/assign-field-officer/',
            {'field_officer_id': fo.id},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_assigned_projects_200(self):
        """UserAssignedProjectsView: coordinator fetches field officer's projects."""
        fo = user_with_role(f'fo3_{uuid.uuid4().hex[:8]}', 'field_officer')
        coord = user_with_role(f'c3_{uuid.uuid4().hex[:8]}', 'coordinator')
        p = create_project(coord, title='UAP')
        ensure_project_payment_row(p)
        p.assigned_field_officer = fo
        p.status = 'in_progress'
        p.save()
        c = api_client_with_jwt(coord)
        res = c.get(f'/api/projects/users/{fo.id}/projects/field_officer/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('projects', res.data)
