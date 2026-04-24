from django.contrib import admin
from .models import ReportItem


@admin.register(ReportItem)
class ReportItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'project', 'created_by', 'unit_value', 'book_value', 'created_at']
    list_filter = ['category', 'project']
    search_fields = ['name', 'description']
