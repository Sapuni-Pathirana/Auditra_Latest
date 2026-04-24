from django.db import models
from django.contrib.auth.models import User


class ItemCatalog(models.Model):
    """Central catalog of items identified across all projects."""

    CATEGORY_CHOICES = [
        ('land', 'Land'),
        ('building', 'Building'),
        ('vehicle', 'Vehicle'),
        ('other', 'Other'),
    ]

    SOURCE_CHOICES = [
        ('internal', 'Internal'),
        ('external', 'External'),
    ]

    title = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    specs = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='catalog_items')
    source = models.CharField(max_length=30, choices=SOURCE_CHOICES, default='internal')
    confidence_default = models.FloatField(default=1.0, help_text='Default confidence score 0-1')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'item_catalog'
        verbose_name = 'Item Catalog Entry'
        verbose_name_plural = 'Item Catalog'
        unique_together = ('title', 'category')

    def __str__(self):
        return f"{self.title} ({self.category})"


class ExternalSource(models.Model):
    """Pluggable external catalog providers."""
    name = models.CharField(max_length=100, unique=True)
    config = models.JSONField(default=dict, blank=True, help_text='Provider-specific JSON config (API key, URL, etc.)')
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = 'external_catalog_sources'

    def __str__(self):
        return f"{self.name} ({'active' if self.is_active else 'inactive'})"


class DepreciationPolicy(models.Model):
    """Default depreciation rates per asset category (Feature #12)."""

    CATEGORY_CHOICES = ItemCatalog.CATEGORY_CHOICES
    METHOD_CHOICES = [
        ('straight_line', 'Straight Line'),
        ('diminishing_balance', 'Diminishing Balance'),
        ('units_of_production', 'Units of Production'),
    ]

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    method = models.CharField(max_length=30, choices=METHOD_CHOICES, default='straight_line')
    default_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=0.10,
        help_text='Annual depreciation rate (e.g. 0.10 = 10%)'
    )
    salvage_rate = models.DecimalField(
        max_digits=5, decimal_places=4, default=0.10,
        help_text='Salvage value as fraction of purchase price'
    )
    useful_life_years = models.PositiveSmallIntegerField(default=10)
    units_lifetime = models.PositiveIntegerField(null=True, blank=True, help_text='Total expected units (for UoP method)')

    class Meta:
        db_table = 'depreciation_policies'
        unique_together = ('category', 'method')
        verbose_name = 'Depreciation Policy'
        verbose_name_plural = 'Depreciation Policies'

    def __str__(self):
        return f"{self.category} / {self.method} @ {float(self.default_rate)*100:.1f}%"
