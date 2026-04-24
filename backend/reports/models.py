"""
New one-report-per-project system (Feature #13).
ValuationItem replaces per-category Valuation for new projects.
"""
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from projects.models import Project
from catalog.models import ItemCatalog


class ProjectReport(models.Model):
    """One report per project aggregating all assessed items."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('reviewed', 'Reviewed'),
        ('approved', 'Approved'),
        ('md_approved', 'MD/GM Approved'),
        ('rejected', 'Rejected'),
    ]

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='report')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    final_pdf = models.FileField(upload_to='project_reports/%Y/%m/', blank=True, null=True)
    accessor_comments = models.TextField(blank=True)
    senior_valuer_comments = models.TextField(blank=True)
    md_gm_comments = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'project_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"Report: {self.project.title} [{self.status}]"

    @property
    def total_estimated_value(self):
        return self.items.aggregate(
            total=models.Sum('estimated_value')
        )['total'] or Decimal('0')


class ValuationItem(models.Model):
    """Individual asset item inside a ProjectReport."""

    CATEGORY_CHOICES = [
        ('land', 'Land'),
        ('building', 'Building'),
        ('vehicle', 'Vehicle'),
        ('other', 'Other'),
    ]

    report = models.ForeignKey(ProjectReport, on_delete=models.CASCADE, related_name='items')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    specs = models.JSONField(default=dict, blank=True)
    estimated_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)

    # Catalog linkage
    catalog_ref = models.ForeignKey(
        ItemCatalog, on_delete=models.SET_NULL, null=True, blank=True, related_name='valuation_items'
    )

    # Depreciation (Feature #12)
    purchase_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    depreciation_method = models.CharField(max_length=30, blank=True)
    applied_rate = models.DecimalField(max_digits=6, decimal_places=4, null=True, blank=True)
    units_used = models.IntegerField(null=True, blank=True)
    units_lifetime = models.IntegerField(null=True, blank=True)
    computed_book_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    override_reason = models.TextField(blank=True, help_text='Reason when depreciation is manually overridden')

    # Tracking
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='valuation_items')
    is_merged_duplicate = models.BooleanField(default=False)
    merged_from = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='merged_items'
    )

    # Sync conflict support
    client_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'valuation_items'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.title} ({self.category}) — {self.report.project.title}"


class ValuationItemPhoto(models.Model):
    """Photos attached to a ValuationItem with full metadata (Feature #9)."""

    item = models.ForeignKey(ValuationItem, on_delete=models.CASCADE, related_name='photos')
    photo = models.ImageField(upload_to='item_photos/%Y/%m/%d/')
    caption = models.CharField(max_length=200, blank=True)
    is_primary = models.BooleanField(default=False)
    ordering = models.PositiveIntegerField(default=0)
    captured_at = models.DateTimeField(null=True, blank=True)
    gps_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    gps_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    device_id = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'valuation_item_photos'
        ordering = ['ordering', '-uploaded_at']

    def __str__(self):
        return f"Photo for {self.item.title}"
