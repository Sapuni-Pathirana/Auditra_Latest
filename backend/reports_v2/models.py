"""Consolidated per-project report model (Feature #13 — D1)."""
from django.db import models
from django.contrib.auth.models import User


class ReportItem(models.Model):
    """A single item inside a project's consolidated report.

    Multiple ReportItem rows can exist per project (one per asset).
    A final consolidated PDF is generated from all items at once.
    """

    CATEGORY_CHOICES = [
        ('land', 'Land'),
        ('building', 'Building'),
        ('vehicle', 'Vehicle'),
        ('other', 'Other'),
    ]

    DEPRECIATION_METHOD_CHOICES = [
        ('straight_line', 'Straight Line'),
        ('diminishing_balance', 'Diminishing Balance'),
        ('units_of_production', 'Units of Production'),
    ]

    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.CASCADE,
        related_name='report_items',
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_report_items',
    )
    name = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True, default='')
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    depreciation_method = models.CharField(
        max_length=30, choices=DEPRECIATION_METHOD_CHOICES,
        blank=True, default='',
    )
    depreciation_rate = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True,
    )
    book_value = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
    )
    specs = models.JSONField(default=dict, blank=True)

    merged_from_valuation = models.ForeignKey(
        'valuations.Valuation',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='migrated_report_items',
        help_text='Set when this row was auto-migrated from an existing Valuation.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'report_items'
        ordering = ['project', 'category', 'name']
        verbose_name = 'Report Item'
        verbose_name_plural = 'Report Items'

    def __str__(self):
        return f"{self.name} ({self.category}) — {self.project}"
