from rest_framework import serializers
from .models import ProjectReport, ValuationItem, ValuationItemPhoto


class ValuationItemPhotoSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = ValuationItemPhoto
        fields = [
            'id', 'photo', 'photo_url', 'caption', 'is_primary', 'ordering',
            'captured_at', 'gps_lat', 'gps_lon', 'device_id', 'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_at', 'photo_url']

    def get_photo_url(self, obj):
        request = self.context.get('request')
        if obj.photo:
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None


class ValuationItemSerializer(serializers.ModelSerializer):
    photos = ValuationItemPhotoSerializer(many=True, read_only=True)
    added_by_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    depreciation_result = serializers.SerializerMethodField()

    class Meta:
        model = ValuationItem
        fields = [
            'id', 'report', 'category', 'category_display', 'title', 'description', 'specs',
            'estimated_value', 'notes', 'catalog_ref',
            'purchase_value', 'purchase_date', 'depreciation_method', 'applied_rate',
            'units_used', 'units_lifetime', 'computed_book_value', 'override_reason',
            'added_by', 'added_by_name', 'is_merged_duplicate',
            'client_updated_at', 'created_at', 'updated_at', 'photos', 'depreciation_result',
        ]
        read_only_fields = ['id', 'added_by', 'added_by_name', 'created_at', 'updated_at', 'depreciation_result']

    def get_added_by_name(self, obj):
        if obj.added_by:
            return obj.added_by.get_full_name() or obj.added_by.username
        return ''

    def get_depreciation_result(self, obj):
        if not obj.purchase_value or not obj.purchase_date or not obj.depreciation_method:
            return None
        from catalog.services.depreciation import compute_depreciation
        from decimal import Decimal
        try:
            return compute_depreciation(
                method=obj.depreciation_method,
                purchase_value=obj.purchase_value,
                purchase_date=obj.purchase_date,
                rate=obj.applied_rate,
                units_used=obj.units_used or 0,
                units_lifetime=obj.units_lifetime,
            )
        except Exception:
            return None


class ProjectReportSerializer(serializers.ModelSerializer):
    items = ValuationItemSerializer(many=True, read_only=True)
    total_estimated_value = serializers.ReadOnlyField()
    final_pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectReport
        fields = [
            'id', 'project', 'status', 'final_pdf', 'final_pdf_url',
            'accessor_comments', 'senior_valuer_comments', 'md_gm_comments', 'rejection_reason',
            'created_at', 'submitted_at', 'updated_at', 'items', 'total_estimated_value',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'total_estimated_value', 'final_pdf_url']

    def get_final_pdf_url(self, obj):
        request = self.context.get('request')
        if obj.final_pdf:
            if request:
                return request.build_absolute_uri(obj.final_pdf.url)
            return obj.final_pdf.url
        return None
