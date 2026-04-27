"""Attendance API tests."""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role


class TestAttendanceAPI(BaseAuthAPITestCase):
    def test_today_attendance_requires_auth_401(self):
        """TodayAttendanceView: unauthenticated (negative)."""
        res = self.client.get('/api/attendance/today/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_today_attendance_authenticated_200(self):
        """TodayAttendanceView.get: returns payload for authenticated user."""
        u = user_with_role(f'u_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/attendance/today/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_mark_attendance_post(self):
        """MarkAttendanceView.post: may be 400 outside check-in window (negative) or 200."""
        u = user_with_role(f'u2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.post('/api/attendance/mark/', {}, format='json')
        self.assertIn(res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_200_OK))
