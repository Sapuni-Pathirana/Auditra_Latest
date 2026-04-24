"""Celery tasks for the authentication / HR app."""
from celery import shared_task
from decimal import Decimal
from django.utils import timezone


@shared_task(name='authentication.compute_leave_deductions')
def compute_leave_deductions():
    """Monthly task: for each employee with approved leaves exceeding their
    monthly quota, compute the salary deduction and write it into the
    PaymentSlip for the current month (Feature #15 — C5).

    Quota: 1.5 days per month (≈ 18 days per year) unless the role defines
    something different. Override this constant via Django settings if needed.
    """
    from django.contrib.auth.models import User
    from authentication.models import (
        LeaveRequest, LeaveBalance, UserRole, PaymentSlip,
    )

    now = timezone.now()
    year = now.year
    month = now.month
    MONTHLY_QUOTA = Decimal('1.5')

    employees = User.objects.filter(
        role__role__in=[
            'general_employee', 'field_officer', 'coordinator',
            'accessor', 'senior_valuer',
        ],
        is_active=True,
    ).select_related('role')

    for user in employees:
        total_approved_this_month = LeaveRequest.objects.filter(
            user=user,
            status='approved',
            start_date__year=year,
            start_date__month=month,
        ).count()

        approved_days = Decimal('0')
        for lr in LeaveRequest.objects.filter(
            user=user,
            status='approved',
            start_date__year=year,
            start_date__month=month,
        ):
            approved_days += Decimal(str(lr.days))

        overflow = max(approved_days - MONTHLY_QUOTA, Decimal('0'))
        if overflow <= 0:
            continue

        role = user.role
        monthly_salary = role.salary
        if not monthly_salary or monthly_salary <= 0:
            continue

        working_days_per_month = Decimal('22')
        daily_salary = monthly_salary / working_days_per_month
        deduction = (daily_salary * overflow).quantize(Decimal('0.01'))

        slip, created = PaymentSlip.objects.get_or_create(
            user=user,
            month=now.date().replace(day=1),
            defaults={
                'basic_salary': monthly_salary,
                'net_salary': monthly_salary,
            },
        )

        slip.leave_deduction = deduction
        slip.excess_leave_days = overflow
        net = (
            Decimal(str(slip.basic_salary))
            + Decimal(str(slip.allowances or 0))
            + Decimal(str(slip.overtime_pay or 0))
            - Decimal(str(slip.epf_deduction or 0))
            - deduction
        )
        slip.net_salary = max(net, Decimal('0'))
        slip.save(update_fields=[
            'leave_deduction', 'excess_leave_days', 'net_salary',
        ])

    return 'ok'
