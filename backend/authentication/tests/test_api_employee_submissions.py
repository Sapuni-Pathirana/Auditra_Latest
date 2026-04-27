"""
Tests for employee submission list, detail, hire, RoleSalariesView.
"""
import uuid
from datetime import date

from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from authentication.models import EmployeeFormSubmission


class TestEmployeeSubmissionsAPI(BaseAuthAPITestCase):
    def test_all_employee_submissions_admin_200(self):
        """AllEmployeeSubmissionsView: admin can list."""
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        EmployeeFormSubmission.objects.create(
            email=f'e_{uuid.uuid4().hex[:8]}@example.com',
            birthday=date(1990, 1, 1),
        )
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/employee-submissions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_all_employee_submissions_forbidden_403(self):
        """AllEmployeeSubmissionsView: non-admin (negative)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get('/api/auth/employee-submissions/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_salaries_admin_200(self):
        """RoleSalariesView: admin gets salary map."""
        admin = user_with_role(f'adm2_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/role-salaries/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
