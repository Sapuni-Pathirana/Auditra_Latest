"""
Tests for CreateEmployeeRemovalRequestView, AllRemovalRequestsView, ApproveRemovalRequestView, RejectRemovalRequestView.
"""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from authentication.models import UserRole


class TestRemovalRequestsAPI(BaseAuthAPITestCase):
    def _unique_hr(self):
        UserRole.objects.filter(role='hr_head').update(role='general_employee')
        return user_with_role(f'hr_{uuid.uuid4().hex[:8]}', 'hr_head')

    def test_create_removal_forbidden_non_hr_403(self):
        """CreateEmployeeRemovalRequestView: only HR head (negative)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        tgt = user_with_role(f'tgt_{uuid.uuid4().hex[:8]}', 'general_employee')
        c = api_client_with_jwt(fo)
        res = c.post(
            '/api/auth/removal-requests/create/',
            {'user_id': tgt.id, 'reason': 'test'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_removal_success_201(self):
        """CreateEmployeeRemovalRequestView: HR creates request (success)."""
        hr = self._unique_hr()
        tgt = user_with_role(f'tgt2_{uuid.uuid4().hex[:8]}', 'general_employee')
        c = api_client_with_jwt(hr)
        res = c.post(
            '/api/auth/removal-requests/create/',
            {'user_id': tgt.id, 'reason': 'resignation'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))

    def test_approve_forbidden_non_admin_403(self):
        """ApproveRemovalRequestView: field officer cannot approve (negative)."""
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.post(
            '/api/auth/removal-requests/99999/approve/', {}, format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_reject_removal_admin_200(self):
        """RejectRemovalRequestView: admin rejects pending request (success)."""
        hr = self._unique_hr()
        tgt = user_with_role(f'tgt3_{uuid.uuid4().hex[:8]}', 'client')
        c_hr = api_client_with_jwt(hr)
        r = c_hr.post(
            '/api/auth/removal-requests/create/',
            {'user_id': tgt.id, 'reason': 'x'},
            format='json',
        )
        rid = r.data['data']['id']
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.post(
            f'/api/auth/removal-requests/{rid}/reject/',
            {'admin_notes': 'kept'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
