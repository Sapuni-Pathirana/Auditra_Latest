"""
Tests for client submission views: list, detail, assign coordinator, approve, accept/reject assignment.
"""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from authentication.models import ClientFormSubmission


class TestClientSubmissionsAPI(BaseAuthAPITestCase):
    def test_all_submissions_forbidden_field_officer_403(self):
        """AllClientSubmissionsView: field officer forbidden (negative)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/client-submissions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_all_submissions_admin_200(self):
        """AllClientSubmissionsView: admin lists submissions (success)."""
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        ClientFormSubmission.objects.create(
            email=f'c_{uuid.uuid4().hex[:8]}@example.com',
            project_title='P1',
            project_description='D1',
        )
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/client-submissions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_client_submission_detail_404(self):
        """ClientSubmissionDetailView.get: missing id (negative)."""
        admin = user_with_role(f'adm2_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/client-submissions/999999/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_available_coordinators_200(self):
        """AvailableCoordinatorsView: returns coordinator list."""
        admin = user_with_role(f'adm3_{uuid.uuid4().hex[:8]}', 'admin')
        user_with_role(f'coord_{uuid.uuid4().hex[:8]}', 'coordinator')
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/coordinators/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
