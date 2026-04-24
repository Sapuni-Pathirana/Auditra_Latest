from django.contrib import admin
from .models import ProjectReport, ValuationItem, ValuationItemPhoto


@admin.register(ProjectReport)
class ProjectReportAdmin(admin.ModelAdmin):
    list_display = ['project', 'status', 'submitted_at', 'created_at']
    list_filter = ['status']


@admin.register(ValuationItem)
class ValuationItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'report', 'estimated_value', 'added_by', 'is_merged_duplicate']
    list_filter = ['category', 'is_merged_duplicate']
    search_fields = ['title']


@admin.register(ValuationItemPhoto)
class ValuationItemPhotoAdmin(admin.ModelAdmin):
    list_display = ['item', 'is_primary', 'ordering', 'uploaded_at']
