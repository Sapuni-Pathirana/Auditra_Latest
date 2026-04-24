from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Project, ProjectDocument, ProjectStatusHistory, ProjectPayment, ProjectCancellationRequest, CommissionReport


class ProjectPaymentSerializer(serializers.ModelSerializer):
    """Serializer for project payments"""
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    bank_slip_url = serializers.SerializerMethodField()
    bank_slip_uploaded_by_name = serializers.SerializerMethodField()
    payment_requested_by_name = serializers.SerializerMethodField()
    payment_approved_by_name = serializers.SerializerMethodField()
    agent_paid_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPayment
        fields = (
            'id', 'project', 'estimated_value', 'payment_status', 'payment_status_display',
            'bank_slip', 'bank_slip_url', 'bank_slip_uploaded_at', 'bank_slip_uploaded_by',
            'bank_slip_uploaded_by_name', 'payment_requested_at', 'payment_requested_by',
            'payment_requested_by_name', 'payment_approved_at', 'payment_approved_by',
            'payment_approved_by_name', 'payment_rejection_reason', 'payment_rejection_count',
            'last_rejected_at', 'coordinator_notes', 'client_notes', 'payment_instructions',
            'payment_method', 'gateway_order_id', 'gateway_payment_id', 'gateway_status',
            'gateway_payment_data', 'gateway_paid_at',
            'agent_payment_amount', 'agent_payment_status', 'agent_paid_at', 'agent_paid_by',
            'agent_paid_by_name', 'agent_payment_notes',
            'created_at', 'updated_at'
        )
        read_only_fields = (
            'created_at', 'updated_at', 'bank_slip_uploaded_at', 'bank_slip_uploaded_by',
            'payment_requested_at', 'payment_requested_by', 'payment_approved_at',
            'payment_approved_by', 'last_rejected_at', 'agent_paid_at', 'agent_paid_by',
            'gateway_order_id', 'gateway_payment_id', 'gateway_status', 'gateway_payment_data',
            'gateway_paid_at'
        )
    
    def get_bank_slip_url(self, obj):
        if obj.bank_slip:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.bank_slip.url)
            return obj.bank_slip.url
        return None
    
    def get_bank_slip_uploaded_by_name(self, obj):
        if obj.bank_slip_uploaded_by:
            name = f"{obj.bank_slip_uploaded_by.first_name} {obj.bank_slip_uploaded_by.last_name}".strip()
            return name or obj.bank_slip_uploaded_by.username
        return None
    
    def get_payment_requested_by_name(self, obj):
        if obj.payment_requested_by:
            name = f"{obj.payment_requested_by.first_name} {obj.payment_requested_by.last_name}".strip()
            return name or obj.payment_requested_by.username
        return None
    
    def get_payment_approved_by_name(self, obj):
        if obj.payment_approved_by:
            name = f"{obj.payment_approved_by.first_name} {obj.payment_approved_by.last_name}".strip()
            return name or obj.payment_approved_by.username
        return None

    def get_agent_paid_by_name(self, obj):
        if obj.agent_paid_by:
            name = f"{obj.agent_paid_by.first_name} {obj.agent_paid_by.last_name}".strip()
            return name or obj.agent_paid_by.username
        return None


class ProjectStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for project status history events"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ProjectStatusHistory
        fields = (
            'id', 'project', 'status', 'status_display', 'stage', 
            'notes', 'created_by', 'created_by_username', 'created_by_name', 
            'created_at'
        )
        read_only_fields = ('created_by', 'created_at')

    def get_created_by_name(self, obj):
        if obj.created_by:
            if obj.created_by.first_name or obj.created_by.last_name:
                return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return obj.created_by.username
        return None


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, allow_null=True)
    assigned_to_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    visible_to_ids = serializers.SerializerMethodField()
    visible_to_names = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectDocument
        fields = (
            'id', 'project', 'file', 'file_url', 'file_size',
            'name', 'description', 'uploaded_by', 'uploaded_by_username',
            'assigned_to', 'assigned_to_username', 'assigned_to_name',
            'visible_to_ids', 'visible_to_names',
            'uploaded_at'
        )
        read_only_fields = ('uploaded_by', 'uploaded_at')

    def get_visible_to_ids(self, obj):
        return list(obj.visible_to.values_list('id', flat=True))

    def get_visible_to_names(self, obj):
        return [
            {'id': u.id, 'name': u.get_full_name() or u.username}
            for u in obj.visible_to.all()
        ]
    
    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            if obj.assigned_to.first_name or obj.assigned_to.last_name:
                return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
            return obj.assigned_to.username
        return None
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_file_size(self, obj):
        if obj.file:
            try:
                return obj.file.size
            except:
                return None
        return None


class ProjectSerializer(serializers.ModelSerializer):
    coordinator_username = serializers.CharField(source='coordinator.username', read_only=True)
    coordinator_name = serializers.SerializerMethodField()
    assigned_field_officer_username = serializers.CharField(
        source='assigned_field_officer.username',
        read_only=True,
        allow_null=True
    )
    assigned_field_officer_name = serializers.SerializerMethodField()
    assigned_field_officer_email = serializers.CharField(
        source='assigned_field_officer.email',
        read_only=True,
        allow_null=True
    )
    assigned_client_username = serializers.CharField(
        source='assigned_client.username',
        read_only=True,
        allow_null=True
    )
    assigned_client_name = serializers.SerializerMethodField()
    assigned_client_email = serializers.CharField(
        source='assigned_client.email',
        read_only=True,
        allow_null=True
    )
    assigned_agent_username = serializers.CharField(
        source='assigned_agent.username',
        read_only=True,
        allow_null=True
    )
    assigned_agent_name = serializers.SerializerMethodField()
    assigned_agent_email = serializers.CharField(
        source='assigned_agent.email',
        read_only=True,
        allow_null=True
    )
    assigned_accessor_username = serializers.CharField(
        source='assigned_accessor.username',
        read_only=True,
        allow_null=True
    )
    assigned_accessor_name = serializers.SerializerMethodField()
    assigned_accessor_email = serializers.CharField(
        source='assigned_accessor.email',
        read_only=True,
        allow_null=True
    )
    assigned_senior_valuer_username = serializers.CharField(
        source='assigned_senior_valuer.username',
        read_only=True,
        allow_null=True
    )
    assigned_senior_valuer_name = serializers.SerializerMethodField()
    assigned_senior_valuer_email = serializers.CharField(
        source='assigned_senior_valuer.email',
        read_only=True,
        allow_null=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    documents = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    valuations = serializers.SerializerMethodField()
    valuations_count = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()
    items_total_value = serializers.SerializerMethodField()
    next_scheduled_visit = serializers.SerializerMethodField()
    history = ProjectStatusHistorySerializer(many=True, read_only=True)
    payment = ProjectPaymentSerializer(read_only=True)
    admin_approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            'id', 'title', 'description', 'coordinator', 'coordinator_username',
            'coordinator_name', 'assigned_field_officer', 'assigned_field_officer_username',
            'assigned_field_officer_name', 'assigned_field_officer_email',
            'assigned_client', 'assigned_client_username', 'assigned_client_name',
            'assigned_client_email', 'assigned_agent', 'assigned_agent_username',
            'assigned_agent_name', 'assigned_agent_email', 'assigned_accessor',
            'assigned_accessor_username', 'assigned_accessor_name', 'assigned_accessor_email',
            'assigned_senior_valuer', 'assigned_senior_valuer_username', 'assigned_senior_valuer_name',
            'assigned_senior_valuer_email', 'has_agent', 'client_info', 'agent_info',
            'status', 'status_display', 'priority', 'start_date', 'end_date', 'estimated_value',
            'next_scheduled_visit',
            'documents', 'documents_count', 'valuations', 'valuations_count',
            'items_count', 'items_total_value', 'history', 'payment',
            'admin_approval_status', 'admin_rejection_reason', 'admin_approved_by',
            'admin_approved_by_name', 'admin_approved_at', 'admin_rejected_at',
            'created_at', 'updated_at'
        )
        read_only_fields = ('coordinator', 'created_at', 'updated_at')
    
    def get_coordinator_name(self, obj):
        if obj.coordinator.first_name or obj.coordinator.last_name:
            return f"{obj.coordinator.first_name} {obj.coordinator.last_name}".strip()
        return obj.coordinator.username
    
    def get_assigned_field_officer_name(self, obj):
        if obj.assigned_field_officer:
            if obj.assigned_field_officer.first_name or obj.assigned_field_officer.last_name:
                return f"{obj.assigned_field_officer.first_name} {obj.assigned_field_officer.last_name}".strip()
            return obj.assigned_field_officer.username
        return None

    def get_assigned_client_name(self, obj):
        if obj.assigned_client:
            # Format as "Client + first_name" if first_name exists, otherwise just "Client"
            if obj.assigned_client.first_name:
                return f"Client {obj.assigned_client.first_name}".strip()
            return "Client"
        return None
    
    def get_assigned_agent_name(self, obj):
        if obj.assigned_agent:
            if obj.assigned_agent.first_name or obj.assigned_agent.last_name:
                return f"{obj.assigned_agent.first_name} {obj.assigned_agent.last_name}".strip()
            return obj.assigned_agent.username
        return None
    
    def get_assigned_accessor_name(self, obj):
        if obj.assigned_accessor:
            if obj.assigned_accessor.first_name or obj.assigned_accessor.last_name:
                return f"{obj.assigned_accessor.first_name} {obj.assigned_accessor.last_name}".strip()
            return obj.assigned_accessor.username
        return None
    
    def get_assigned_senior_valuer_name(self, obj):
        if obj.assigned_senior_valuer:
            if obj.assigned_senior_valuer.first_name or obj.assigned_senior_valuer.last_name:
                return f"{obj.assigned_senior_valuer.first_name} {obj.assigned_senior_valuer.last_name}".strip()
            return obj.assigned_senior_valuer.username
        return None
    
    def get_valuations(self, obj):
        """Get valuations for this project"""
        # Import here to avoid circular import
        from valuations.serializers import ValuationSerializer
        valuations = obj.valuations.all().select_related('field_officer').prefetch_related('photos')
        return ValuationSerializer(valuations, many=True, context=self.context).data
    
    def get_valuations_count(self, obj):
        """Get count of valuations for this project"""
        return obj.valuations.count()

    def _visible_documents_qs(self, obj):
        """Return documents filtered by per-user visibility (Feature #11)."""
        request = self.context.get('request')
        qs = obj.documents.all()
        if not request or not request.user.is_authenticated:
            return qs
        user = request.user
        try:
            role = user.role.role if hasattr(user, 'role') else None
        except Exception:
            role = None
        # Coordinator (owner), admin, md_gm see everything; superusers too
        if role in ('coordinator', 'admin', 'md_gm') or user.is_staff or user.is_superuser:
            return qs
        # Everyone else: see docs where visible_to is empty OR they are uploader OR they are in visible_to OR assigned_to
        from django.db.models import Q, Count
        qs = qs.annotate(_vcount=Count('visible_to'))
        return qs.filter(
            Q(_vcount=0) |
            Q(uploaded_by=user) |
            Q(assigned_to=user) |
            Q(visible_to=user)
        ).distinct()

    def get_documents(self, obj):
        qs = self._visible_documents_qs(obj)
        return ProjectDocumentSerializer(qs, many=True, context=self.context).data

    def get_documents_count(self, obj):
        return self._visible_documents_qs(obj).count()

    def get_items_count(self, obj):
        try:
            return obj.report_items.count()
        except Exception:
            return 0

    def get_items_total_value(self, obj):
        try:
            from django.db.models import Sum, F
            agg = obj.report_items.aggregate(
                total=Sum(F('unit_value') * F('quantity'))
            )
            return float(agg['total'] or 0)
        except Exception:
            return 0

    def get_next_scheduled_visit(self, obj):
        """Earliest future or today ProjectVisit in scheduled/rescheduled status (ISO date or None)."""
        from django.utils import timezone
        today = timezone.now().date()
        candidates = [
            v for v in obj.visits.all()
            if v.status in ('scheduled', 'rescheduled') and v.scheduled_date >= today
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda v: v.scheduled_date)
        return candidates[0].scheduled_date.isoformat()

    def get_admin_approved_by_name(self, obj):
        if obj.admin_approved_by:
            name = f"{obj.admin_approved_by.first_name} {obj.admin_approved_by.last_name}".strip()
            return name or obj.admin_approved_by.username
        return None


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating projects"""
    client_info = serializers.JSONField(required=False, allow_null=True)
    agent_info = serializers.JSONField(required=False, allow_null=True)
    submission_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    estimated_value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=50000.00
    )
    
    class Meta:
        model = Project
        fields = ('id', 'title', 'description', 'start_date', 'end_date', 'has_agent', 'priority', 'client_info', 'agent_info', 'submission_id', 'estimated_value')
        extra_kwargs = {
            'title': {'required': True},
            'description': {'required': False, 'allow_blank': True},
            'start_date': {'required': False, 'allow_null': True},
            'end_date': {'required': False, 'allow_null': True},
            'has_agent': {'required': False, 'default': False},
            'priority': {'required': False, 'default': 'medium'},
        }
    
    def to_internal_value(self, data):
        # Keep client_info and agent_info to store them in the project
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        
        # Check if agent_info was provided to determine has_agent
        if 'agent_info' in data and data.get('agent_info'):
            data['has_agent'] = True
        elif 'has_agent' not in data:
            data['has_agent'] = False
            
        return super().to_internal_value(data)
    
    def create(self, validated_data):
        validated_data.pop('submission_id', None)
        validated_data['coordinator'] = self.context['request'].user
        return super().create(validated_data)


class AssignFieldOfficerSerializer(serializers.Serializer):
    """Serializer for assigning field officer to project"""
    field_officer_id = serializers.IntegerField(required=True)
    
    def validate_field_officer_id(self, value):
        try:
            user = User.objects.get(id=value)
            if not hasattr(user, 'role') or user.role.role != 'field_officer':
                raise serializers.ValidationError("User must be a field officer.")
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")


class AssignClientSerializer(serializers.Serializer):
    """Serializer for assigning client to project"""
    client_id = serializers.IntegerField(required=True)
    
    def validate_client_id(self, value):
        try:
            user = User.objects.get(id=value)
            if not hasattr(user, 'role') or user.role.role != 'client':
                raise serializers.ValidationError("User must be a client.")
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")


class AssignAgentSerializer(serializers.Serializer):
    """Serializer for assigning agent to project"""
    agent_id = serializers.IntegerField(required=True)
    
    def validate_agent_id(self, value):
        try:
            user = User.objects.get(id=value)
            if not hasattr(user, 'role') or user.role.role != 'agent':
                raise serializers.ValidationError("User must be an agent.")
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")


class AssignAccessorSerializer(serializers.Serializer):
    """Serializer for assigning accessor to project"""
    accessor_id = serializers.IntegerField(required=True)
    
    def validate_accessor_id(self, value):
        try:
            user = User.objects.get(id=value)
            if not hasattr(user, 'role') or user.role.role != 'accessor':
                raise serializers.ValidationError("User must be an accessor.")
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")


class AssignSeniorValuerSerializer(serializers.Serializer):
    """Serializer for assigning senior valuer to project"""
    senior_valuer_id = serializers.IntegerField(required=True)
    
    def validate_senior_valuer_id(self, value):
        try:
            user = User.objects.get(id=value)
            if not hasattr(user, 'role') or user.role.role != 'senior_valuer':
                raise serializers.ValidationError("User must be a senior valuer.")
            return value
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")


class ProjectCancellationRequestSerializer(serializers.ModelSerializer):
    """Serializer for project cancellation requests"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title', read_only=True)
    project_status = serializers.CharField(source='project.status', read_only=True)
    coordinator_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectCancellationRequest
        fields = (
            'id', 'project', 'project_title', 'project_status', 'coordinator_name',
            'requested_by', 'requested_by_name', 'reason', 'status', 'status_display',
            'reviewed_by', 'reviewed_by_name', 'admin_remarks', 'reviewed_at',
            'created_at', 'updated_at'
        )
        read_only_fields = (
            'requested_by', 'status', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at'
        )
    
    def get_requested_by_name(self, obj):
        if obj.requested_by:
            name = f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip()
            return name or obj.requested_by.username
        return None
    
    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            name = f"{obj.reviewed_by.first_name} {obj.reviewed_by.last_name}".strip()
            return name or obj.reviewed_by.username
        return None
    
    def get_coordinator_name(self, obj):
        if obj.project and obj.project.coordinator:
            name = f"{obj.project.coordinator.first_name} {obj.project.coordinator.last_name}".strip()
            return name or obj.project.coordinator.username
        return None


class CommissionReportSerializer(serializers.ModelSerializer):
    """Serializer for commission reports"""
    project_title = serializers.CharField(source='project.title', read_only=True)
    agent_name = serializers.SerializerMethodField()
    generated_by_name = serializers.SerializerMethodField()
    report_file_url = serializers.SerializerMethodField()

    class Meta:
        model = CommissionReport
        fields = (
            'id', 'project', 'project_title', 'agent', 'agent_name',
            'generated_by', 'generated_by_name', 'commission_amount',
            'report_file', 'report_file_url', 'sent_to_agent', 'sent_at',
            'created_at'
        )
        read_only_fields = (
            'generated_by', 'agent', 'report_file', 'sent_to_agent',
            'sent_at', 'created_at'
        )

    def get_agent_name(self, obj):
        if obj.agent:
            name = f"{obj.agent.first_name} {obj.agent.last_name}".strip()
            return name or obj.agent.username
        return None

    def get_generated_by_name(self, obj):
        if obj.generated_by:
            name = f"{obj.generated_by.first_name} {obj.generated_by.last_name}".strip()
            return name or obj.generated_by.username
        return None

    def get_report_file_url(self, obj):
        if obj.report_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.report_file.url)
            return obj.report_file.url
        return None
