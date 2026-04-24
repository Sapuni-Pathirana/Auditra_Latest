from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Project(models.Model):
    """Project model for coordinators to create and manage projects"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    PRIORITY_CHOICES = [
        ('urgent', 'Urgent'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    coordinator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='coordinated_projects',
        limit_choices_to={'role__role': 'coordinator'}
    )
    assigned_field_officer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_projects',
        limit_choices_to={'role__role': 'field_officer'}
    )
    assigned_client = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='client_projects',
        limit_choices_to={'role__role': 'client'}
    )
    assigned_agent = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_projects',
        limit_choices_to={'role__role': 'agent'}
    )
    assigned_accessor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accessor_projects',
        limit_choices_to={'role__role': 'accessor'}
    )
    assigned_senior_valuer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='senior_valuer_projects',
        limit_choices_to={'role__role': 'senior_valuer'}
    )
    has_agent = models.BooleanField(default=False, help_text='Whether this project requires an agent')
    client_info = models.JSONField(null=True, blank=True, help_text='Client information from project creation form')
    agent_info = models.JSONField(null=True, blank=True, help_text='Agent information from project creation form')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    workflow_stage = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Current stage in the project workflow'
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    # MD/GM approval fields
    md_gm_approval_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
        ],
        default='pending',
        help_text='MD/GM approval status for the project'
    )
    md_gm_rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text='Reason for rejection by MD/GM (if rejected)'
    )
    md_gm_approved_at = models.DateTimeField(null=True, blank=True)
    md_gm_rejected_at = models.DateTimeField(null=True, blank=True)

    # Admin approval fields (for projects created without a submission)
    ADMIN_APPROVAL_CHOICES = [
        ('not_required', 'Not Required'),
        ('not_submitted', 'Not Submitted'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    admin_approval_status = models.CharField(
        max_length=20,
        choices=ADMIN_APPROVAL_CHOICES,
        default='not_required',
        help_text='Admin approval status for direct projects (created without a submission)'
    )
    admin_rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text='Reason for rejection by admin (if rejected)'
    )
    admin_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='admin_approved_projects',
        help_text='Admin who approved/rejected this project'
    )
    admin_approved_at = models.DateTimeField(null=True, blank=True)
    admin_rejected_at = models.DateTimeField(null=True, blank=True)

    # Payment related fields
    estimated_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=50000.00,
        help_text='Estimated value/cost for the project'
    )
    payment_completed = models.BooleanField(
        default=False,
        help_text='Whether the client has completed payment for this project'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'projects'
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"


class ProjectDocument(models.Model):
    """Documents attached to projects"""
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    file = models.FileField(upload_to='project_documents/%Y/%m/%d/')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents'
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_documents',
        help_text='The assigned user this document is intended for (legacy; use visible_to for ACL)'
    )
    visible_to = models.ManyToManyField(
        User,
        blank=True,
        related_name='visible_documents',
        help_text='Users who can see this document (empty = all project assignees + coordinator)',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_documents'
        verbose_name = 'Project Document'
        verbose_name_plural = 'Project Documents'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.name} - {self.project.title}"

class ProjectStatusHistory(models.Model):
    """Tracks status changes and significant events for projects"""
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='history'
    )
    status = models.CharField(max_length=20, choices=Project.STATUS_CHOICES)
    stage = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='project_events'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_status_history'
        verbose_name = 'Project Status History'
        verbose_name_plural = 'Project Status Histories'
        ordering = ['created_at']
    
    def __str__(self):
        return f"{self.project.title} - {self.status} at {self.created_at}"


class ProjectPayment(models.Model):
    """Payment tracking for projects - handles bank slip uploads and payment verification"""
    
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('requested', 'Payment Requested'),
        ('submitted', 'Bank Slip Submitted'),
        ('under_review', 'Under Review'),
        ('approved', 'Payment Approved'),
        ('rejected', 'Payment Rejected'),
    ]
    
    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name='payment'
    )
    estimated_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Estimated value for this project payment'
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    
    # Bank slip fields
    bank_slip = models.FileField(
        upload_to='project_payments/bank_slips/%Y/%m/',
        null=True,
        blank=True,
        help_text='Bank slip uploaded by client'
    )
    bank_slip_uploaded_at = models.DateTimeField(null=True, blank=True)
    bank_slip_uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_bank_slips'
    )
    
    # Request and approval tracking
    payment_requested_at = models.DateTimeField(null=True, blank=True)
    payment_requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_payments'
    )
    payment_approved_at = models.DateTimeField(null=True, blank=True)
    payment_approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_payments'
    )
    
    # Rejection tracking
    payment_rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text='Reason for payment rejection'
    )
    payment_rejection_count = models.IntegerField(
        default=0,
        help_text='Number of times payment has been rejected'
    )
    last_rejected_at = models.DateTimeField(null=True, blank=True)
    
    # Notes
    coordinator_notes = models.TextField(
        blank=True,
        null=True,
        help_text='Notes from coordinator about the payment'
    )
    client_notes = models.TextField(
        blank=True,
        null=True,
        help_text='Notes from client about the payment'
    )
    
    # Payment instructions sent to client
    payment_instructions = models.TextField(
        blank=True,
        null=True,
        help_text='Payment instructions sent to the client'
    )

    # Gateway payment tracking
    payment_method = models.CharField(
        max_length=20,
        choices=[
            ('bank_slip', 'Bank Slip'),
            ('payhere', 'PayHere'),
        ],
        default='bank_slip',
        help_text='How the client completed or intends to complete the payment'
    )
    gateway_order_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='Gateway order reference used for PayHere checkout'
    )
    gateway_payment_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='Gateway transaction reference returned by PayHere'
    )
    gateway_status = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text='Latest gateway status such as initiated, paid, cancelled, or failed'
    )
    gateway_payment_data = models.JSONField(
        blank=True,
        null=True,
        help_text='Raw PayHere callback or initiation payload for auditing'
    )
    gateway_paid_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when the gateway payment was confirmed'
    )

    # Agent payment fields
    agent_payment_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Amount paid to the agent for this project'
    )
    agent_payment_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('paid', 'Paid')],
        default='pending',
        help_text='Status of the agent payment'
    )
    agent_paid_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When the agent was paid'
    )
    agent_paid_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agent_payments_made',
        help_text='Coordinator who recorded the agent payment'
    )
    agent_payment_notes = models.TextField(
        blank=True,
        null=True,
        help_text='Notes about the agent payment'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'project_payments'
        verbose_name = 'Project Payment'
        verbose_name_plural = 'Project Payments'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.project.title} - {self.get_payment_status_display()} - {self.estimated_value}"


class ProjectCancellationRequest(models.Model):
    """Cancellation request for projects - coordinators request, admins approve/reject"""
    
    REQUEST_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='cancellation_requests'
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='cancellation_requests_made'
    )
    reason = models.TextField(
        help_text='Reason for requesting cancellation'
    )
    status = models.CharField(
        max_length=20,
        choices=REQUEST_STATUS_CHOICES,
        default='pending'
    )
    
    # Admin response
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancellation_requests_reviewed'
    )
    admin_remarks = models.TextField(
        blank=True,
        null=True,
        help_text='Admin remarks when approving/rejecting'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Notification tracking
    notified_users = models.ManyToManyField(
        User,
        blank=True,
        related_name='cancellation_notifications_received'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'project_cancellation_requests'
        verbose_name = 'Project Cancellation Request'
        verbose_name_plural = 'Project Cancellation Requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.project.title} - Cancellation {self.get_status_display()}"


class CommissionReport(models.Model):
    """Commission report generated by coordinator for agent payment"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='commission_reports'
    )
    generated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_commission_reports'
    )
    agent = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='received_commission_reports'
    )
    report_file = models.FileField(
        upload_to='commission_reports/%Y/%m/',
        help_text='Generated PDF commission report'
    )
    commission_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Commission amount in the report'
    )
    sent_to_agent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'commission_reports'
        verbose_name = 'Commission Report'
        verbose_name_plural = 'Commission Reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.project.title} - Commission Report - Rs. {self.commission_amount}"


class ProjectVisit(models.Model):
    """Field officer schedules a site visit for a project (Feature #2)."""

    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('rescheduled', 'Rescheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='visits')
    field_officer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='scheduled_visits'
    )
    scheduled_date = models.DateField()
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'project_visits'
        ordering = ['-scheduled_date']

    def __str__(self):
        return f"Visit for {self.project.title} on {self.scheduled_date}"
