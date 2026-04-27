"""
Tests for leave request APIs, statistics, balance, policy, and cancel.
"""
import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from authentication.models import LeaveBalance, LeaveRequest
from authentication.views import _normalize_intent


class TestLeaveHelpers(TestCase):
    """Pure helper _normalize_intent (PublicCheckEmailView)."""

    def test_normalize_intent_maps_aliases(self):
        """_normalize_intent: staff -> general_employee."""
        self.assertEqual(_normalize_intent('staff'), 'general_employee')

    def test_normalize_intent_empty(self):
        """_normalize_intent: empty string."""
        self.assertEqual(_normalize_intent(''), '')


@mock.patch('system_logs.utils.log_action', mock.Mock())
class TestLeaveAPI(BaseAuthAPITestCase):
    """CreateLeaveRequestView, lists, update, balance, policy, cancel."""

    def _unique_hr(self):
        from authentication.models import UserRole

        UserRole.objects.filter(role='hr_head').update(role='general_employee')
        return user_with_role(f'hr_{uuid.uuid4().hex[:8]}', 'hr_head')

    def test_create_leave_success_field_officer_201(self):
        """CreateLeaveRequestView: field officer can submit (success)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        start = date.today() + timedelta(days=14)
        end = start + timedelta(days=1)
        res = c.post(
            '/api/auth/leave-requests/create/',
            {
                'leave_type': 'annual',
                'start_date': str(start),
                'end_date': str(end),
                'reason': 'Test leave',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success'))

    def test_create_leave_hr_head_forbidden_403(self):
        """CreateLeaveRequestView: HR head cannot self-submit (negative)."""
        hr = self._unique_hr()
        c = api_client_with_jwt(hr)
        start = date.today() + timedelta(days=20)
        res = c.post(
            '/api/auth/leave-requests/create/',
            {
                'leave_type': 'casual',
                'start_date': str(start),
                'end_date': str(start),
                'reason': 'n/a',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_all_leave_requests_hr_200(self):
        """AllLeaveRequestsView: HR head lists requests (success)."""
        hr = self._unique_hr()
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        cfo = api_client_with_jwt(fo)
        start = date.today() + timedelta(days=30)
        cfo.post(
            '/api/auth/leave-requests/create/',
            {
                'leave_type': 'sick',
                'start_date': str(start),
                'end_date': str(start + timedelta(days=1)),
                'reason': ' flu ',
            },
            format='json',
        )
        c = api_client_with_jwt(hr)
        res = c.get('/api/auth/leave-requests/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))

    def test_my_leave_requests_200(self):
        """MyLeaveRequestsView: user sees only own requests."""
        fo = user_with_role(f'fo3_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/leave-requests/my/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_my_leave_statistics_200(self):
        """MyLeaveStatisticsView.get: returns stats."""
        fo = user_with_role(f'fo4_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/leave-requests/statistics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_leave_balance_200(self):
        """LeaveBalanceView.get: returns balances (may be empty)."""
        fo = user_with_role(f'fo5_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/leave-balance/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('balances', res.data)

    def test_leave_policies_list_200(self):
        """LeavePolicyListView: lists policies."""
        u = user_with_role(f'u_{uuid.uuid4().hex[:8]}', 'general_employee')
        c = api_client_with_jwt(u)
        res = c.get('/api/auth/leave-policies/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_hr_updates_leave_approved_200(self):
        """UpdateLeaveRequestView: HR approves pending request (success)."""
        hr = self._unique_hr()
        fo = user_with_role(f'fo6_{uuid.uuid4().hex[:8]}', 'field_officer')
        cfo = api_client_with_jwt(fo)
        start = date.today() + timedelta(days=40)
        r = cfo.post(
            '/api/auth/leave-requests/create/',
            {
                'leave_type': 'annual',
                'start_date': str(start),
                'end_date': str(start + timedelta(days=1)),
                'reason': 'vacation',
            },
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        lr_id = r.data['data']['id']
        c = api_client_with_jwt(hr)
        res = c.patch(
            f'/api/auth/leave-requests/{lr_id}/update/',
            {'status': 'approved'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))

    def test_update_leave_non_hr_403(self):
        """UpdateLeaveRequestView: field officer cannot approve (negative)."""
        hr = self._unique_hr()
        fo = user_with_role(f'fo7_{uuid.uuid4().hex[:8]}', 'field_officer')
        other = user_with_role(f'fo8_{uuid.uuid4().hex[:8]}', 'field_officer')
        c_other = api_client_with_jwt(other)
        start = date.today() + timedelta(days=50)
        r = c_other.post(
            '/api/auth/leave-requests/create/',
            {
                'leave_type': 'casual',
                'start_date': str(start),
                'end_date': str(start),
                'reason': 'x',
            },
            format='json',
        )
        lr_id = r.data['data']['id']
        c = api_client_with_jwt(fo)
        res = c.patch(
            f'/api/auth/leave-requests/{lr_id}/update/',
            {'status': 'approved'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_monthly_leave_summary_hr_200(self):
        """MonthlyLeaveSummaryView: HR head gets summary (success)."""
        hr = self._unique_hr()
        c = api_client_with_jwt(hr)
        res = c.get('/api/auth/leave-requests/summary/monthly/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))

    def test_monthly_leave_summary_non_hr_403(self):
        """MonthlyLeaveSummaryView: non-HR forbidden (negative)."""
        fo = user_with_role(f'fo_m_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/leave-requests/summary/monthly/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_cancel_approved_future_leave_200(self):
        """CancelLeaveRequestView: cancels approved future leave (success)."""
        hr = self._unique_hr()
        fo = user_with_role(f'fo9_{uuid.uuid4().hex[:8]}', 'field_officer')
        cfo = api_client_with_jwt(fo)
        start = date.today() + timedelta(days=60)
        cfo.post(
            '/api/auth/leave-requests/create/',
            {
                'leave_type': 'annual',
                'start_date': str(start),
                'end_date': str(start + timedelta(days=1)),
                'reason': 'cancel me',
            },
            format='json',
        )
        lr = LeaveRequest.objects.filter(user=fo).order_by('-id').first()
        lr.status = 'approved'
        lr.save()
        LeaveBalance.objects.get_or_create(
            user=fo,
            year=start.year,
            leave_type=lr.leave_type,
            defaults={'used_days': Decimal('2')},
        )
        c = api_client_with_jwt(fo)
        res = c.post(f'/api/auth/leave-requests/{lr.id}/cancel/', {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lr.refresh_from_db()
        self.assertEqual(lr.status, 'cancelled_by_user')
