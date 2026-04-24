from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Sum
from datetime import datetime, timedelta
from decimal import Decimal
import random
import string


class UserRole(models.Model):
    """User Role Model for Role-Based Access Control"""
    
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('coordinator', 'Coordinator'),
        ('field_officer', 'Field Officer'),
        ('accessor', 'Accessor'),
        ('senior_valuer', 'Senior Valuer'),
        ('md_gm', 'MD/GM'),
        ('hr_head', 'HR Head'),
        ('general_employee', 'General Employee'),
        ('client', 'Client'),
        ('agent', 'Agent'),
        ('unassigned', 'Unassigned'),
    ]
    
    # Salary mapping for each role (in currency units)
    ROLE_SALARIES = {
        'admin': 300000,
        'coordinator': 150000,
        'field_officer': 130000,
        'accessor': 110000,
        'senior_valuer': 120000,
        'md_gm': 100000,
        'hr_head': 80000,
        'general_employee': 50000,
        'agent': 60000,
        'client': 0,  # Clients don't have salaries
        'unassigned': 0,  # Unassigned users don't have salaries
    }
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='role')
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='unassigned')
    assigned_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_roles'
    )
    assigned_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    password_changed = models.BooleanField(
        default=True,
        help_text='Whether the user has changed their password (False only for auto-created accounts)'
    )
    custom_salary = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text='Custom salary override; if set, takes precedence over the role default'
    )
    
    class Meta:
        db_table = 'user_roles'
        verbose_name = 'User Role'
        verbose_name_plural = 'User Roles'
    
    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"
    
    @property
    def role_display(self):
        return self.get_role_display()
    
    @property
    def salary(self):
        """Get the salary for this role (custom override takes precedence)"""
        if self.custom_salary is not None:
            return self.custom_salary
        return self.ROLE_SALARIES.get(self.role, 0)
    
    @classmethod
    def get_role_salary(cls, role):
        """Get salary for a specific role"""
        return cls.ROLE_SALARIES.get(role, 0)


@receiver(post_save, sender=User)
def create_user_role(sender, instance, created, **kwargs):
    """Automatically create UserRole when User is created"""
    if created:
        UserRole.objects.create(user=instance, role='unassigned')


@receiver(post_save, sender=User)
def save_user_role(sender, instance, **kwargs):
    """Save UserRole when User is saved"""
    if hasattr(instance, 'role'):
        instance.role.save()


class PasswordResetOTP(models.Model):
    """OTP tokens for password reset via email"""
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_otp'
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP for {self.email} ({'verified' if self.is_verified else 'pending'})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def generate(cls, email):
        """Generate a new 6-digit OTP for the given email, invalidating any previous ones."""
        cls.objects.filter(email=email, is_verified=False).delete()
        otp = ''.join(random.choices(string.digits, k=6))
        return cls.objects.create(
            email=email,
            otp=otp,
            expires_at=timezone.now() + timedelta(minutes=10),
        )


class PaymentSlip(models.Model):
    """Payment Slip Model for monthly salary payments"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('generated', 'Generated'),
        ('paid', 'Paid'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payment_slips')
    month = models.IntegerField()  # 1-12
    year = models.IntegerField()
    salary = models.DecimalField(max_digits=10, decimal_places=2)  # Basic salary
    allowances = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Total allowances
    epf_contribution = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # EPF 8% of basic
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)  # Total overtime hours for the month
    overtime_hours_uploaded = models.BooleanField(default=False)  # Flag to track if overtime hours were uploaded manually
    overtime_pay = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Overtime payment
    net_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Net salary (basic + allowances + overtime - EPF - leave_deduction)
    leave_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    excess_leave_days = models.DecimalField(max_digits=5, decimal_places=1, default=0.0)
    role = models.CharField(max_length=50)
    role_display = models.CharField(max_length=100)
    pay_slip_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    employee_number = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generated')
    is_uploaded = models.BooleanField(default=False)  # Flag to track if payment slips are uploaded/published for employees to view
    generated_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='generated_payment_slips'
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    uploaded_at = models.DateTimeField(null=True, blank=True)  # When payment slips were uploaded/published
    paid_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'payment_slips'
        verbose_name = 'Payment Slip'
        verbose_name_plural = 'Payment Slips'
        unique_together = ('user', 'month', 'year')  # One payment slip per user per month
    
    def __str__(self):
        return f"{self.user.username} - {self.get_month_display()} {self.year} - {self.salary}"
    
    def get_month_display(self):
        """Get month name"""
        months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December']
        return months[self.month] if 1 <= self.month <= 12 else 'Unknown'
    
    @staticmethod
    def calculate_allowances(basic_salary):
        """Calculate allowances - fixed amount"""
        # Allowances: Fixed amount of 1200
        return Decimal('1200')
    
    @staticmethod
    def calculate_epf(basic_salary):
        """Calculate EPF contribution (8% of basic salary)"""
        # EPF = Basic salary * (8/100)
        return Decimal(str(basic_salary)) * Decimal('0.08')
    
    @staticmethod
    def calculate_overtime_pay(overtime_hours, basic_salary):
        """Calculate overtime pay: overtime_hours * (basic_salary * 5/100)"""
        # Overtime amount = no of overtime hours * (basic salary * 5/100)
        basic_salary_decimal = Decimal(str(basic_salary))
        overtime_hours_decimal = Decimal(str(overtime_hours))
        overtime_rate = basic_salary_decimal * Decimal('0.05')  # 5% of basic salary
        return overtime_hours_decimal * overtime_rate
    
    @staticmethod
    def get_monthly_overtime_hours(user, month, year):
        """Get total overtime hours for a user in a specific month"""
        try:
            from attendance.models import Attendance
            from calendar import monthrange
            from datetime import date
            
            # Get first and last day of the month
            first_day = date(year, month, 1)
            last_day = date(year, month, monthrange(year, month)[1])
            
            # Sum all overtime hours for the month
            total_overtime = Attendance.objects.filter(
                user=user,
                date__gte=first_day,
                date__lte=last_day
            ).aggregate(total=Sum('overtime_hours'))['total']
            
            return float(total_overtime) if total_overtime else 0.0
        except Exception:
            return 0.0
    
    @classmethod
    def generate_for_all_users(cls, month=None, year=None, generated_by=None, force_regenerate=False):
        """Generate payment slips for all users with assigned roles (excluding client and agent)"""
        if month is None:
            month = timezone.now().month
        if year is None:
            year = timezone.now().year
        
        generated_count = 0
        updated_count = 0
        # Only generate for these roles (exclude admin, hr_head, client, agent, unassigned)
        allowed_roles = [
            'coordinator', 'field_officer', 'accessor',
            'senior_valuer', 'md_gm', 'general_employee'
        ]
        users_with_roles = User.objects.filter(role__role__in=allowed_roles)
        
        for user in users_with_roles:
            if hasattr(user, 'role') and user.role:
                basic_salary = Decimal(str(user.role.salary))
                if basic_salary > 0:  # Only generate for roles with salary
                    # Check if payment slip already exists
                    existing_slip = cls.objects.filter(user=user, month=month, year=year).first()
                    
                    if existing_slip and force_regenerate:
                        # Update existing payment slip
                        # Recalculate components
                        allowances = cls.calculate_allowances(basic_salary)
                        epf_contribution = cls.calculate_epf(basic_salary)
                        # For admin: overtime hours should be manually entered (not from attendance system)
                        # For other roles: get overtime hours from attendance system
                        if user.role.role == 'admin':
                            # Admin: Set to 0 and mark as not uploaded (admin will manually enter)
                            overtime_hours = Decimal('0.00')
                            existing_slip.overtime_hours = overtime_hours
                            existing_slip.overtime_hours_uploaded = False
                        else:
                            # Other roles: Get from attendance system
                            overtime_hours = Decimal(str(cls.get_monthly_overtime_hours(user, month, year)))
                            existing_slip.overtime_hours = overtime_hours
                            existing_slip.overtime_hours_uploaded = False  # Reset flag since we're fetching from attendance
                        overtime_pay = cls.calculate_overtime_pay(float(overtime_hours), float(basic_salary))
                        # Net salary = Basic salary - EPF + allowances + overtime pay
                        net_salary = basic_salary - epf_contribution + allowances + overtime_pay
                        
                        # Set employee number to user ID (ensure correct format)
                        if not existing_slip.employee_number or existing_slip.employee_number != str(user.id):
                            existing_slip.employee_number = str(user.id)
                        if not existing_slip.pay_slip_number:
                            existing_slip.pay_slip_number = f"PS-{year}{month:02d}-{user.id}"
                        
                        # Update existing slip
                        existing_slip.salary = basic_salary
                        existing_slip.allowances = allowances
                        existing_slip.epf_contribution = epf_contribution
                        existing_slip.overtime_pay = overtime_pay
                        existing_slip.net_salary = net_salary
                        existing_slip.role = user.role.role
                        existing_slip.role_display = user.role.role_display
                        existing_slip.is_uploaded = False  # Reset upload flag when regenerating - only admin can see until uploaded
                        if generated_by:
                            existing_slip.generated_by = generated_by
                        existing_slip.save()
                        updated_count += 1
                    elif not existing_slip:
                        # Create new payment slip
                        # Calculate components
                        allowances = cls.calculate_allowances(basic_salary)
                        epf_contribution = cls.calculate_epf(basic_salary)
                        # For admin: overtime hours should be manually entered (not from attendance system)
                        # For other roles: get overtime hours from attendance system
                        if user.role.role == 'admin':
                            # Admin: Set to 0 and mark as not uploaded (admin will manually enter)
                            overtime_hours = Decimal('0.00')
                        else:
                            # Other roles: Get from attendance system
                            overtime_hours = Decimal(str(cls.get_monthly_overtime_hours(user, month, year)))
                        overtime_pay = cls.calculate_overtime_pay(float(overtime_hours), float(basic_salary))
                        # Net salary = Basic salary - EPF + allowances + overtime pay
                        net_salary = basic_salary - epf_contribution + allowances + overtime_pay
                        
                        # Generate pay slip number: PS-YYYYMM-USERID
                        pay_slip_number = f"PS-{year}{month:02d}-{user.id}"
                        # Employee number: User ID
                        employee_number = str(user.id)
                        
                        cls.objects.create(
                            user=user,
                            month=month,
                            year=year,
                            salary=basic_salary,
                            allowances=allowances,
                            epf_contribution=epf_contribution,
                            overtime_hours=overtime_hours,
                            overtime_hours_uploaded=False,  # For admin: will be manually entered. For others: from attendance system
                            is_uploaded=False,  # Not uploaded/published yet - only admin can see
                            overtime_pay=overtime_pay,
                            net_salary=net_salary,
                            role=user.role.role,
                            role_display=user.role.role_display,
                            pay_slip_number=pay_slip_number,
                            employee_number=employee_number,
                            generated_by=generated_by,
                            status='generated'
                        )
                        generated_count += 1
        
        return {'generated': generated_count, 'updated': updated_count, 'total': generated_count + updated_count}
    
    @classmethod
    def generate_for_user(cls, user, month=None, year=None, generated_by=None, force_regenerate=False):
        """Generate payment slip for a single user if it doesn't exist"""
        if month is None:
            month = timezone.now().month
        if year is None:
            year = timezone.now().year
        
        # Check if user has a role with salary
        if not hasattr(user, 'role') or not user.role:
            return None
        
        basic_salary = Decimal(str(user.role.salary))
        if basic_salary <= 0:
            return None
        
        # Check if payment slip already exists
        existing_slip = cls.objects.filter(user=user, month=month, year=year).first()
        
        if existing_slip and force_regenerate:
            # Update existing payment slip
            allowances = cls.calculate_allowances(basic_salary)
            epf_contribution = cls.calculate_epf(basic_salary)
            # For admin: overtime hours should be manually entered (not from attendance system)
            # For other roles: get overtime hours from attendance system
            if user.role.role == 'admin':
                # Admin: Set to 0 and mark as not uploaded (admin will manually enter)
                overtime_hours = Decimal('0.00')
                existing_slip.overtime_hours = overtime_hours
                existing_slip.overtime_hours_uploaded = False
            else:
                # Other roles: Get from attendance system
                overtime_hours = Decimal(str(cls.get_monthly_overtime_hours(user, month, year)))
                existing_slip.overtime_hours = overtime_hours
                existing_slip.overtime_hours_uploaded = False  # Reset flag since we're fetching from attendance
            overtime_pay = cls.calculate_overtime_pay(float(overtime_hours), float(basic_salary))
            # Net salary = Basic salary - EPF + allowances + overtime pay
            net_salary = basic_salary - epf_contribution + allowances + overtime_pay
            
            # Set employee number to user ID (ensure correct format)
            if not existing_slip.employee_number or existing_slip.employee_number != str(user.id):
                existing_slip.employee_number = str(user.id)
            if not existing_slip.pay_slip_number:
                existing_slip.pay_slip_number = f"PS-{year}{month:02d}-{user.id}"
            
            existing_slip.salary = basic_salary
            existing_slip.allowances = allowances
            existing_slip.epf_contribution = epf_contribution
            existing_slip.overtime_pay = overtime_pay
            existing_slip.net_salary = net_salary
            existing_slip.role = user.role.role
            existing_slip.role_display = user.role.role_display
            if generated_by:
                existing_slip.generated_by = generated_by
            existing_slip.save()
            return existing_slip
        elif existing_slip:
            return existing_slip
        
        # Create new payment slip
        allowances = cls.calculate_allowances(basic_salary)
        epf_contribution = cls.calculate_epf(basic_salary)
        # For admin: overtime hours should be manually entered (not from attendance system)
        # For other roles: get overtime hours from attendance system
        if user.role.role == 'admin':
            # Admin: Set to 0 and mark as not uploaded (admin will manually enter)
            overtime_hours = Decimal('0.00')
        else:
            # Other roles: Get from attendance system
            overtime_hours = Decimal(str(cls.get_monthly_overtime_hours(user, month, year)))
        overtime_pay = cls.calculate_overtime_pay(float(overtime_hours), float(basic_salary))
        # Net salary = Basic salary - EPF + allowances + overtime pay
        net_salary = basic_salary - epf_contribution + allowances + overtime_pay
        
        # Generate pay slip number: PS-YYYYMM-USERID
        pay_slip_number = f"PS-{year}{month:02d}-{user.id}"
        # Employee number: User ID
        employee_number = str(user.id)
        
        return cls.objects.create(
            user=user,
            month=month,
            year=year,
            salary=basic_salary,
            allowances=allowances,
            epf_contribution=epf_contribution,
            overtime_hours=overtime_hours,
            overtime_hours_uploaded=False,  # For admin: will be manually entered. For others: from attendance system
            overtime_pay=overtime_pay,
            net_salary=net_salary,
            role=user.role.role,
            role_display=user.role.role_display,
            pay_slip_number=pay_slip_number,
            employee_number=employee_number,
            generated_by=generated_by,
            status='generated'
        )


class ClientFormSubmission(models.Model):
    """Client Registration Form Submission Model"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('assigned', 'Assigned'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField()
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    nic = models.CharField(max_length=20, blank=True, null=True)
    company_name = models.CharField(max_length=200, blank=True, null=True)
    project_title = models.CharField(max_length=200)
    project_description = models.TextField()
    agent_name = models.CharField(max_length=200, blank=True, null=True)
    agent_phone = models.CharField(max_length=20, blank=True, null=True)
    agent_email = models.EmailField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_client_submissions'
    )
    coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinated_client_submissions'
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    
    # Coordinator response fields
    COORDINATOR_RESPONSE_CHOICES = [
        ('pending', 'Pending Response'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    coordinator_response = models.CharField(
        max_length=20,
        choices=COORDINATOR_RESPONSE_CHOICES,
        default='pending',
        help_text='Coordinator response to the assignment'
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text='Reason for rejecting the assignment (if rejected)'
    )
    responded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the coordinator responded to the assignment'
    )
    project_created = models.BooleanField(
        default=False,
        help_text='Whether a project has been created from this submission'
    )
    
    class Meta:
        db_table = 'client_form_submissions'
        verbose_name = 'Client Form Submission'
        verbose_name_plural = 'Client Form Submissions'
        ordering = ['-submitted_at']
    
    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip() or "Unknown"
        return f"{name} - {self.email} - {self.get_status_display()}"


class CoordinatorAssignment(models.Model):
    """Tracks coordinator assignments for client submissions"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Response'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    
    submission = models.ForeignKey(
        ClientFormSubmission,
        on_delete=models.CASCADE,
        related_name='coordinator_assignments'
    )
    coordinator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='coordinator_assignment_records'
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordinator_assignments_made'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    rejection_reason = models.TextField(blank=True, null=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'coordinator_assignments'
        ordering = ['-assigned_at']
    
    def __str__(self):
        coord_name = f"{self.coordinator.first_name} {self.coordinator.last_name}".strip() or self.coordinator.username
        return f"Assignment #{self.id} - {coord_name} - {self.get_status_display()}"


class EmployeeFormSubmission(models.Model):
    """Employee Registration Form Submission Model"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    birthday = models.DateField()
    nic = models.CharField(max_length=20, blank=True, null=True)
    cv = models.FileField(upload_to='employee_cvs/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_employee_submissions'
    )
    
    class Meta:
        db_table = 'employee_form_submissions'
        verbose_name = 'Employee Form Submission'
        verbose_name_plural = 'Employee Form Submissions'
        ordering = ['-submitted_at']
    
    def __str__(self):
        name = f"{self.first_name} {self.last_name}".strip() or "Unknown"
        return f"{name} - {self.email or 'No email'} - {self.get_status_display()}"


class LeaveRequest(models.Model):
    """Leave Request Model — supports full-day and half-day requests."""
    
    LEAVE_TYPE_CHOICES = [
        ('annual', 'Annual Leave'),
        ('sick', 'Sick Leave'),
        ('casual', 'Casual Leave'),
        ('emergency', 'Emergency Leave'),
        ('other', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled_by_user', 'Cancelled by Employee'),
    ]

    HALF_DAY_PERIOD_CHOICES = [
        ('morning', 'Morning'),
        ('afternoon', 'Afternoon'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_leave_requests'
    )
    notes = models.TextField(blank=True, null=True)

    # Half-day fields
    is_half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(
        max_length=10,
        choices=HALF_DAY_PERIOD_CHOICES,
        blank=True, null=True,
        help_text='Required when is_half_day=True'
    )

    # Cancellation fields
    cancelled_at = models.DateTimeField(blank=True, null=True)
    cancelled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='cancelled_leave_requests',
    )
    
    class Meta:
        db_table = 'leave_requests'
        verbose_name = 'Leave Request'
        verbose_name_plural = 'Leave Requests'
        ordering = ['-submitted_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.get_leave_type_display()} - {self.get_status_display()}"
    
    @property
    def days(self):
        """Return leave duration in days (0.5 for half-day)."""
        if self.is_half_day:
            return Decimal('0.5')
        return Decimal((self.end_date - self.start_date).days + 1)


class LeavePolicy(models.Model):
    """Quota configuration per role per leave type."""

    role = models.CharField(max_length=50, choices=UserRole.ROLE_CHOICES)
    leave_type = models.CharField(max_length=20, choices=LeaveRequest.LEAVE_TYPE_CHOICES)
    annual_quota_days = models.DecimalField(max_digits=5, decimal_places=1, default=14)
    allow_half_day = models.BooleanField(default=True)
    working_days_per_month = models.PositiveSmallIntegerField(default=22)

    class Meta:
        db_table = 'leave_policies'
        unique_together = ('role', 'leave_type')
        verbose_name = 'Leave Policy'
        verbose_name_plural = 'Leave Policies'

    def __str__(self):
        return f"{self.role} / {self.leave_type} — {self.annual_quota_days}d"


class LeaveBalance(models.Model):
    """Running balance of used leave days per user per year per type."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_balances')
    year = models.PositiveIntegerField()
    leave_type = models.CharField(max_length=20, choices=LeaveRequest.LEAVE_TYPE_CHOICES)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    class Meta:
        db_table = 'leave_balances'
        unique_together = ('user', 'year', 'leave_type')
        verbose_name = 'Leave Balance'
        verbose_name_plural = 'Leave Balances'

    def __str__(self):
        return f"{self.user.username} / {self.year} / {self.leave_type}: {self.used_days}d"


class EmployeeRemovalRequest(models.Model):
    """Model for HR Head to request employee removal (admin approval required)"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='removal_requests')
    requested_by = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='removal_requests_made',
        help_text='HR Head who requested the removal'
    )
    reason = models.TextField(blank=True, null=True, help_text='Reason for removal request')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='removal_requests_reviewed',
        help_text='Admin who reviewed the request'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True, null=True, help_text='Admin notes on approval/rejection')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'employee_removal_requests'
        verbose_name = 'Employee Removal Request'
        verbose_name_plural = 'Employee Removal Requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Removal request for {self.user.username} by {self.requested_by.username} - {self.get_status_display()}"


# ---------------------------------------------------------------------------
# UserProfile — avatar, theme, personal settings
# ---------------------------------------------------------------------------

class UserProfile(models.Model):
    """Extended profile attached to every User (auto-created via signal)."""

    THEME_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('system', 'System'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='userprofile')
    profile_image = models.ImageField(upload_to='avatars/', blank=True, null=True)
    theme_preference = models.CharField(max_length=10, choices=THEME_CHOICES, default='system')
    phone = models.CharField(max_length=20, blank=True)
    bio = models.TextField(blank=True)
    timezone = models.CharField(max_length=50, default='Asia/Colombo')
    locale = models.CharField(max_length=10, default='en')
    preferences = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profiles'
        verbose_name = 'User Profile'

    def __str__(self):
        return f"Profile: {self.user.username}"

    def profile_image_url(self, request=None):
        if self.profile_image:
            if request:
                return request.build_absolute_uri(self.profile_image.url)
            return self.profile_image.url
        return None


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create a UserProfile whenever a new User is created."""
    if created:
        UserProfile.objects.get_or_create(user=instance)


# ---------------------------------------------------------------------------
# Invitation — track auto-created account credential emails
# ---------------------------------------------------------------------------

class Invitation(models.Model):
    """Tracks every credential email sent when an auto-account is created."""

    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('bounced', 'Bounced'),
        ('accepted', 'Accepted (First Login)'),
        ('password_changed', 'Password Changed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invitations', null=True, blank=True)
    email = models.EmailField()
    role = models.CharField(max_length=50, choices=UserRole.ROLE_CHOICES)
    channel = models.CharField(max_length=20, default='email')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    invited_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_invitations'
    )
    metadata = models.JSONField(default=dict, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invitations'
        ordering = ['-sent_at']
        verbose_name = 'Invitation'
        verbose_name_plural = 'Invitations'

    def __str__(self):
        return f"Invite {self.email} ({self.role}) — {self.status}"