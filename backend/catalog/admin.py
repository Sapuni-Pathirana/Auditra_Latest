from django.contrib import admin
from .models import ItemCatalog, ExternalSource, DepreciationPolicy


@admin.register(ItemCatalog)
class ItemCatalogAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'source', 'confidence_default', 'created_at']
    list_filter = ['category', 'source']
    search_fields = ['title']


@admin.register(ExternalSource)
class ExternalSourceAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active']


@admin.register(DepreciationPolicy)
class DepreciationPolicyAdmin(admin.ModelAdmin):
    list_display = ['category', 'method', 'default_rate', 'useful_life_years']
    list_filter = ['category', 'method']
