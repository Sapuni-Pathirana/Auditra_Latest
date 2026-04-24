from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from projects.models import Project


class Valuation(models.Model):
    """Valuation model for field officers to submit valuations"""
    
    CATEGORY_CHOICES = [
        ('land', 'Land'),
        ('building', 'Building'),
        ('vehicle', 'Vehicle'),
        ('other', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('md_approved', 'MD/GM Approved'),
        ('rejected', 'Rejected'),
    ]
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='valuations'
    )
    field_officer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='valuations',
        limit_choices_to={'role__role': 'field_officer'}
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Common fields
    description = models.TextField(blank=True)
    estimated_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    
    # Land-specific fields
    land_area = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Area in square meters")
    land_type = models.CharField(max_length=100, blank=True, help_text="e.g., Residential, Commercial, Agricultural")
    land_location = models.CharField(max_length=500, blank=True)
    land_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    land_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    
    # Building-specific fields
    building_area = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Area in square meters")
    building_type = models.CharField(max_length=100, blank=True, help_text="e.g., House, Apartment, Commercial Building")
    building_location = models.CharField(max_length=500, blank=True)
    building_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    building_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    number_of_floors = models.IntegerField(null=True, blank=True)
    year_built = models.IntegerField(null=True, blank=True)
    
    # Vehicle-specific fields
    vehicle_make = models.CharField(max_length=100, blank=True)
    vehicle_model = models.CharField(max_length=100, blank=True)
    vehicle_year = models.IntegerField(null=True, blank=True)
    vehicle_registration_number = models.CharField(max_length=50, blank=True)
    vehicle_mileage = models.IntegerField(null=True, blank=True)
    vehicle_condition = models.CharField(max_length=50, blank=True, help_text="e.g., Excellent, Good, Fair, Poor")
    
    # Other category fields
    other_type = models.CharField(max_length=200, blank=True)
    other_specifications = models.TextField(blank=True)
    
    # Accessor review fields
    rejection_reason = models.TextField(blank=True, help_text='Reason for rejection if status is rejected')
    accessor_comments = models.TextField(blank=True, default='', help_text='Comments from accessor when accepting valuation')
    
    # Field officer submitted report
    submitted_report = models.FileField(upload_to='submitted_valuation_reports/%Y/%m/%d/', blank=True, null=True, help_text='PDF report generated and uploaded by field officer on submission')

    # Senior valuer fields
    senior_valuer_comments = models.TextField(blank=True, default='', help_text='Comments from senior valuer during review')
    final_report = models.FileField(upload_to='final_valuation_reports/%Y/%m/%d/', blank=True, null=True, help_text='Final valuation report uploaded by senior valuer for MD/GM approval')

    # MD/GM fields
    md_gm_comments = models.TextField(blank=True, default='', help_text='Comments from MD/GM during final approval')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'valuations'
        verbose_name = 'Valuation'
        verbose_name_plural = 'Valuations'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_category_display()} - {self.project.title} - {self.get_status_display()}"
    
    def submit(self):
        """Mark valuation as submitted"""
        if self.status in ['draft', 'rejected']:
            self.status = 'submitted'
            self.rejection_reason = ''  # Clear rejection reason on resubmission
            self.submitted_at = timezone.now()
            self.save()
    
    def can_be_edited(self):
        """Check if valuation can be edited (draft, submitted within 2 hours, or rejected)"""
        if self.status == 'draft':
            return True
        if self.status == 'rejected':
            # Rejected valuations can always be edited
            return True
        if self.status == 'submitted' and self.submitted_at:
            time_diff = timezone.now() - self.submitted_at
            return time_diff.total_seconds() <= 2 * 60 * 60  # 2 hours in seconds
        # Reviewed and approved valuations cannot be edited
        return False


class ValuationPhoto(models.Model):
    """Photos attached to valuations — with metadata, ordering, and primary-photo support."""
    
    valuation = models.ForeignKey(
        Valuation,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    photo = models.ImageField(upload_to='valuation_photos/%Y/%m/%d/')
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Feature #9: metadata
    is_primary = models.BooleanField(default=False)
    ordering = models.PositiveIntegerField(default=0)
    captured_at = models.DateTimeField(null=True, blank=True)
    gps_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    device_id = models.CharField(max_length=200, blank=True)
    
    class Meta:
        db_table = 'valuation_photos'
        verbose_name = 'Valuation Photo'
        verbose_name_plural = 'Valuation Photos'
        ordering = ['ordering', '-uploaded_at']
    
    def __str__(self):
        return f"Photo for {self.valuation}"



class ValuationHistory(models.Model):
    """Tracks every status change of a valuation for report history"""

    ACTION_CHOICES = [
        ('submitted', 'Submitted by Field Officer'),
        ('resubmitted', 'Resubmitted by Field Officer'),
        ('reviewed', 'Accepted by Assessor'),
        ('rejected_by_accessor', 'Rejected by Assessor'),
        ('approved_by_sv', 'Approved by Senior Valuer'),
        ('rejected_by_sv', 'Rejected by Senior Valuer'),
        ('md_approved', 'Approved by MD/GM'),
        ('rejected_by_mdgm', 'Rejected by MD/GM'),
    ]

    valuation = models.ForeignKey(Valuation, on_delete=models.CASCADE, related_name='history')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'valuation_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_action_display()} - {self.valuation}"
