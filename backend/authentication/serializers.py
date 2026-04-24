from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import UserRole, PaymentSlip, ClientFormSubmission, EmployeeFormSubmission, LeaveRequest, EmployeeRemovalRequest


class UserRoleSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    assigned_by_username = serializers.CharField(source='assigned_by.username', read_only=True)
    salary = serializers.ReadOnlyField()
    
    class Meta:
        model = UserRole
        fields = ('id', 'role', 'role_display', 'salary', 'assigned_by', 'assigned_by_username', 'assigned_at', 'password_changed')
        read_only_fields = ('assigned_at',)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'email': {'required': True}
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    salary = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display', 'salary')
    
    def get_role(self, obj):
        """Get role from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return obj.role.role
        except Exception:
            pass
        return 'unassigned'
    
    def get_role_display(self, obj):
        """Get role display from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return obj.role.role_display
        except Exception:
            pass
        return 'Unassigned'
    
    def get_salary(self, obj):
        """Get salary from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return obj.role.salary
        except Exception:
            pass
        return 0


class UserDetailSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    salary = serializers.SerializerMethodField()
    role_info = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display', 'salary', 'role_info', 'date_joined')
    
    def get_role(self, obj):
        """Get role from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return obj.role.role
        except Exception:
            pass
        return 'unassigned'
    
    def get_role_display(self, obj):
        """Get role display from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return obj.role.role_display
        except Exception:
            pass
        return 'Unassigned'
    
    def get_salary(self, obj):
        """Get salary from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return obj.role.salary
        except Exception:
            pass
        return 0
    
    def get_role_info(self, obj):
        """Get role info from user's role"""
        try:
            if hasattr(obj, 'role') and obj.role:
                return UserRoleSerializer(obj.role).data
        except Exception:
            pass
        return None


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class AssignRoleSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)
    role = serializers.ChoiceField(choices=UserRole.ROLE_CHOICES, required=True)
    
    def validate_user_id(self, value):
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("User not found.")
        return value
    
    def validate_role(self, value):
        if value == 'admin':
            raise serializers.ValidationError("Admin role cannot be assigned.")
        return value


class PaymentSlipSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    month_display = serializers.CharField(source='get_month_display', read_only=True)
    generated_by_username = serializers.CharField(source='generated_by.username', read_only=True)
    salary = serializers.SerializerMethodField()
    allowances = serializers.SerializerMethodField()
    epf_contribution = serializers.SerializerMethodField()
    overtime_hours = serializers.SerializerMethodField()
    overtime_pay = serializers.SerializerMethodField()
    net_salary = serializers.SerializerMethodField()
    company_logo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = PaymentSlip
        fields = (
            'id', 'user', 'user_username', 'user_full_name', 'month', 'month_display', 
            'year', 'salary', 'allowances', 'epf_contribution', 'overtime_hours', 
            'overtime_hours_uploaded', 'overtime_pay', 'net_salary', 'role', 'role_display', 
            'pay_slip_number', 'employee_number', 'status', 'is_uploaded', 'uploaded_at',
            'generated_by', 'generated_by_username', 'generated_at', 'paid_at', 'company_logo_url'
        )
        read_only_fields = ('generated_at', 'paid_at')
    
    def get_user_full_name(self, obj):
        """Get user's full name"""
        if obj.user.first_name and obj.user.last_name:
            return f"{obj.user.first_name} {obj.user.last_name}"
        return obj.user.username
    
    def get_salary(self, obj):
        """Convert DecimalField to float for JSON serialization"""
        return float(obj.salary)
    
    def get_allowances(self, obj):
        """Convert DecimalField to float for JSON serialization"""
        return float(obj.allowances) if hasattr(obj, 'allowances') else 0.0
    
    def get_epf_contribution(self, obj):
        """Convert DecimalField to float for JSON serialization"""
        return float(obj.epf_contribution) if hasattr(obj, 'epf_contribution') else 0.0
    
    def get_overtime_hours(self, obj):
        """Convert DecimalField to float for JSON serialization"""
        return float(obj.overtime_hours) if hasattr(obj, 'overtime_hours') else 0.0
    
    def get_overtime_pay(self, obj):
        """Convert DecimalField to float for JSON serialization"""
        return float(obj.overtime_pay) if hasattr(obj, 'overtime_pay') else 0.0
    
    def get_net_salary(self, obj):
        """Convert DecimalField to float for JSON serialization"""
        return float(obj.net_salary) if hasattr(obj, 'net_salary') else 0.0
    
    def get_company_logo_url(self, obj):
        """Get company logo URL - can be from settings or default location"""
        from django.conf import settings
        import os
        
        # Try to get logo from media directory
        logo_path = os.path.join(settings.MEDIA_ROOT, 'company_logo.png')
        if os.path.exists(logo_path):
            # Return full URL to the logo
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(settings.MEDIA_URL + 'company_logo.png')
            # Fallback to relative URL
            return settings.MEDIA_URL + 'company_logo.png'
        
        # Return None if logo doesn't exist
        return None


class CoordinatorAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Coordinator Assignment history"""
    coordinator_name = serializers.SerializerMethodField()
    assigned_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        from .models import CoordinatorAssignment
        model = CoordinatorAssignment
        fields = (
            'id', 'coordinator', 'coordinator_name', 'assigned_by', 'assigned_by_name',
            'status', 'status_display', 'rejection_reason', 'assigned_at', 'responded_at'
        )
    
    def get_coordinator_name(self, obj):
        if obj.coordinator:
            name = f"{obj.coordinator.first_name} {obj.coordinator.last_name}".strip()
            return name if name else obj.coordinator.username
        return None
    
    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            name = f"{obj.assigned_by.first_name} {obj.assigned_by.last_name}".strip()
            return name if name else obj.assigned_by.username
        return None


class ClientFormSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for Client Form Submission"""
    coordinator_name = serializers.SerializerMethodField()
    coordinator_response_display = serializers.CharField(source='get_coordinator_response_display', read_only=True)
    assignment_history = serializers.SerializerMethodField()

    class Meta:
        model = ClientFormSubmission
        fields = (
            'id', 'first_name', 'last_name', 'email', 'address',
            'phone', 'nic', 'company_name', 'project_title',
            'project_description', 'agent_name', 'agent_phone',
            'agent_email', 'status', 'submitted_at', 'reviewed_at',
            'notes', 'reviewed_by', 'coordinator', 'coordinator_name',
            'assigned_at', 'coordinator_response', 'coordinator_response_display',
            'rejection_reason', 'responded_at', 'assignment_history', 'project_created'
        )
        read_only_fields = ('status', 'submitted_at', 'reviewed_at', 'reviewed_by', 'coordinator', 'assigned_at', 'responded_at')

    def get_coordinator_name(self, obj):
        if obj.coordinator:
            name = f"{obj.coordinator.first_name} {obj.coordinator.last_name}".strip()
            return name if name else obj.coordinator.username
        return None
    
    def get_assignment_history(self, obj):
        from .models import CoordinatorAssignment
        assignments = CoordinatorAssignment.objects.filter(submission=obj).order_by('-assigned_at')
        return CoordinatorAssignmentSerializer(assignments, many=True).data


class EmployeeFormSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for Employee Form Submission"""
    
    class Meta:
        model = EmployeeFormSubmission
        fields = (
            'id', 'first_name', 'last_name', 'email', 'address', 
            'phone', 'birthday', 'nic', 'cv', 'status', 
            'submitted_at', 'reviewed_at', 'notes', 'reviewed_by'
        )
        read_only_fields = ('status', 'submitted_at', 'reviewed_at', 'reviewed_by')


class LeaveRequestSerializer(serializers.ModelSerializer):
    """Serializer for Leave Request"""
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    employee_role = serializers.SerializerMethodField()
    leave_type_display = serializers.CharField(source='get_leave_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days = serializers.ReadOnlyField()
    can_cancel = serializers.SerializerMethodField()
    
    class Meta:
        model = LeaveRequest
        fields = (
            'id', 'user', 'employee_name', 'employee_id', 'employee_role', 'leave_type', 
            'leave_type_display', 'start_date', 'end_date', 'days',
            'is_half_day', 'half_day_period',
            'reason', 'status', 'status_display', 'submitted_at', 
            'reviewed_at', 'reviewed_by', 'notes',
            'cancelled_at', 'cancelled_by', 'can_cancel',
        )
        read_only_fields = (
            'user', 'status', 'submitted_at', 'reviewed_at', 'reviewed_by',
            'cancelled_at', 'cancelled_by',
        )

    def get_can_cancel(self, obj):
        """Employee can cancel if approved and start_date is still in the future."""
        from django.utils import timezone as _tz
        if obj.status != 'approved':
            return False
        if obj.cancelled_at is not None:
            return False
        return obj.start_date > _tz.now().date()
    
    def get_employee_name(self, obj):
        """Get employee full name"""
        name_parts = [obj.user.first_name, obj.user.last_name]
        return ' '.join(filter(None, name_parts)) or obj.user.username
    
    def get_employee_id(self, obj):
        """Get employee ID (user ID)"""
        return str(obj.user.id)
    
    def get_employee_role(self, obj):
        """Get employee role"""
        try:
            if hasattr(obj.user, 'role') and obj.user.role:
                return obj.user.role.role
        except Exception:
            pass
        return None


class EmployeeRemovalRequestSerializer(serializers.ModelSerializer):
    """Serializer for Employee Removal Request"""
    employee_name = serializers.SerializerMethodField()
    employee_username = serializers.CharField(source='user.username', read_only=True)
    employee_email = serializers.CharField(source='user.email', read_only=True)
    employee_role = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    requested_by_username = serializers.CharField(source='requested_by.username', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    reviewed_by_username = serializers.CharField(source='reviewed_by.username', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = EmployeeRemovalRequest
        fields = (
            'id', 'user', 'employee_name', 'employee_username', 'employee_email', 
            'employee_role', 'requested_by', 'requested_by_name', 'requested_by_username',
            'reason', 'status', 'status_display', 'reviewed_by', 'reviewed_by_name', 
            'reviewed_by_username', 'reviewed_at', 'admin_notes', 'created_at', 'updated_at'
        )
        read_only_fields = ('user', 'requested_by', 'status', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at')
    
    def get_employee_name(self, obj):
        """Get employee full name"""
        name_parts = [obj.user.first_name, obj.user.last_name]
        return ' '.join(filter(None, name_parts)) or obj.user.username
    
    def get_employee_role(self, obj):
        """Get employee role"""
        try:
            if hasattr(obj.user, 'role') and obj.user.role:
                return obj.user.role.get_role_display()
        except Exception:
            pass
        return 'Unassigned'
    
    def get_requested_by_name(self, obj):
        """Get requester full name"""
        name_parts = [obj.requested_by.first_name, obj.requested_by.last_name]
        return ' '.join(filter(None, name_parts)) or obj.requested_by.username
    
    def get_reviewed_by_name(self, obj):
        """Get reviewer full name"""
        if obj.reviewed_by:
            name_parts = [obj.reviewed_by.first_name, obj.reviewed_by.last_name]
            return ' '.join(filter(None, name_parts)) or obj.reviewed_by.username
        return None

