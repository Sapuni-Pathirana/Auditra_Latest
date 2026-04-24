from rest_framework import serializers
from .models import Valuation, ValuationPhoto, ValuationHistory


class ValuationPhotoSerializer(serializers.ModelSerializer):
    """Serializer for valuation photos"""
    
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ValuationPhoto
        fields = [
            'id', 'photo', 'photo_url', 'caption', 'uploaded_at',
            'is_primary', 'ordering', 'captured_at', 'gps_lat', 'gps_lon', 'device_id',
        ]
        read_only_fields = ['uploaded_at']
    
    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None


class ValuationSerializer(serializers.ModelSerializer):
    """Serializer for valuations"""

    photos = ValuationPhotoSerializer(many=True, read_only=True)
    field_officer_username = serializers.CharField(source='field_officer.username', read_only=True)
    field_officer_name = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_be_edited = serializers.SerializerMethodField()
    final_report_url = serializers.SerializerMethodField()
    submitted_report_url = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    
    class Meta:
        model = Valuation
        fields = [
            'id', 'project', 'project_title', 'field_officer', 'field_officer_username',
            'field_officer_name', 'category', 'category_display', 'status', 'status_display',
            'description', 'estimated_value', 'notes',
            # Land fields
            'land_area', 'land_type', 'land_location', 'land_latitude', 'land_longitude',
            # Building fields
            'building_area', 'building_type', 'building_location', 'building_latitude',
            'building_longitude', 'number_of_floors', 'year_built',
            # Vehicle fields
            'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_registration_number',
            'vehicle_mileage', 'vehicle_condition',
            # Other fields
            'other_type', 'other_specifications',
            # Accessor review fields
            'rejection_reason', 'accessor_comments',
            # Senior valuer fields
            'senior_valuer_comments', 'final_report', 'final_report_url',
            # MD/GM fields
            'md_gm_comments',
            # Field officer report
            'submitted_report', 'submitted_report_url',
            # Timestamps
            'created_at', 'updated_at', 'submitted_at', 'photos', 'can_be_edited', 'history'
        ]
        read_only_fields = ['field_officer', 'created_at', 'updated_at', 'submitted_at']
    
    def get_field_officer_name(self, obj):
        if obj.field_officer.first_name or obj.field_officer.last_name:
            return f"{obj.field_officer.first_name or ''} {obj.field_officer.last_name or ''}".strip()
        return obj.field_officer.username
    
    def get_can_be_edited(self, obj):
        """Check if valuation can be edited"""
        return obj.can_be_edited()
    
    def get_final_report_url(self, obj):
        """Get URL for final report file"""
        if obj.final_report:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.final_report.url)
            return obj.final_report.url
        return None

    def get_submitted_report_url(self, obj):
        """Get URL for submitted report PDF from field officer"""
        if obj.submitted_report:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.submitted_report.url)
            return obj.submitted_report.url
        return None

    def get_history(self, obj):
        """Get valuation status history"""
        from .models import ValuationHistory
        history_qs = obj.history.select_related('performed_by').order_by('-created_at')
        result = []
        for h in history_qs:
            performed_by_name = 'System'
            if h.performed_by:
                if h.performed_by.first_name or h.performed_by.last_name:
                    performed_by_name = f"{h.performed_by.first_name or ''} {h.performed_by.last_name or ''}".strip()
                else:
                    performed_by_name = h.performed_by.username
            result.append({
                'id': h.id,
                'action': h.action,
                'action_display': h.get_action_display(),
                'performed_by_name': performed_by_name,
                'comments': h.comments,
                'created_at': h.created_at.isoformat(),
            })
        return result


class ValuationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating valuations"""
    
    class Meta:
        model = Valuation
        fields = [
            'project', 'category', 'description', 'estimated_value', 'notes',
            # Land fields
            'land_area', 'land_type', 'land_location', 'land_latitude', 'land_longitude',
            # Building fields
            'building_area', 'building_type', 'building_location', 'building_latitude',
            'building_longitude', 'number_of_floors', 'year_built',
            # Vehicle fields
            'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_registration_number',
            'vehicle_mileage', 'vehicle_condition',
            # Other fields
            'other_type', 'other_specifications',
        ]
    
    def validate_project(self, value):
        """Ensure the project is assigned to the current user and is in progress"""
        request = self.context.get('request')
        if request and request.user:
            if value.assigned_field_officer != request.user:
                raise serializers.ValidationError("You can only create valuations for projects assigned to you.")
        if value.status != 'in_progress':
            raise serializers.ValidationError("Valuation reports can only be created for projects that are in progress.")
        return value


class ValuationPhotoCreateSerializer(serializers.ModelSerializer):
    """Serializer for uploading valuation photos"""
    
    class Meta:
        model = ValuationPhoto
        fields = [
            'valuation', 'photo', 'caption',
            'is_primary', 'ordering', 'captured_at', 'gps_lat', 'gps_lon', 'device_id',
        ]



class ValuationHistorySerializer(serializers.ModelSerializer):
    """Serializer for valuation history entries"""

    performed_by_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = ValuationHistory
        fields = ['id', 'action', 'action_display', 'performed_by', 'performed_by_name',
                  'comments', 'created_at']

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            if obj.performed_by.first_name or obj.performed_by.last_name:
                return f"{obj.performed_by.first_name or ''} {obj.performed_by.last_name or ''}".strip()
            return obj.performed_by.username
        return 'System'

