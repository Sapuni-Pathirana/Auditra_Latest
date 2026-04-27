"""
Tests for payment slip related views: GeneratePaymentSlipsView, UploadPaymentSlipsView,
MyPaymentSlipsView, AllPaymentSlipsView, PaymentSlipDetailView, overtime/sync variants.
"""
import uuid
from decimal import Decimal

from django.utils import timezone
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from authentication.models import PaymentSlip


class TestPaymentSlipsAPI(BaseAuthAPITestCase):
    """Payment slip endpoints."""

    def test_generate_forbidden_field_officer_403(self):
        """GeneratePaymentSlipsView: field officer forbidden (negative)."""
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.post(
            '/api/auth/payment-slips/generate/',
            {'month': timezone.now().month, 'year': timezone.now().year},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_generate_success_admin_201(self):
        """GeneratePaymentSlipsView: admin can trigger generation (success)."""
        from authentication.models import UserRole

        UserRole.objects.filter(role='hr_head').update(role='general_employee')
        admin = user_with_role(f'adm_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        now = timezone.now()
        res = c.post(
            '/api/auth/payment-slips/generate/',
            {'month': now.month, 'year': now.year, 'force_regenerate': True},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data.get('success', True))

    def test_generate_invalid_month_400(self):
        """GeneratePaymentSlipsView: invalid month (negative)."""
        admin = user_with_role(f'adm2_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.post(
            '/api/auth/payment-slips/generate/',
            {'month': 13, 'year': 2025},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_slips_404_when_none(self):
        """UploadPaymentSlipsView: no slips for period returns 404 (negative)."""
        admin = user_with_role(f'adm3_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.post(
            '/api/auth/payment-slips/upload/',
            {'month': 6, 'year': 2005},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_my_payment_slips_empty_200(self):
        """MyPaymentSlipsView: employee with no slips still 200."""
        ge = user_with_role(f'ge_{uuid.uuid4().hex[:8]}', 'general_employee')
        c = api_client_with_jwt(ge)
        res = c.get('/api/auth/payment-slips/my/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_all_payment_slips_admin_200(self):
        """AllPaymentSlipsView: admin gets wrapped list."""
        admin = user_with_role(f'adm4_{uuid.uuid4().hex[:8]}', 'admin')
        c = api_client_with_jwt(admin)
        res = c.get('/api/auth/payment-slips/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data.get('success'))
        self.assertIn('data', res.data)

    def test_payment_slip_detail_get_employee_404(self):
        """PaymentSlipDetailView: employee cannot retrieve others' slips (empty queryset -> 404)."""
        admin = user_with_role(f'adm5_{uuid.uuid4().hex[:8]}', 'admin')
        emp = user_with_role(f'emp_{uuid.uuid4().hex[:8]}', 'general_employee')
        slip = PaymentSlip.objects.create(
            user=emp,
            month=6,
            year=2025,
            salary=Decimal('50000.00'),
            role='general_employee',
            role_display='General Employee',
            generated_by=admin,
        )
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(fo)
        res = c.get(f'/api/auth/payment-slips/{slip.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_payment_slip_detail_admin_200(self):
        """PaymentSlipDetailView: admin can retrieve slip (success)."""
        admin = user_with_role(f'adm6_{uuid.uuid4().hex[:8]}', 'admin')
        emp = user_with_role(f'emp2_{uuid.uuid4().hex[:8]}', 'general_employee')
        slip = PaymentSlip.objects.create(
            user=emp,
            month=7,
            year=2025,
            salary=Decimal('50000.00'),
            role='general_employee',
            role_display='General Employee',
            generated_by=admin,
        )
        c = api_client_with_jwt(admin)
        res = c.get(f'/api/auth/payment-slips/{slip.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_upload_overtime_forbidden_403(self):
        """UploadOvertimeHoursView: non-admin/hr cannot upload (negative)."""
        fo = user_with_role(f'fo3_{uuid.uuid4().hex[:8]}', 'field_officer')
        admin = user_with_role(f'adm7_{uuid.uuid4().hex[:8]}', 'admin')
        emp = user_with_role(f'emp3_{uuid.uuid4().hex[:8]}', 'general_employee')
        slip = PaymentSlip.objects.create(
            user=emp,
            month=8,
            year=2025,
            salary=Decimal('50000.00'),
            role='general_employee',
            role_display='General Employee',
            generated_by=admin,
        )
        c = api_client_with_jwt(fo)
        res = c.post(
            f'/api/auth/payment-slips/{slip.id}/upload-overtime/',
            {'overtime_hours': 2},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
