import secrets
import string
from rest_framework import status, generics
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from .models import (
    UserRole, PaymentSlip, ClientFormSubmission, EmployeeFormSubmission,
    LeaveRequest, EmployeeRemovalRequest, PasswordResetOTP,
    UserProfile, Invitation, LeavePolicy, LeaveBalance,
)
from .serializers import (
    UserRegistrationSerializer, 
    UserSerializer, 
    UserDetailSerializer,
    LoginSerializer,
    AssignRoleSerializer,
    UserRoleSerializer,
    PaymentSlipSerializer,
    ClientFormSubmissionSerializer,
    EmployeeFormSubmissionSerializer,
    LeaveRequestSerializer,
    EmployeeRemovalRequestSerializer
)


def _notify_auth_users(users, *, category, severity, title, message, meta=None, action_url='', email_subject=None, actor=None):
    """Best-effort helper for auth/submission notifications."""
    if meta is None:
        meta = {}
    try:
        from notifications.services import notify
        sent = set()
        for u in users:
            if u is None or (actor is not None and u == actor) or u.id in sent:
                continue
            sent.add(u.id)
            notify(
                user=u,
                category=category,
                severity=severity,
                title=title,
                message=message,
                meta=meta,
                action_url=action_url,
                email_subject=email_subject or title,
            )
    except Exception:
        pass


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserRegistrationSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        # Get user with role info
        user_data = UserSerializer(user).data
        
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='USER_REGISTER',
                user=user,
                description=f"New user registered: {user.username}",
                category='auth',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_auth_users(
            [user],
            category='auth',
            severity='success',
            title='Account created',
            message='Your account has been created successfully.',
            meta={'user_id': user.id},
            action_url='/dashboard',
        )

        return Response({
            'user': user_data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = (AllowAny,)
    serializer_class = LoginSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        user = authenticate(username=username, password=password)
        
        if user is not None:
            refresh = RefreshToken.for_user(user)
            user_data = UserSerializer(user).data

            # Feature #6: expose password_change_required flag
            password_change_required = False
            try:
                password_change_required = not user.role.password_changed
            except Exception:
                pass

            # Feature #6: mark invitation as accepted on first login (match sent OR delivered)
            try:
                from authentication.models import Invitation
                Invitation.objects.filter(user=user, status__in=['sent', 'delivered']).update(status='accepted')
            except Exception:
                pass

            # Feature #16: include theme preference
            theme = 'system'
            try:
                theme = user.userprofile.theme_preference
            except Exception:
                pass

            return Response({
                'user': user_data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'message': 'Login successful',
                'password_change_required': password_change_required,
                'theme_preference': theme,
            }, status=status.HTTP_200_OK)
        else:
            # Log failed login attempt with the attempted username
            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='USER_LOGIN',
                    user=None,
                    description=f"Failed login attempt for username '{username}'",
                    category='auth',
                    ip_address=get_client_ip(request),
                    metadata={'attempted_username': username, 'success': False},
                )
            except Exception:
                pass

            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)


class UserProfileView(generics.RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserDetailSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """Endpoint for authenticated users to change their password"""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')

        if not old_password or not new_password:
            return Response(
                {'error': 'Both old_password and new_password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'New password must be at least 8 characters'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not user.check_password(old_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        # Mark password as changed on the UserRole (for client/agent accounts created via project creation)
        try:
            if hasattr(user, 'role') and user.role:
                user.role.password_changed = True
                user.role.save(update_fields=['password_changed'])
        except Exception:
            pass

        # Update the matching Invitation row (Feature #6)
        try:
            Invitation.objects.filter(email__iexact=user.email).exclude(status='password_changed').update(
                status='password_changed'
            )
        except Exception:
            pass

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='PASSWORD_CHANGED',
                user=user,
                description=f"User {user.username} changed their password",
                category='auth',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_auth_users(
            [user],
            category='auth',
            severity='info',
            title='Password changed',
            message='Your password was changed successfully.',
            meta={'user_id': user.id},
            action_url='/profile',
        )

        return Response(
            {'message': 'Password changed successfully'},
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(APIView):
    """Send OTP to user's email for password reset"""
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'error': 'No account found with this email'}, status=status.HTTP_404_NOT_FOUND)

        otp_obj = PasswordResetOTP.generate(email)

        from .services import EmailService
        sent = EmailService.send_otp_email(email, otp_obj.otp)
        if not sent:
            return Response({'error': 'Failed to send OTP email. Please try again.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': 'OTP sent to your email'}, status=status.HTTP_200_OK)


class PasswordResetVerifyOTPView(APIView):
    """Verify OTP code"""
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email', '').strip()
        otp = request.data.get('otp', '').strip()

        if not email or not otp:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

        otp_obj = PasswordResetOTP.objects.filter(email__iexact=email, otp=otp, is_verified=False).first()
        if not otp_obj:
            return Response({'error': 'Invalid OTP code'}, status=status.HTTP_400_BAD_REQUEST)

        if otp_obj.is_expired:
            otp_obj.delete()
            return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

        otp_obj.is_verified = True
        otp_obj.save()

        return Response({'message': 'OTP verified successfully'}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """Reset password after OTP verification"""
    permission_classes = (AllowAny,)

    def post(self, request):
        email = request.data.get('email', '').strip()
        new_password = request.data.get('new_password', '')

        if not email or not new_password:
            return Response({'error': 'Email and new_password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)

        otp_obj = PasswordResetOTP.objects.filter(email__iexact=email, is_verified=True).first()
        if not otp_obj:
            return Response({'error': 'No verified OTP found. Please verify your OTP first.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'error': 'No account found with this email'}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.save()

        if hasattr(user, 'role') and user.role:
            user.role.password_changed = True
            user.role.save()

        # Update matching Invitation row (Feature #6)
        try:
            Invitation.objects.filter(email__iexact=user.email).exclude(status='password_changed').update(
                status='password_changed'
            )
        except Exception:
            pass

        PasswordResetOTP.objects.filter(email__iexact=email).delete()

        return Response({'message': 'Password reset successfully'}, status=status.HTTP_200_OK)


class AssignRoleView(APIView):
    """Admin endpoint to assign roles to users"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request):
        # Check if user is admin
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({
                'error': 'Only admins can assign roles'
            }, status=status.HTTP_403_FORBIDDEN)
        
        serializer = AssignRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_id = serializer.validated_data['user_id']
        role = serializer.validated_data['role']
        
        # Prevent assigning admin role to other users
        if role == 'admin':
            return Response({
                'error': 'Admin role cannot be assigned. Only the system admin has this role.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Enforce only one HR Head in the system
        if role == 'hr_head':
            existing_hr_head = UserRole.objects.filter(role='hr_head').exclude(user_id=user_id).exists()
            if existing_hr_head:
                return Response({
                    'error': 'An HR Head already exists in the system. Only one HR Head is allowed.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(id=user_id)
            
            # Prevent changing the system admin's role
            if user.role.role == 'admin':
                return Response({
                    'error': 'Cannot change the role of the system admin'
                }, status=status.HTTP_403_FORBIDDEN)
            
            user_role = user.role
            user_role.role = role
            user_role.assigned_by = request.user
            user_role.save()

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='ROLE_ASSIGNED',
                    user=request.user,
                    target_user=user,
                    description=f"Assigned role '{role}' to user {user.username}",
                    category='user',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            _notify_auth_users(
                [user],
                category='user',
                severity='info',
                title='Role updated',
                message=f'Your role has been updated to "{role}".',
                meta={'user_id': user.id, 'role': role},
                action_url='/profile',
                actor=request.user,
            )

            return Response({
                'message': 'Role assigned successfully',
                'user': UserDetailSerializer(user).data
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)


class DeleteUserView(APIView):
    """Admin endpoint to delete a user from the database"""
    permission_classes = (IsAuthenticated,)
    
    def delete(self, request, user_id):
        # Check if user is admin
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({
                'error': 'Only admins can delete users'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            user_to_delete = User.objects.get(id=user_id)
            
            # Prevent deleting the admin user
            if hasattr(user_to_delete, 'role') and user_to_delete.role.role == 'admin':
                return Response({
                    'error': 'Cannot delete the admin user'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent deleting yourself
            if user_to_delete.id == request.user.id:
                return Response({
                    'error': 'Cannot delete your own account'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get user info before deletion
            user_name = user_to_delete.get_full_name() or user_to_delete.username
            user_role = user_to_delete.role.role if hasattr(user_to_delete, 'role') else 'unknown'
            user_id_val = user_to_delete.id

            # Delete the user (this will cascade delete related records like UserRole, PaymentSlips, etc.)
            user_to_delete.delete()

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='USER_DELETE',
                    user=request.user,
                    description=f"Deleted user {user_name} ({user_role}), ID: {user_id_val}",
                    category='user',
                    ip_address=get_client_ip(request),
                    metadata={'deleted_user_name': user_name, 'deleted_user_role': user_role, 'deleted_user_id': user_id_val},
                )
            except Exception:
                pass
            _notify_auth_users(
                [request.user],
                category='user',
                severity='warning',
                title='User deleted',
                message=f'User {user_name} ({user_role}) was deleted from the system.',
                meta={'deleted_user_id': user_id_val},
                action_url='/dashboard/users',
            )
            
            return Response({
                'message': f'User {user_name} ({user_role}) has been deleted successfully from the database'
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error deleting user: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AllUsersView(generics.ListAPIView):
    """Admin and HR Head endpoint to view all users"""
    permission_classes = (IsAuthenticated,)
    serializer_class = UserDetailSerializer

    def get_queryset(self):
        # Check if user is admin or hr_head
        if not hasattr(self.request.user, 'role') or self.request.user.role.role not in ('admin', 'hr_head'):
            return User.objects.none()
        return User.objects.all().order_by('-date_joined')


class RoleListView(APIView):
    """Get available roles (excluding admin and unassigned)"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        roles = [
            {
                'value': role[0], 
                'label': role[1],
                'salary': UserRole.get_role_salary(role[0])
            } 
            for role in UserRole.ROLE_CHOICES
            if role[0] not in ['unassigned', 'admin']  # Exclude admin role from assignment
        ]
        return Response({'roles': roles}, status=status.HTTP_200_OK)


class MyRoleView(APIView):
    """Get current user's role"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        try:
            # Check if user has a role
            if hasattr(request.user, 'role') and request.user.role:
                serializer = UserRoleSerializer(request.user.role)
                return Response(serializer.data, status=status.HTTP_200_OK)
            else:
                # Create a default role if it doesn't exist
                user_role, created = UserRole.objects.get_or_create(
                    user=request.user,
                    defaults={'role': 'unassigned'}
                )
                serializer = UserRoleSerializer(user_role)
                return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            # If there's any error, create a default role
            try:
                user_role, created = UserRole.objects.get_or_create(
                    user=request.user,
                    defaults={'role': 'unassigned'}
                )
                serializer = UserRoleSerializer(user_role)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception:
                return Response({
                    'error': 'Role not found',
                    'role': 'unassigned',
                    'role_display': 'Unassigned',
                    'salary': 0
                }, status=status.HTTP_200_OK)


class GeneratePaymentSlipsView(APIView):
    """Admin and HR Head endpoint to generate payment slips for all users"""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        # Check if user is admin or HR Head
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can generate payment slips'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get month and year from request, or use current month/year
        month_raw = request.data.get('month')
        year_raw = request.data.get('year')
        
        try:
            # Cast to int to handle strings from frontend and avoid TypeErrors in comparison/validation
            month = int(month_raw) if month_raw else timezone.now().month
            year = int(year_raw) if year_raw else timezone.now().year
        except (ValueError, TypeError):
            return Response({
                'error': 'Month and year must be valid numbers.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate month and year
        if not (1 <= month <= 12):
            return Response({
                'error': 'Invalid month. Must be between 1 and 12.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if year < 2000 or year > 2100:
            return Response({
                'error': 'Invalid year.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate payment slips
        try:
            # Check if force_regenerate is requested (default to True to update existing slips)
            force_regenerate = request.data.get('force_regenerate', True)
            
            result = PaymentSlip.generate_for_all_users(
                month=month,
                year=year,
                generated_by=request.user,
                force_regenerate=force_regenerate
            )
            
            generated_count = result.get('generated', 0)
            updated_count = result.get('updated', 0)
            total_count = result.get('total', 0)
            
            message = f'Payment slips processed successfully: {generated_count} created, {updated_count} updated (Total: {total_count} users)'
            if total_count == 0:
                message = 'No payment slips generated. All eligible users may already have payment slips for this month/year, or no users match the criteria.'

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='PAYMENT_GENERATED',
                    user=request.user,
                    description=f"Generated payment slips for {month}/{year}: {generated_count} created, {updated_count} updated",
                    category='payment',
                    ip_address=get_client_ip(request),
                    metadata={'month': month, 'year': year, 'generated': generated_count, 'updated': updated_count, 'total': total_count},
                )
            except Exception:
                pass
            _notify_auth_users(
                [request.user],
                category='payment',
                severity='info',
                title='Payment slips generated',
                message=f'Generated/updated payment slips for {month}/{year}.',
                meta={'month': month, 'year': year, 'generated': generated_count, 'updated': updated_count},
                action_url='/dashboard/payment-slips',
            )
            
            return Response({
                'success': True,
                'message': message,
                'month': month,
                'year': year,
                'generated_count': generated_count,
                'updated_count': updated_count,
                'total_count': total_count
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error generating payment slips: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadPaymentSlipsView(APIView):
    """Admin and HR Head endpoint to upload/publish payment slips for employees to view"""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        # Check if user is admin or HR Head
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can upload payment slips'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get month and year from request, or use current month/year
        month_raw = request.data.get('month')
        year_raw = request.data.get('year')
        
        try:
            month = int(month_raw) if month_raw else timezone.now().month
            year = int(year_raw) if year_raw else timezone.now().year
        except (ValueError, TypeError):
            return Response({
                'success': False,
                'error': 'Month and year must be valid numbers.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate month and year
        if not (1 <= month <= 12):
            return Response({
                'success': False,
                'error': 'Invalid month. Must be between 1 and 12.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if year < 2000 or year > 2100:
            return Response({
                'success': False,
                'error': 'Invalid year.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get all payment slips for the specified month/year
            payment_slips = PaymentSlip.objects.filter(month=month, year=year)
            
            if not payment_slips.exists():
                return Response({
                    'success': False,
                    'error': f'No payment slips found for {month}/{year}. Please create payment slips first.'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Update all payment slips to be uploaded/published
            updated_count = payment_slips.update(
                is_uploaded=True,
                uploaded_at=timezone.now()
            )

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='PAYMENT_UPLOADED',
                    user=request.user,
                    description=f"Uploaded/published payment slips for {month}/{year}: {updated_count} employees",
                    category='payment',
                    ip_address=get_client_ip(request),
                    metadata={'month': month, 'year': year, 'uploaded_count': updated_count},
                )
            except Exception:
                pass
            try:
                recipients = [ps.user for ps in payment_slips.select_related('user') if getattr(ps, 'user', None)]
                _notify_auth_users(
                    recipients,
                    category='payment',
                    severity='info',
                    title='Payment slip available',
                    message=f'Your payment slip for {month}/{year} is now published.',
                    meta={'month': month, 'year': year},
                    action_url='/payment-slips',
                    actor=request.user,
                )
            except Exception:
                pass
            
            return Response({
                'success': True,
                'message': f'Payment slips uploaded successfully for {updated_count} employees',
                'month': month,
                'year': year,
                'uploaded_count': updated_count
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error uploading payment slips: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MyPaymentSlipsView(generics.ListAPIView):
    """Get current user's payment slips."""
    permission_classes = (IsAuthenticated,)
    serializer_class = PaymentSlipSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context for building absolute URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        try:
            # Check if user is admin
            is_admin = False
            try:
                if hasattr(self.request.user, 'role') and self.request.user.role:
                    is_admin = self.request.user.role.role == 'admin'
            except (AttributeError, Exception):
                # If user doesn't have a role, treat as non-admin
                is_admin = False
            
            if is_admin:
                # Admin can see all their payment slips (uploaded or not)
                return PaymentSlip.objects.filter(user=self.request.user).order_by('-year', '-month')
            else:
                # Employees can only see their own payment slips that are uploaded/published
                return PaymentSlip.objects.filter(
                    user=self.request.user,
                    is_uploaded=True
                ).order_by('-year', '-month')
        except Exception as e:
            # Return empty queryset on any error
            return PaymentSlip.objects.none()
    
    def list(self, request, *args, **kwargs):
        """Override list to wrap response in standard format"""
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error retrieving payment slips: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AllPaymentSlipsView(generics.ListAPIView):
    """Admin and HR Head endpoint to view all payment slips"""
    permission_classes = (IsAuthenticated,)
    serializer_class = PaymentSlipSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context for building absolute URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        # Check if user is admin or HR Head
        if not hasattr(self.request.user, 'role') or self.request.user.role.role not in ['admin', 'hr_head']:
            return PaymentSlip.objects.none()

        queryset = PaymentSlip.objects.exclude(
            user__role__role__in=['admin', 'hr_head']
        ).order_by('-year', '-month', 'user__username')
        
        # Optional filters
        month = self.request.query_params.get('month', None)
        year = self.request.query_params.get('year', None)
        user_id = self.request.query_params.get('user_id', None)
        
        if month:
            queryset = queryset.filter(month=month)
        if year:
            queryset = queryset.filter(year=year)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset

    def list(self, request, *args, **kwargs):
        """Override list to wrap response in standard format"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        }, status=status.HTTP_200_OK)


class PaymentSlipDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, and delete payment slip details (Admin and HR Head can view, Admin and HR Head can update/delete)"""
    permission_classes = (IsAuthenticated,)
    serializer_class = PaymentSlipSerializer
    
    def get_serializer_context(self):
        """Add request to serializer context for building absolute URLs"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        # Admins and HR Head can view payment slips
        if hasattr(self.request.user, 'role') and self.request.user.role.role in ['admin', 'hr_head']:
            return PaymentSlip.objects.all()
        
        # Employees cannot see payment slips - return empty queryset
        return PaymentSlip.objects.none()
    
    def update(self, request, *args, **kwargs):
        """Update payment slip and recalculate net salary (Admin and HR Head only)"""
        # Check if user is admin or HR Head
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can update payment slips'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            instance = self.get_object()
            
            # Get updated values from request
            salary = request.data.get('salary', None)
            allowances = request.data.get('allowances', None)
            epf_contribution = request.data.get('epf_contribution', None)
            overtime_pay = request.data.get('overtime_pay', None)
            overtime_hours = request.data.get('overtime_hours', None)
            
            # Validate and update fields if provided
            if salary is not None:
                try:
                    salary_decimal = Decimal(str(salary))
                    if salary_decimal < 0:
                        return Response({
                            'error': 'Salary cannot be negative'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    instance.salary = salary_decimal
                except (ValueError, InvalidOperation):
                    return Response({
                        'error': 'Invalid salary value'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            if allowances is not None:
                try:
                    allowances_decimal = Decimal(str(allowances))
                    if allowances_decimal < 0:
                        return Response({
                            'error': 'Allowances cannot be negative'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    instance.allowances = allowances_decimal
                except (ValueError, InvalidOperation):
                    return Response({
                        'error': 'Invalid allowances value'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            if epf_contribution is not None:
                try:
                    epf_decimal = Decimal(str(epf_contribution))
                    if epf_decimal < 0:
                        return Response({
                            'error': 'EPF contribution cannot be negative'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    instance.epf_contribution = epf_decimal
                except (ValueError, InvalidOperation):
                    return Response({
                        'error': 'Invalid EPF contribution value'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Handle overtime hours (only editable for admin payment slips)
            if overtime_hours is not None:
                # Only allow editing overtime hours for admin payment slips
                if instance.role == 'admin':
                    try:
                        overtime_hours_decimal = Decimal(str(overtime_hours))
                        if overtime_hours_decimal < 0:
                            return Response({
                                'error': 'Overtime hours cannot be negative'
                            }, status=status.HTTP_400_BAD_REQUEST)
                        instance.overtime_hours = overtime_hours_decimal
                        instance.overtime_hours_uploaded = True  # Mark as manually entered
                        # Recalculate overtime pay based on new overtime hours
                        from .models import PaymentSlip
                        instance.overtime_pay = Decimal(str(PaymentSlip.calculate_overtime_pay(float(overtime_hours_decimal), float(instance.salary))))
                    except (ValueError, InvalidOperation):
                        return Response({
                            'error': 'Invalid overtime hours value'
                        }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    # For non-admin roles, overtime hours come from attendance system and cannot be edited here
                    return Response({
                        'error': 'Overtime hours for this role are managed by the attendance system and cannot be manually edited'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            if overtime_pay is not None:
                try:
                    overtime_decimal = Decimal(str(overtime_pay))
                    if overtime_decimal < 0:
                        return Response({
                            'error': 'Overtime pay cannot be negative'
                        }, status=status.HTTP_400_BAD_REQUEST)
                    # Only allow direct overtime pay editing for admin (for other roles, it's calculated from overtime hours)
                    if instance.role == 'admin':
                        instance.overtime_pay = overtime_decimal
                    else:
                        # For other roles, overtime pay is calculated from overtime hours (attendance system)
                        # Don't allow direct editing
                        pass
                except (ValueError, InvalidOperation):
                    return Response({
                        'error': 'Invalid overtime pay value'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Recalculate net salary: Basic Salary - EPF + Allowances + Overtime Pay
            instance.net_salary = instance.salary - instance.epf_contribution + instance.allowances + instance.overtime_pay
            
            # Save the instance
            instance.save()
            
            # Serialize and return
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except PaymentSlip.DoesNotExist:
            return Response({
                'error': 'Payment slip not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error updating payment slip: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, *args, **kwargs):
        """Delete payment slip (Admin and HR Head only)"""
        # Check if user is admin or HR Head
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can delete payment slips'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            instance = self.get_object()
            employee_name = instance.user.get_full_name() or instance.user.username
            employee_number = instance.employee_number or str(instance.user.id)
            instance.delete()
            return Response({
                'message': f'Payment slip for {employee_name} (Employee #{employee_number}) has been deleted successfully'
            }, status=status.HTTP_200_OK)
        except PaymentSlip.DoesNotExist:
            return Response({
                'error': 'Payment slip not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error deleting payment slip: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UploadOvertimeHoursView(APIView):
    """Upload overtime hours for a specific payment slip"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, slip_id):
        # Check if user is admin or HR Head
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can upload overtime hours'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            slip = PaymentSlip.objects.get(id=slip_id)
        except PaymentSlip.DoesNotExist:
            return Response({
                'error': 'Payment slip not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        overtime_hours = request.data.get('overtime_hours', None)
        if overtime_hours is None:
            return Response({
                'error': 'overtime_hours is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            overtime_hours_decimal = Decimal(str(overtime_hours))
            if overtime_hours_decimal < 0:
                return Response({
                    'error': 'Overtime hours cannot be negative'
                }, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({
                'error': 'Invalid overtime_hours value'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update overtime hours and mark as uploaded
        slip.overtime_hours = overtime_hours_decimal
        slip.overtime_hours_uploaded = True
        
        # Recalculate overtime pay
        basic_salary = float(slip.salary)
        slip.overtime_pay = Decimal(str(PaymentSlip.calculate_overtime_pay(float(overtime_hours_decimal), basic_salary)))
        
        # Recalculate net salary: Basic Salary - EPF + Allowances + Overtime Pay
        slip.net_salary = slip.salary - slip.epf_contribution + slip.allowances + slip.overtime_pay
        
        slip.save()
        
        serializer = PaymentSlipSerializer(slip, context={'request': request})
        return Response({
            'success': True,
            'message': 'Overtime hours uploaded successfully',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


class UploadAllOvertimeHoursView(APIView):
    """Upload overtime hours for all payment slips from a file or JSON data"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request):
        # Check if user is admin or HR Head
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can upload overtime hours'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get month and year from request (optional, defaults to current month)
        month = request.data.get('month', None)
        year = request.data.get('year', None)
        
        if month is None or year is None:
            now = timezone.now()
            month = month or now.month
            year = year or now.year
        
        # Get overtime hours data (list of {user_id: overtime_hours} or {slip_id: overtime_hours})
        overtime_data = request.data.get('overtime_data', None)
        
        if not overtime_data:
            return Response({
                'error': 'overtime_data is required. Format: [{"user_id": 1, "overtime_hours": 10.5}, ...] or [{"slip_id": 1, "overtime_hours": 10.5}, ...]'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        updated_count = 0
        errors = []
        
        for item in overtime_data:
            try:
                slip_id = item.get('slip_id', None)
                user_id = item.get('user_id', None)
                overtime_hours = item.get('overtime_hours', None)
                
                if overtime_hours is None:
                    errors.append(f'Missing overtime_hours for item: {item}')
                    continue
                
                overtime_hours_decimal = Decimal(str(overtime_hours))
                if overtime_hours_decimal < 0:
                    errors.append(f'Invalid overtime_hours for item: {item}')
                    continue
                
                # Find payment slip
                if slip_id:
                    try:
                        slip = PaymentSlip.objects.get(id=slip_id)
                    except PaymentSlip.DoesNotExist:
                        errors.append(f'Payment slip {slip_id} not found')
                        continue
                elif user_id:
                    try:
                        slip = PaymentSlip.objects.get(user_id=user_id, month=month, year=year)
                    except PaymentSlip.DoesNotExist:
                        errors.append(f'Payment slip for user {user_id} in {month}/{year} not found')
                        continue
                else:
                    errors.append(f'Missing slip_id or user_id for item: {item}')
                    continue
                
                # Update overtime hours and mark as uploaded
                slip.overtime_hours = overtime_hours_decimal
                slip.overtime_hours_uploaded = True
                
                # Recalculate overtime pay
                basic_salary = float(slip.salary)
                slip.overtime_pay = Decimal(str(PaymentSlip.calculate_overtime_pay(float(overtime_hours_decimal), basic_salary)))
                
                # Recalculate net salary
                slip.net_salary = slip.salary - slip.epf_contribution + slip.allowances + slip.overtime_pay
                
                slip.save()
                updated_count += 1
                
            except Exception as e:
                errors.append(f'Error processing item {item}: {str(e)}')
        
        return Response({
            'success': True,
            'message': f'Updated {updated_count} payment slip(s)',
            'updated_count': updated_count,
            'errors': errors if errors else None
        }, status=status.HTTP_200_OK)


class SyncOvertimeFromAttendanceView(APIView):
    """Sync overtime hours from attendance records to payment slips for a given month/year"""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'hr_head']:
            return Response({
                'error': 'Only admins and HR Head can sync overtime hours'
            }, status=status.HTTP_403_FORBIDDEN)

        month = request.data.get('month')
        year = request.data.get('year')

        if not month or not year:
            return Response({
                'error': 'month and year are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            month = int(month)
            year = int(year)
        except (ValueError, TypeError):
            return Response({
                'error': 'Invalid month or year'
            }, status=status.HTTP_400_BAD_REQUEST)

        slips = PaymentSlip.objects.filter(month=month, year=year)

        if not slips.exists():
            return Response({
                'error': f'No payment slips found for {month}/{year}'
            }, status=status.HTTP_404_NOT_FOUND)

        updated_count = 0
        for slip in slips:
            overtime_hours = PaymentSlip.get_monthly_overtime_hours(slip.user, month, year)
            overtime_hours_decimal = Decimal(str(overtime_hours))

            slip.overtime_hours = overtime_hours_decimal
            basic_salary = float(slip.salary)
            slip.overtime_pay = Decimal(str(PaymentSlip.calculate_overtime_pay(float(overtime_hours_decimal), basic_salary)))
            slip.net_salary = slip.salary - slip.epf_contribution + slip.allowances + slip.overtime_pay
            slip.save()
            updated_count += 1

        return Response({
            'success': True,
            'message': f'Synced overtime for {updated_count} payment slip(s) from attendance records',
            'updated_count': updated_count
        }, status=status.HTTP_200_OK)


class ClientRegistrationView(APIView):
    """API endpoint for client registration form submission"""
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            serializer = ClientFormSubmissionSerializer(data=request.data)
            if serializer.is_valid():
                submission = serializer.save()
                try:
                    from system_logs.utils import log_action, get_client_ip
                    log_action(
                        action='CLIENT_FORM_SUBMITTED',
                        user=None,
                        description=f"New client registration from {submission.first_name} {submission.last_name} ({submission.email})",
                        category='submission',
                        ip_address=get_client_ip(request),
                        metadata={'submission_id': submission.id, 'company': submission.company_name, 'project': submission.project_title},
                    )
                except Exception:
                    pass
                try:
                    admins = User.objects.filter(role__role='admin', is_active=True)
                    _notify_auth_users(
                        list(admins),
                        category='submission',
                        severity='info',
                        title='New client form submission',
                        message=f'{submission.first_name} {submission.last_name} submitted a new client form.',
                        meta={'submission_id': submission.id},
                        action_url='/dashboard/submissions',
                    )
                except Exception:
                    pass

                # Send confirmation email to client
                try:
                    from .services import EmailService
                    client_name = f'{submission.first_name or ""} {submission.last_name or ""}'.strip()
                    EmailService.send_submission_confirmation(
                        email=submission.email,
                        name=client_name,
                        submission_type='client',
                        project_title=submission.project_title,
                    )
                    # Send confirmation to agent if provided
                    if submission.agent_email:
                        EmailService.send_submission_confirmation(
                            email=submission.agent_email,
                            name=submission.agent_name or 'Agent',
                            submission_type='agent',
                            project_title=submission.project_title,
                        )
                except Exception:
                    pass

                return Response({
                    'success': True,
                    'message': 'Client registration submitted successfully. An administrator will review your application.',
                    'id': submission.id
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': 'Validation failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error processing submission: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EmployeeRegistrationView(APIView):
    """API endpoint for employee registration form submission"""
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            # Check for duplicate email before saving
            email = request.data.get('email', '').strip().lower()
            if email and User.objects.filter(email__iexact=email).exists():
                return Response({
                    'success': False,
                    'error': 'An account with this email already exists.',
                    'field': 'email'
                }, status=status.HTTP_400_BAD_REQUEST)

            serializer = EmployeeFormSubmissionSerializer(data=request.data)
            if serializer.is_valid():
                submission = serializer.save()
                try:
                    from system_logs.utils import log_action, get_client_ip
                    log_action(
                        action='EMPLOYEE_FORM_SUBMITTED',
                        user=None,
                        description=f"New employee application from {submission.first_name} {submission.last_name} ({submission.email})",
                        category='submission',
                        ip_address=get_client_ip(request),
                        metadata={'submission_id': submission.id},
                    )
                except Exception:
                    pass
                try:
                    admins = User.objects.filter(role__role='admin', is_active=True)
                    _notify_auth_users(
                        list(admins),
                        category='submission',
                        severity='info',
                        title='New employee form submission',
                        message=f'{submission.first_name} {submission.last_name} submitted a new employee application.',
                        meta={'submission_id': submission.id},
                        action_url='/dashboard/employee-submissions',
                    )
                except Exception:
                    pass

                # Send confirmation email to employee
                try:
                    from .services import EmailService
                    emp_name = f'{submission.first_name or ""} {submission.last_name or ""}'.strip()
                    if submission.email:
                        EmailService.send_submission_confirmation(
                            email=submission.email,
                            name=emp_name,
                            submission_type='employee',
                        )
                except Exception:
                    pass

                return Response({
                    'success': True,
                    'message': 'Employee registration submitted successfully. An administrator will review your application.',
                    'id': submission.id
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': 'Validation failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error processing submission: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateLeaveRequestView(APIView):
    """API endpoint for employees to create leave requests"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request):
        try:
            # Prevent HR Head from creating leave requests for themselves
            if hasattr(request.user, 'role') and request.user.role.role == 'hr_head':
                return Response({
                    'error': 'HR Head cannot submit leave requests'
                }, status=status.HTTP_403_FORBIDDEN)

            data = request.data.copy()
            data['user'] = request.user.id
            serializer = LeaveRequestSerializer(data=data)
            if serializer.is_valid():
                leave_request = serializer.save(user=request.user)
                try:
                    from system_logs.utils import log_action, get_client_ip
                    log_action(
                        action='LEAVE_CREATED',
                        user=request.user,
                        description=f"Leave request created: {leave_request.get_leave_type_display()} from {leave_request.start_date} to {leave_request.end_date} ({leave_request.days} days)",
                        category='leave',
                        ip_address=get_client_ip(request),
                        metadata={'leave_id': leave_request.id, 'leave_type': leave_request.leave_type, 'days': leave_request.days},
                    )
                except Exception:
                    pass

                # Feature #3 (C1): notify all HR heads of the new request.
                try:
                    from notifications.services import notify
                    hr_heads = User.objects.filter(role__role='hr_head', is_active=True)
                    employee_name = request.user.get_full_name() or request.user.username
                    title = f'New leave request from {employee_name}'
                    half_day_suffix = ''
                    if getattr(leave_request, 'is_half_day', False):
                        period_raw = (getattr(leave_request, 'half_day_period', '') or '').strip().lower()
                        period_label = 'morning' if period_raw == 'morning' else 'afternoon'
                        half_day_suffix = f' (half-day, {period_label})'
                    msg = (
                        f"{employee_name} requested {leave_request.days} day(s) of "
                        f"{leave_request.get_leave_type_display()}{half_day_suffix} from {leave_request.start_date} "
                        f"to {leave_request.end_date}."
                    )
                    meta = {'leave_id': leave_request.id}
                    for hr in hr_heads:
                        notify(
                            user=hr, category='leave', severity='info',
                            title=title, message=msg, meta=meta,
                            action_url='/dashboard/leave-requests',
                            email_subject=title,
                        )
                except Exception:
                    pass

                return Response({
                    'success': True,
                    'message': 'Leave request submitted successfully',
                    'data': LeaveRequestSerializer(leave_request).data
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': 'Validation failed',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error creating leave request: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AllLeaveRequestsView(generics.ListAPIView):
    """API endpoint for HR Head to view leave requests"""
    permission_classes = (IsAuthenticated,)
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        # Check if user is HR Head
        try:
            user_role = UserRole.objects.get(user=self.request.user)
            # HR Head can see all leave requests
            if user_role.role == 'hr_head':
                return LeaveRequest.objects.all().order_by('-submitted_at')
        except UserRole.DoesNotExist:
            return LeaveRequest.objects.none()
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })


class MyLeaveRequestsView(generics.ListAPIView):
    """API endpoint for employees to view their own leave requests"""
    permission_classes = (IsAuthenticated,)
    serializer_class = LeaveRequestSerializer
    
    def get_queryset(self):
        # Filter by current user
        return LeaveRequest.objects.filter(user=self.request.user).order_by('-submitted_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })


class MyLeaveStatisticsView(APIView):
    """API endpoint for employees to get their leave statistics"""
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        try:
            # Total leaves allocated per year
            TOTAL_LEAVES = 45
            
            # Get approved and pending leave requests for current user in current year
            current_year = timezone.now().year
            
            approved_leaves = LeaveRequest.objects.filter(
                user=request.user,
                status='approved',
                start_date__year=current_year
            )
            
            pending_leaves = LeaveRequest.objects.filter(
                user=request.user,
                status='pending',
                start_date__year=current_year
            )
            
            # Calculate days
            approved_days = sum(leave.days for leave in approved_leaves)
            pending_days = sum(leave.days for leave in pending_leaves)

            # Count requests
            approved_count = approved_leaves.count()
            pending_count = pending_leaves.count()

            # Calculate remaining leaves: Total leaves (45) - Approved days
            remaining_leaves = max(0, TOTAL_LEAVES - approved_days)

            return Response({
                'success': True,
                'data': {
                    'total_leave_days': TOTAL_LEAVES,
                    'approved_days': approved_days,
                    'pending_days': pending_days,
                    'approved_count': approved_count,
                    'pending_count': pending_count,
                    'remaining_leaves': remaining_leaves,
                    'year': current_year,
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error calculating leave statistics: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MonthlyLeaveSummaryView(APIView):
    """API endpoint for HR Head to get monthly leave summary for all employees"""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        try:
            # Check if user is HR Head
            user_role = UserRole.objects.get(user=request.user)
            if user_role.role != 'hr_head':
                return Response({
                    'success': False,
                    'error': 'Only HR Head can view leave summary'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Get month and year from query parameters (default to current month/year)
            month = int(request.query_params.get('month', timezone.now().month))
            year = int(request.query_params.get('year', timezone.now().year))
            
            # Get all approved leave requests for the specified month and year
            approved_leaves = LeaveRequest.objects.filter(
                status='approved',
                start_date__year=year,
                start_date__month=month
            ).select_related('user')
            
            # Group by user and calculate total days per employee
            employee_leave_summary = {}
            for leave in approved_leaves:
                user_id = leave.user.id
                employee_name = f"{leave.user.first_name} {leave.user.last_name}".strip()
                if not employee_name:
                    employee_name = leave.user.username
                
                if user_id not in employee_leave_summary:
                    employee_leave_summary[user_id] = {
                        'employee_id': str(user_id),
                        'employee_name': employee_name,
                        'leave_taken': 0,
                    }
                
                employee_leave_summary[user_id]['leave_taken'] += leave.days
            
            # Convert to list and sort by employee name
            summary_list = list(employee_leave_summary.values())
            summary_list.sort(key=lambda x: x['employee_name'])
            
            return Response({
                'success': True,
                'data': summary_list,
                'month': month,
                'year': year,
            }, status=status.HTTP_200_OK)
        except UserRole.DoesNotExist:
            return Response({
                'success': False,
                'error': 'User role not found'
            }, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error getting leave summary: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateLeaveRequestView(APIView):
    """API endpoint for HR Head to approve/reject leave requests"""
    permission_classes = (IsAuthenticated,)

    def patch(self, request, pk):
        try:
            # Check if user is HR Head
            user_role = UserRole.objects.get(user=request.user)
            if user_role.role != 'hr_head':
                return Response({
                    'success': False,
                    'error': 'Only HR Head can update leave requests'
                }, status=status.HTTP_403_FORBIDDEN)
            
            leave_request = LeaveRequest.objects.get(pk=pk)
            new_status = request.data.get('status')
            
            if new_status not in ['approved', 'rejected']:
                return Response({
                    'success': False,
                    'error': 'Invalid status. Must be "approved" or "rejected"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            leave_request.status = new_status
            leave_request.reviewed_by = request.user
            leave_request.reviewed_at = timezone.now()
            if request.data.get('notes'):
                leave_request.notes = request.data.get('notes')
            leave_request.save()

            try:
                from system_logs.utils import log_action, get_client_ip
                action_type = 'LEAVE_APPROVED' if new_status == 'approved' else 'LEAVE_REJECTED'
                employee_name = leave_request.user.get_full_name() or leave_request.user.username
                log_action(
                    action=action_type,
                    user=request.user,
                    target_user=leave_request.user,
                    description=f"Leave request {new_status} for {employee_name}: {leave_request.get_leave_type_display()} ({leave_request.days} days)",
                    category='leave',
                    ip_address=get_client_ip(request),
                    metadata={'leave_id': leave_request.id, 'status': new_status},
                )
            except Exception:
                pass

            # Feature #15 (C5): on approve, increment LeaveBalance.
            if new_status == 'approved':
                try:
                    year = leave_request.start_date.year
                    lb, _ = LeaveBalance.objects.get_or_create(
                        user=leave_request.user,
                        year=year,
                        leave_type=leave_request.leave_type,
                    )
                    from decimal import Decimal
                    lb.used_days = Decimal(str(lb.used_days)) + Decimal(str(leave_request.days))
                    lb.save(update_fields=['used_days'])
                except Exception:
                    pass

            # Feature #3 (C1): notify the employee of approve/reject decision.
            try:
                from notifications.services import notify
                title = f'Leave request {new_status}'
                msg = (
                    f"Your {leave_request.get_leave_type_display()} request for "
                    f"{leave_request.days} day(s) ({leave_request.start_date} → "
                    f"{leave_request.end_date}) was {new_status}."
                )
                notify(
                    user=leave_request.user,
                    category='leave',
                    severity='success' if new_status == 'approved' else 'warning',
                    title=title,
                    message=msg,
                    meta={'leave_id': leave_request.id, 'status': new_status},
                    action_url='/dashboard/my-leave-requests',
                    email_subject=title,
                )
            except Exception:
                pass

            return Response({
                'success': True,
                'message': f'Leave request {new_status} successfully',
                'data': LeaveRequestSerializer(leave_request).data
            }, status=status.HTTP_200_OK)
        except UserRole.DoesNotExist:
            return Response({
                'success': False,
                'error': 'User role not found'
            }, status=status.HTTP_403_FORBIDDEN)
        except LeaveRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Leave request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error updating leave request: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CreateEmployeeRemovalRequestView(APIView):
    """HR Head endpoint to create an employee removal request"""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        # Check if user is HR Head
        if not hasattr(request.user, 'role') or request.user.role.role != 'hr_head':
            return Response({
                'error': 'Only HR Head can create removal requests'
            }, status=status.HTTP_403_FORBIDDEN)
        
        user_id = request.data.get('user_id')
        reason = request.data.get('reason', '')
        
        if not user_id:
            return Response({
                'error': 'user_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user_to_remove = User.objects.get(id=user_id)
            
            # Prevent requesting removal of admin
            if hasattr(user_to_remove, 'role') and user_to_remove.role.role == 'admin':
                return Response({
                    'error': 'Cannot request removal of admin user'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent requesting removal of yourself
            if user_to_remove.id == request.user.id:
                return Response({
                    'error': 'Cannot request removal of your own account'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Check if there's already a pending request for this user
            existing_request = EmployeeRemovalRequest.objects.filter(
                user=user_to_remove,
                status='pending'
            ).first()
            
            if existing_request:
                return Response({
                    'error': 'A pending removal request already exists for this employee'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create the removal request
            removal_request = EmployeeRemovalRequest.objects.create(
                user=user_to_remove,
                requested_by=request.user,
                reason=reason,
                status='pending'
            )
            
            serializer = EmployeeRemovalRequestSerializer(removal_request)

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='REMOVAL_CREATED',
                    user=request.user,
                    target_user=user_to_remove,
                    description=f"Removal request created for {user_to_remove.get_full_name() or user_to_remove.username} by HR Head {request.user.username}",
                    category='removal',
                    ip_address=get_client_ip(request),
                    metadata={'reason': reason},
                )
            except Exception:
                pass
            _notify_auth_users(
                [user_to_remove] + list(User.objects.filter(role__role='admin', is_active=True)),
                category='removal',
                severity='warning',
                title='Employee removal request created',
                message=f'Removal request created for {user_to_remove.get_full_name() or user_to_remove.username}.',
                meta={'removal_request_id': removal_request.id, 'user_id': user_to_remove.id},
                action_url='/dashboard/removal-requests',
                actor=request.user,
            )

            return Response({
                'success': True,
                'message': f'Removal request for {user_to_remove.get_full_name() or user_to_remove.username} has been submitted and is pending admin approval',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error creating removal request: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AllRemovalRequestsView(generics.ListAPIView):
    """Admin and HR Head endpoint to view employee removal requests"""
    permission_classes = (IsAuthenticated,)
    serializer_class = EmployeeRemovalRequestSerializer

    def get_queryset(self):
        if not hasattr(self.request.user, 'role'):
            return EmployeeRemovalRequest.objects.none()

        user_role = self.request.user.role.role
        if user_role == 'admin':
            return EmployeeRemovalRequest.objects.all()
        elif user_role == 'hr_head':
            return EmployeeRemovalRequest.objects.filter(requested_by=self.request.user)

        return EmployeeRemovalRequest.objects.none()

    def list(self, request, *args, **kwargs):
        if not hasattr(request.user, 'role') or request.user.role.role not in ('admin', 'hr_head'):
            return Response({
                'error': 'Only admins and HR Head can view removal requests'
            }, status=status.HTTP_403_FORBIDDEN)

        return super().list(request, *args, **kwargs)


class ApproveRemovalRequestView(APIView):
    """Admin endpoint to approve an employee removal request"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, request_id):
        # Check if user is admin
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({
                'error': 'Only admins can approve removal requests'
            }, status=status.HTTP_403_FORBIDDEN)
        
        admin_notes = request.data.get('admin_notes', '')
        
        try:
            removal_request = EmployeeRemovalRequest.objects.get(id=request_id)
            
            if removal_request.status != 'pending':
                return Response({
                    'error': f'This request has already been {removal_request.get_status_display().lower()}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Prevent deleting admin user
            if hasattr(removal_request.user, 'role') and removal_request.user.role.role == 'admin':
                return Response({
                    'error': 'Cannot approve removal of admin user'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Update request status
            removal_request.status = 'approved'
            removal_request.reviewed_by = request.user
            removal_request.reviewed_at = timezone.now()
            removal_request.admin_notes = admin_notes
            removal_request.save()
            
            # Delete the user
            user_to_delete = removal_request.user
            user_name = user_to_delete.get_full_name() or user_to_delete.username
            user_id_val = user_to_delete.id
            user_to_delete.delete()

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='REMOVAL_APPROVED',
                    user=request.user,
                    description=f"Removal request approved for {user_name} (ID: {user_id_val}). User deleted from system.",
                    category='removal',
                    ip_address=get_client_ip(request),
                    metadata={'removed_user_name': user_name, 'removed_user_id': user_id_val, 'admin_notes': admin_notes},
                )
            except Exception:
                pass
            _notify_auth_users(
                [removal_request.requested_by],
                category='removal',
                severity='success',
                title='Removal request approved',
                message=f'Removal request approved for {user_name}.',
                meta={'removal_request_id': removal_request.id, 'user_id': user_id_val},
                action_url='/dashboard/removal-requests',
                actor=request.user,
            )
            
            serializer = EmployeeRemovalRequestSerializer(removal_request)
            
            return Response({
                'success': True,
                'message': f'Removal request approved. {user_name} has been removed from the database.',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except EmployeeRemovalRequest.DoesNotExist:
            return Response({
                'error': 'Removal request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error approving removal request: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RejectRemovalRequestView(APIView):
    """Admin endpoint to reject an employee removal request"""
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, request_id):
        # Check if user is admin
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({
                'error': 'Only admins can reject removal requests'
            }, status=status.HTTP_403_FORBIDDEN)
        
        admin_notes = request.data.get('admin_notes', '')
        
        try:
            removal_request = EmployeeRemovalRequest.objects.get(id=request_id)
            
            if removal_request.status != 'pending':
                return Response({
                    'error': f'This request has already been {removal_request.get_status_display().lower()}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update request status
            removal_request.status = 'rejected'
            removal_request.reviewed_by = request.user
            removal_request.reviewed_at = timezone.now()
            removal_request.admin_notes = admin_notes
            removal_request.save()

            serializer = EmployeeRemovalRequestSerializer(removal_request)

            user_name = removal_request.user.get_full_name() or removal_request.user.username

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='REMOVAL_REJECTED',
                    user=request.user,
                    target_user=removal_request.user,
                    description=f"Removal request rejected for {user_name}",
                    category='removal',
                    ip_address=get_client_ip(request),
                    metadata={'admin_notes': admin_notes},
                )
            except Exception:
                pass
            _notify_auth_users(
                [removal_request.requested_by, removal_request.user],
                category='removal',
                severity='info',
                title='Removal request rejected',
                message=f'Removal request for {user_name} was rejected.',
                meta={'removal_request_id': removal_request.id},
                action_url='/dashboard/removal-requests',
                actor=request.user,
            )
            
            return Response({
                'success': True,
                'message': f'Removal request for {user_name} has been rejected.',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except EmployeeRemovalRequest.DoesNotExist:
            return Response({
                'error': 'Removal request not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Error rejecting removal request: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



def generate_password(length=10):
    """Generate a secure random password"""
    chars = string.ascii_letters + string.digits + '!@#$%'
    return ''.join(secrets.choice(chars) for _ in range(length))


class SubmissionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AllClientSubmissionsView(APIView):
    """Admin and Coordinator endpoint to view and manage client form submissions"""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'coordinator']:
            return Response({'error': 'Only admins and coordinators can view submissions'}, status=status.HTTP_403_FORBIDDEN)

        user_role = request.user.role.role

        # Base queryset depending on role
        if user_role == 'admin':
            queryset = ClientFormSubmission.objects.select_related('coordinator').all().order_by('-submitted_at')
        else:
            # Coordinator sees submissions assigned to them AND submissions they rejected
            from .models import CoordinatorAssignment
            rejected_submission_ids = CoordinatorAssignment.objects.filter(
                coordinator=request.user,
                status='rejected'
            ).values_list('submission_id', flat=True)
            queryset = ClientFormSubmission.objects.select_related('coordinator').filter(
                Q(coordinator=request.user) | Q(id__in=rejected_submission_ids)
            ).order_by('-submitted_at')

        # Summary counts BEFORE applying search/status filters
        summary = {
            'total': queryset.count(),
            'pending': queryset.filter(status='pending').count(),
            'assigned': queryset.filter(status='assigned').count(),
            'approved': queryset.filter(status='approved').count(),
            'rejected': queryset.filter(status='rejected').count(),
            'reviewed': queryset.filter(status='reviewed').count(),
        }

        # Filters
        status_filter = request.query_params.get('status', None)
        coordinator_response_filter = request.query_params.get('coordinator_response', None)
        search = request.query_params.get('search', None)

        if status_filter:
            if status_filter == 'pending':
                queryset = queryset.filter(status__in=['pending', 'reviewed', 'assigned'])
            else:
                queryset = queryset.filter(status=status_filter)
        if coordinator_response_filter:
            queryset = queryset.filter(coordinator_response=coordinator_response_filter)
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(company_name__icontains=search) |
                Q(project_title__icontains=search) |
                Q(agent_name__icontains=search)
            )

        # Pagination
        paginator = SubmissionPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ClientFormSubmissionSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        response.data['summary'] = summary
        return response


class ClientSubmissionDetailView(APIView):
    """Admin and Coordinator endpoint to view and update a single client submission"""
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'coordinator']:
            return Response({'error': 'Only admins and coordinators can view submissions'}, status=status.HTTP_403_FORBIDDEN)
        try:
            submission = ClientFormSubmission.objects.get(pk=pk)
            # Coordinator can only view submissions assigned to them
            if request.user.role.role == 'coordinator' and submission.coordinator != request.user:
                return Response({'error': 'You can only view submissions assigned to you'}, status=status.HTTP_403_FORBIDDEN)
            serializer = ClientFormSubmissionSerializer(submission)
            return Response(serializer.data)
        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        """Update submission status and notes"""
        if not hasattr(request.user, 'role') or request.user.role.role not in ['admin', 'coordinator']:
            return Response({'error': 'Only admins and coordinators can update submissions'}, status=status.HTTP_403_FORBIDDEN)
        try:
            submission = ClientFormSubmission.objects.get(pk=pk)
            # Coordinator can only update submissions assigned to them
            if request.user.role.role == 'coordinator' and submission.coordinator != request.user:
                return Response({'error': 'You can only update submissions assigned to you'}, status=status.HTTP_403_FORBIDDEN)
            new_status = request.data.get('status', None)
            notes = request.data.get('notes', None)

            if new_status:
                submission.status = new_status
            if notes is not None:
                submission.notes = notes
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save()

            # Send status update email to client and agent
            if new_status:
                try:
                    from .services import EmailService
                    EmailService.send_status_update(submission, new_status)
                except Exception:
                    pass

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='SUBMISSION_STATUS_UPDATED',
                    user=request.user,
                    description=f'Client submission from {submission.first_name} {submission.last_name} updated to {new_status}',
                    category='submission',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            try:
                recipients = [submission.coordinator] if submission.coordinator else []
                if hasattr(request.user, 'role') and request.user.role.role == 'admin':
                    recipients.extend(list(User.objects.filter(role__role='admin', is_active=True)))
                _notify_auth_users(
                    recipients,
                    category='submission',
                    severity='info',
                    title='Client submission updated',
                    message=f'Status updated to {new_status or submission.status} for {submission.first_name} {submission.last_name}.',
                    meta={'submission_id': submission.id, 'status': submission.status},
                    action_url='/dashboard/submissions',
                    actor=request.user,
                )
            except Exception:
                pass

            serializer = ClientFormSubmissionSerializer(submission)
            return Response({'success': True, 'data': serializer.data})
        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        """Delete a rejected submission (cancel project)"""
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can delete submissions'}, status=status.HTTP_403_FORBIDDEN)
        try:
            submission = ClientFormSubmission.objects.get(pk=pk)
            if submission.status != 'rejected':
                return Response({'error': 'Only rejected submissions can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='SUBMISSION_CANCELLED',
                    user=request.user,
                    description=f'Rejected client submission from {submission.first_name} {submission.last_name} was cancelled and removed',
                    category='submission',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            _notify_auth_users(
                [request.user],
                category='submission',
                severity='warning',
                title='Submission cancelled',
                message=f'Cancelled rejected submission from {submission.first_name} {submission.last_name}.',
                meta={'submission_id': submission.id},
                action_url='/dashboard/submissions',
            )

            submission.delete()
            return Response({'success': True, 'message': 'Submission cancelled and removed.'})
        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)


class AssignCoordinatorView(APIView):
    """Admin endpoint to assign a coordinator to a client submission"""
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can assign coordinators'}, status=status.HTTP_403_FORBIDDEN)

        coordinator_id = request.data.get('coordinator_id')
        if not coordinator_id:
            return Response({'error': 'coordinator_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            submission = ClientFormSubmission.objects.get(pk=pk)
        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            coordinator = User.objects.get(id=coordinator_id)
            if not hasattr(coordinator, 'role') or coordinator.role.role != 'coordinator':
                return Response({'error': 'Selected user is not a coordinator'}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'error': 'Coordinator not found'}, status=status.HTTP_404_NOT_FOUND)

        # Create a new CoordinatorAssignment record
        from .models import CoordinatorAssignment
        CoordinatorAssignment.objects.create(
            submission=submission,
            coordinator=coordinator,
            assigned_by=request.user,
            status='pending'
        )

        # Update submission with new coordinator and reset response fields
        submission.coordinator = coordinator
        submission.coordinator_response = 'pending'
        submission.rejection_reason = None
        submission.responded_at = None
        submission.status = 'assigned'
        submission.assigned_at = timezone.now()
        submission.save()

        coord_name = f"{coordinator.first_name} {coordinator.last_name}".strip() or coordinator.username

        try:
            from .services import EmailService
            EmailService.send_status_update(submission, 'assigned', coordinator_name=coord_name)
        except Exception:
            pass

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='COORDINATOR_ASSIGNED',
                user=request.user,
                description=f'Assigned coordinator {coord_name} to submission from {submission.first_name} {submission.last_name}',
                category='submission',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass

        try:
            from notifications.services import notify
            client_name = f'{submission.first_name} {submission.last_name}'.strip()
            notify(
                user=coordinator,
                category='submission',
                severity='info',
                title='New Submission Assigned to You',
                message=f'You have been assigned as coordinator for the submission from {client_name}. Please review and respond.',
                meta={'submission_id': submission.id},
                action_url='/dashboard/submissions',
            )
        except Exception:
            pass

        serializer = ClientFormSubmissionSerializer(submission)
        return Response({'success': True, 'data': serializer.data}, status=status.HTTP_200_OK)


class AvailableCoordinatorsView(APIView):
    """Admin endpoint to get list of available coordinators"""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can view coordinators'}, status=status.HTTP_403_FORBIDDEN)

        coordinators = User.objects.filter(role__role='coordinator', is_active=True).select_related('role')

        data = []
        for coord in coordinators:
            assigned_count = ClientFormSubmission.objects.filter(coordinator=coord).count()
            data.append({
                'id': coord.id,
                'username': coord.username,
                'full_name': f"{coord.first_name} {coord.last_name}".strip() or coord.username,
                'email': coord.email,
                'assigned_count': assigned_count,
            })

        return Response({'coordinators': data}, status=status.HTTP_200_OK)


class ApproveClientSubmissionView(APIView):
    """Admin endpoint to approve a client submission"""
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can approve submissions'}, status=status.HTTP_403_FORBIDDEN)

        try:
            submission = ClientFormSubmission.objects.get(pk=pk)

            if submission.status == 'approved':
                return Response({'error': 'This submission has already been approved'}, status=status.HTTP_400_BAD_REQUEST)

            # Validate client email doesn't conflict with existing non-client users
            existing_client = User.objects.filter(email__iexact=submission.email).first()
            if existing_client:
                if not (hasattr(existing_client, 'role') and existing_client.role.role == 'client'):
                    existing_role = existing_client.role.role if hasattr(existing_client, 'role') else 'unknown'
                    return Response({
                        'error': f'A user with email {submission.email} already exists with role "{existing_role}". Cannot create client account.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Validate agent email doesn't conflict with existing non-agent users
            if submission.agent_email:
                existing_agent = User.objects.filter(email__iexact=submission.agent_email).first()
                if existing_agent:
                    if not (hasattr(existing_agent, 'role') and existing_agent.role.role == 'agent'):
                        existing_role = existing_agent.role.role if hasattr(existing_agent, 'role') else 'unknown'
                        return Response({
                            'error': f'A user with email {submission.agent_email} already exists with role "{existing_role}". Cannot create agent account.'
                        }, status=status.HTTP_400_BAD_REQUEST)

            # Update submission status
            submission.status = 'approved'
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save()

            # Send status update email
            try:
                from .services import EmailService
                EmailService.send_status_update(submission, 'approved')
            except Exception:
                pass

            try:
                from system_logs.utils import log_action, get_client_ip
                desc = f'Approved client submission from {submission.first_name} {submission.last_name}.'
                desc += ' Client and agent accounts will be created upon project creation.'
                log_action(
                    action='CLIENT_SUBMISSION_APPROVED',
                    user=request.user,
                    description=desc,
                    category='submission',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass

            try:
                from notifications.services import notify
                client_name = f'{submission.first_name} {submission.last_name}'.strip()
                admins = User.objects.filter(role__role='admin', is_active=True)
                for admin in admins:
                    notify(
                        user=admin,
                        category='submission',
                        severity='info',
                        title='Client Submission Approved',
                        message=f'Submission from {client_name} has been approved and is ready for project setup.',
                        meta={'submission_id': submission.id},
                        action_url='/dashboard/submissions',
                    )
            except Exception:
                pass

            return Response({
                'success': True,
                'message': 'Submission approved successfully. Client and agent accounts will be created when the project is set up.',
            }, status=status.HTTP_200_OK)

        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error approving submission: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AllEmployeeSubmissionsView(APIView):
    """Admin endpoint to view and manage all employee form submissions"""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can view submissions'}, status=status.HTTP_403_FORBIDDEN)

        queryset = EmployeeFormSubmission.objects.all().order_by('-submitted_at')

        # Summary counts BEFORE applying search/status filters
        summary = {
            'total': queryset.count(),
            'pending': queryset.filter(status='pending').count(),
            'reviewed': queryset.filter(status='reviewed').count(),
            'approved': queryset.filter(status='approved').count(),
            'rejected': queryset.filter(status='rejected').count(),
        }

        # Filters
        status_filter = request.query_params.get('status', None)
        search = request.query_params.get('search', None)

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(nic__icontains=search)
            )

        paginator = SubmissionPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = EmployeeFormSubmissionSerializer(page, many=True, context={'request': request})
        response = paginator.get_paginated_response(serializer.data)
        response.data['summary'] = summary
        return response


class EmployeeSubmissionDetailView(APIView):
    """Admin endpoint to view and update a single employee submission"""
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can view submissions'}, status=status.HTTP_403_FORBIDDEN)
        try:
            submission = EmployeeFormSubmission.objects.get(pk=pk)
            serializer = EmployeeFormSubmissionSerializer(submission, context={'request': request})
            return Response(serializer.data)
        except EmployeeFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can update submissions'}, status=status.HTTP_403_FORBIDDEN)
        try:
            submission = EmployeeFormSubmission.objects.get(pk=pk)
            new_status = request.data.get('status', None)
            notes = request.data.get('notes', None)

            if new_status:
                submission.status = new_status
            if notes is not None:
                submission.notes = notes
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save()

            # Send status update email to employee applicant
            if new_status:
                try:
                    from .services import EmailService
                    EmailService.send_employee_status_update(submission, new_status)
                except Exception:
                    pass

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='SUBMISSION_STATUS_UPDATED',
                    user=request.user,
                    description=f'Employee submission from {submission.first_name} {submission.last_name} updated to {new_status}',
                    category='submission',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            _notify_auth_users(
                [request.user],
                category='submission',
                severity='info',
                title='Employee submission updated',
                message=f'Status updated to {new_status or submission.status} for {submission.first_name} {submission.last_name}.',
                meta={'submission_id': submission.id, 'status': submission.status},
                action_url='/dashboard/employee-submissions',
            )

            serializer = EmployeeFormSubmissionSerializer(submission, context={'request': request})
            return Response({'success': True, 'data': serializer.data})
        except EmployeeFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)


class RoleSalariesView(APIView):
    """Return default salary mapping for each employee role"""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
        # Only include hireable roles
        hireable = [
            'coordinator', 'field_officer', 'accessor',
            'senior_valuer', 'md_gm', 'hr_head', 'general_employee',
        ]
        salaries = {r: UserRole.ROLE_SALARIES.get(r, 0) for r in hireable}
        return Response(salaries)


class HireEmployeeSubmissionView(APIView):
    """Admin endpoint to approve employee submission and create an employee account"""
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'admin':
            return Response({'error': 'Only admins can hire employees'}, status=status.HTTP_403_FORBIDDEN)

        try:
            submission = EmployeeFormSubmission.objects.get(pk=pk)

            if submission.status == 'approved':
                return Response({'error': 'This submission has already been approved'}, status=status.HTTP_400_BAD_REQUEST)

            role = request.data.get('role', 'general_employee')
            if role in ['admin', 'client', 'agent', 'unassigned']:
                return Response({'error': f'Cannot assign role: {role}'}, status=status.HTTP_400_BAD_REQUEST)

            # Enforce only one HR Head in the system
            if role == 'hr_head':
                if UserRole.objects.filter(role='hr_head').exists():
                    return Response({
                        'error': 'An HR Head already exists in the system. Only one HR Head is allowed.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Generate username from email or name
            if submission.email:
                base_username = submission.email.split('@')[0]
            # Generate username from name
            first = (submission.first_name or '').strip().lower().replace(' ', '_')
            last = (submission.last_name or '').strip().lower().replace(' ', '_')
            if first and last:
                base_username = f'{first}_{last}'
            elif first:
                base_username = first
            elif last:
                base_username = last
            else:
                base_username = f'employee_{submission.id}'
            # Remove any non-alphanumeric characters except underscores
            base_username = ''.join(c for c in base_username if c.isalnum() or c == '_')
            username = base_username
            if User.objects.filter(username=username).exists():
                username = f'{base_username}_{submission.id}'
            # If still exists, add a counter
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f'{base_username}_{counter}'
                counter += 1

            password = generate_password()
            user = User.objects.create_user(
                username=username,
                email=submission.email or '',
                password=password,
                first_name=submission.first_name or '',
                last_name=submission.last_name or '',
            )

            # Explicitly fetch the role created by the post_save signal
            # to avoid Django OneToOneField reverse-cache issues
            user_role = UserRole.objects.get(user=user)
            user_role.role = role
            user_role.assigned_by = request.user
            user_role.password_changed = False

            # Set custom salary if provided
            salary = request.data.get('salary')
            if salary is not None:
                from decimal import Decimal, InvalidOperation
                try:
                    custom_salary = Decimal(str(salary))
                    default_salary = Decimal(str(UserRole.ROLE_SALARIES.get(role, 0)))
                    if custom_salary != default_salary:
                        user_role.custom_salary = custom_salary
                except (InvalidOperation, ValueError):
                    pass

            user_role.save()

            # Verify the account credentials work
            verified = authenticate(username=username, password=password)
            if verified is None:
                # Re-set the password to ensure it's correctly hashed
                user.set_password(password)
                user.save(update_fields=['password'])

            # Send email if available
            if submission.email:
                try:
                    from .services import EmailService
                    # Get the role display name and salary for the email
                    role_display = dict(UserRole.ROLE_CHOICES).get(role, role)
                    actual_salary = float(user_role.salary)
                    EmailService.send_account_credentials(
                        email=submission.email,
                        username=username,
                        password=password,
                        user_type='employee',
                        name=f'{submission.first_name} {submission.last_name}'.strip(),
                        role=role_display,
                        salary=actual_salary,
                    )
                except Exception:
                    pass

            # Update submission
            submission.status = 'approved'
            submission.reviewed_by = request.user
            submission.reviewed_at = timezone.now()
            submission.save()

            # Feature #6 (C4): create Invitation tracking row for employees.
            try:
                Invitation.objects.update_or_create(
                    email=(submission.email or '').lower(),
                    defaults={
                        'user': user,
                        'role': role,
                        'status': 'sent',
                        'invited_by': request.user,
                    },
                )
            except Exception:
                pass

            # Send status update email to employee
            try:
                from .services import EmailService
                EmailService.send_employee_status_update(submission, 'approved')
            except Exception:
                pass

            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='EMPLOYEE_CREATED',
                    user=request.user,
                    target_user=user,
                    description=f'Hired {submission.first_name} {submission.last_name} as {role}. Username: {username}',
                    category='user',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            _notify_auth_users(
                [user],
                category='user',
                severity='success',
                title='Account created',
                message='Your employee account is ready. Use the emailed credentials to sign in.',
                meta={'user_id': user.id, 'role': role},
                action_url='/login',
                actor=request.user,
            )

            return Response({
                'success': True,
                'message': 'Employee account created successfully. Login credentials have been sent to the employee\'s email.',
            }, status=status.HTTP_201_CREATED)

        except EmployeeFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Error hiring employee: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AcceptAssignmentView(APIView):
    """Coordinator endpoint to accept an assigned submission"""
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'coordinator':
            return Response({'error': 'Only coordinators can accept assignments'}, status=status.HTTP_403_FORBIDDEN)

        try:
            submission = ClientFormSubmission.objects.get(pk=pk)
            
            # Check if this submission is assigned to the current coordinator
            if submission.coordinator != request.user:
                return Response({'error': 'This submission is not assigned to you'}, status=status.HTTP_403_FORBIDDEN)
            
            # Check if already responded
            if submission.coordinator_response != 'pending':
                return Response({'error': f'Already responded to this assignment ({submission.coordinator_response})'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Accept the assignment
            submission.coordinator_response = 'accepted'
            submission.responded_at = timezone.now()
            submission.save()
            
            # Update the CoordinatorAssignment record
            from .models import CoordinatorAssignment
            assignment = CoordinatorAssignment.objects.filter(
                submission=submission,
                coordinator=request.user,
                status='pending'
            ).order_by('-assigned_at').first()
            if assignment:
                assignment.status = 'accepted'
                assignment.responded_at = timezone.now()
                assignment.save()
            
            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='ASSIGNMENT_ACCEPTED',
                    user=request.user,
                    description=f'Coordinator {request.user.username} accepted assignment for submission from {submission.first_name} {submission.last_name}',
                    category='submission',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            _notify_auth_users(
                list(User.objects.filter(role__role='admin', is_active=True)),
                category='submission',
                severity='info',
                title='Coordinator accepted assignment',
                message=f'{request.user.get_full_name() or request.user.username} accepted a submission assignment.',
                meta={'submission_id': submission.id},
                action_url='/dashboard/submissions',
                actor=request.user,
            )
            
            serializer = ClientFormSubmissionSerializer(submission)
            return Response({
                'success': True,
                'message': 'Assignment accepted successfully. You can now create a project.',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
            
        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)


class RejectAssignmentView(APIView):
    """Coordinator endpoint to reject an assigned submission"""
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk):
        if not hasattr(request.user, 'role') or request.user.role.role != 'coordinator':
            return Response({'error': 'Only coordinators can reject assignments'}, status=status.HTTP_403_FORBIDDEN)

        rejection_reason = request.data.get('rejection_reason', '').strip()
        if not rejection_reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            submission = ClientFormSubmission.objects.get(pk=pk)
            
            # Check if this submission is assigned to the current coordinator
            if submission.coordinator != request.user:
                return Response({'error': 'This submission is not assigned to you'}, status=status.HTTP_403_FORBIDDEN)
            
            # Check if already responded
            if submission.coordinator_response != 'pending':
                return Response({'error': f'Already responded to this assignment ({submission.coordinator_response})'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Update the CoordinatorAssignment record first
            from .models import CoordinatorAssignment
            assignment = CoordinatorAssignment.objects.filter(
                submission=submission,
                coordinator=request.user,
                status='pending'
            ).order_by('-assigned_at').first()
            if assignment:
                assignment.status = 'rejected'
                assignment.rejection_reason = rejection_reason
                assignment.responded_at = timezone.now()
                assignment.save()
            
            # Reject the assignment on submission
            submission.coordinator_response = 'rejected'
            submission.rejection_reason = rejection_reason
            submission.responded_at = timezone.now()
            # Reset coordinator and status so admin can reassign
            old_coordinator = submission.coordinator
            submission.coordinator = None
            submission.status = 'pending'  # Reset to pending for reassignment
            submission.save()
            
            # Send email notification to admin(s) about the rejection
            try:
                from .services import EmailService
                EmailService.send_assignment_rejection_to_admin(
                    submission=submission,
                    coordinator=old_coordinator,
                    rejection_reason=rejection_reason
                )
            except Exception:
                pass
            
            try:
                from system_logs.utils import log_action, get_client_ip
                log_action(
                    action='ASSIGNMENT_REJECTED',
                    user=request.user,
                    description=f'Coordinator {request.user.username} rejected assignment for submission from {submission.first_name} {submission.last_name}. Reason: {rejection_reason}',
                    category='submission',
                    ip_address=get_client_ip(request),
                )
            except Exception:
                pass
            _notify_auth_users(
                list(User.objects.filter(role__role='admin', is_active=True)),
                category='submission',
                severity='warning',
                title='Coordinator rejected assignment',
                message=f'{request.user.get_full_name() or request.user.username} rejected an assignment. Reason: {rejection_reason}',
                meta={'submission_id': submission.id, 'reason': rejection_reason},
                action_url='/dashboard/submissions',
                actor=request.user,
            )
            
            serializer = ClientFormSubmissionSerializer(submission)
            return Response({
                'success': True,
                'message': 'Assignment rejected. Admin has been notified for reassignment.',
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        except ClientFormSubmission.DoesNotExist:
            return Response({'error': 'Submission not found'}, status=status.HTTP_404_NOT_FOUND)


class AdminDashboardStatsView(APIView):
    """Aggregated dashboard stats for admin"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user_role = UserRole.objects.get(user=request.user)
            if user_role.role != 'admin':
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        except UserRole.DoesNotExist:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        from datetime import timedelta
        from django.db.models import Count
        from django.db.models.functions import TruncMonth

        now = timezone.now()

        # Total users
        total_users = User.objects.filter(is_active=True).count()

        # Active projects
        from projects.models import Project
        active_projects = Project.objects.filter(status='in_progress').count()

        # Pending removal requests
        removal_requests = EmployeeRemovalRequest.objects.filter(status='pending').count()

        # Project status distribution
        status_dist = dict(
            Project.objects.values_list('status')
            .annotate(count=Count('id'))
            .values_list('status', 'count')
        )

        # New projects per month (last 6 months)
        six_months_ago = now - timedelta(days=180)
        monthly_projects = (
            Project.objects.filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        new_projects_chart = [
            {'month': entry['month'].strftime('%b %y'), 'count': entry['count']}
            for entry in monthly_projects
        ]

        # Priority distribution
        priority_dist = dict(
            Project.objects.values_list('priority')
            .annotate(count=Count('id'))
            .values_list('priority', 'count')
        )

        return Response({
            'total_users': total_users,
            'active_projects': active_projects,
            'removal_requests': removal_requests,
            'project_status_distribution': {
                'completed': status_dist.get('completed', 0),
                'in_progress': status_dist.get('in_progress', 0),
                'pending': status_dist.get('pending', 0),
            },
            'new_projects_per_month': new_projects_chart,
            'priority_distribution': {
                'high': priority_dist.get('high', 0),
                'medium': priority_dist.get('medium', 0),
                'low': priority_dist.get('low', 0),
            },
        })


# ============================================================================
# Feature #5: Extended Admin KPIs
# ============================================================================

class AdminKPIView(APIView):
    """Rich KPIs for admin dashboard."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role.role != 'admin':
                return Response({'error': 'Admin only'}, status=403)
        except Exception:
            return Response({'error': 'Admin only'}, status=403)

        from django.db.models import Avg, Count, F, ExpressionWrapper, DurationField, Q
        from django.db.models.functions import TruncMonth, TruncQuarter, TruncYear
        from projects.models import Project, ProjectStatusHistory
        from datetime import timedelta, date
        from collections import defaultdict

        now = timezone.now()
        twelve_months_ago = now - timedelta(days=365)

        # Projects completed on-time by employee per month
        completed = Project.objects.filter(
            status='completed',
            end_date__isnull=False,
            assigned_field_officer__isnull=False,
        ).select_related('assigned_field_officer')

        on_time_data = []
        employee_times = defaultdict(list)  # employee_id → list of (days_taken,)
        for p in completed:
            actual_end = None
            # C3 FIX: use last transition to completed (not first)
            hist = p.history.filter(status='completed').order_by('-created_at').first()
            if hist:
                actual_end = hist.created_at.date()
            on_time = actual_end is not None and actual_end <= p.end_date
            fo = p.assigned_field_officer
            month_label = (actual_end or p.end_date).strftime('%b %Y') if (actual_end or p.end_date) else None
            on_time_data.append({
                'employee_id': fo.id,
                'employee_name': fo.get_full_name() or fo.username,
                'on_time': on_time,
                'month': month_label,
            })
            # Track duration for avg_time_per_job
            if p.start_date:
                end_for_calc = actual_end or p.end_date
                if end_for_calc:
                    days_taken = (end_for_calc - p.start_date).days
                    employee_times[fo.id].append(days_taken)

        # C3: on_time_delivery_summary — {month → {employee_name → {on_time, late, total}}}
        on_time_summary = defaultdict(lambda: defaultdict(lambda: {'on_time': 0, 'late': 0, 'total': 0}))
        for entry in on_time_data:
            m = entry['month'] or 'N/A'
            e = entry['employee_name']
            on_time_summary[m][e]['total'] += 1
            if entry['on_time']:
                on_time_summary[m][e]['on_time'] += 1
            else:
                on_time_summary[m][e]['late'] += 1
        on_time_summary_dict = {m: dict(employees) for m, employees in on_time_summary.items()}

        # C3: avg_jobs_per_employee — completed projects per field officer
        from django.contrib.auth.models import User as DjangoUser
        fo_ids = (
            Project.objects.filter(status='completed', assigned_field_officer__isnull=False)
            .values_list('assigned_field_officer', flat=True).distinct()
        )
        avg_jobs = []
        for foid in fo_ids:
            try:
                fo = DjangoUser.objects.get(id=foid)
            except DjangoUser.DoesNotExist:
                continue
            total = Project.objects.filter(status='completed', assigned_field_officer_id=foid).count()
            times = employee_times.get(foid, [])
            avg_days = round(sum(times) / len(times), 1) if times else None
            avg_jobs.append({
                'employee_id': foid,
                'employee_name': fo.get_full_name() or fo.username,
                'completed_count': total,
                'avg_days_per_job': avg_days,
            })

        # New clients by month (last 12 months)
        new_clients = (
            UserRole.objects.filter(
                role='client',
                created_at__gte=twelve_months_ago,
            )
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        new_clients_chart = [
            {'month': e['month'].strftime('%b %y'), 'count': e['count']}
            for e in new_clients
        ]

        # Project status by period
        def period_stats(trunc_fn):
            return list(
                Project.objects.annotate(period=trunc_fn('created_at'))
                .values('period', 'status')
                .annotate(count=Count('id'))
                .order_by('period')
            )

        return Response({
            'on_time_delivery': on_time_data,
            'on_time_delivery_summary': on_time_summary_dict,
            'avg_jobs_per_employee': avg_jobs,
            'new_clients_by_month': new_clients_chart,
            'project_status_by_month': period_stats(TruncMonth),
            'project_status_by_quarter': period_stats(TruncQuarter),
            'project_status_by_year': period_stats(TruncYear),
        })


# ============================================================================
# Feature #6: Invitation tracking
# ============================================================================

class InvitationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role.role != 'admin':
                return Response({'error': 'Admin only'}, status=403)
        except Exception:
            return Response({'error': 'Admin only'}, status=403)

        role = request.query_params.get('role')
        inv_status = request.query_params.get('status')
        qs = Invitation.objects.select_related('user', 'invited_by').order_by('-sent_at')
        if role:
            qs = qs.filter(role=role)
        if inv_status:
            qs = qs.filter(status=inv_status)

        data = []
        from projects.models import Project
        for inv in qs[:200]:
            inviter_name = None
            if inv.invited_by:
                inviter_name = inv.invited_by.get_full_name() or inv.invited_by.username
            elif inv.user_id:
                # Backfill legacy rows where invited_by was not stored:
                # infer the coordinator from first related project assignment.
                p = (
                    Project.objects.filter(assigned_client_id=inv.user_id)
                    .select_related('coordinator')
                    .order_by('-created_at')
                    .first()
                ) or (
                    Project.objects.filter(assigned_agent_id=inv.user_id)
                    .select_related('coordinator')
                    .order_by('-created_at')
                    .first()
                )
                if p and p.coordinator:
                    inviter_name = p.coordinator.get_full_name() or p.coordinator.username

            data.append({
                'id': inv.id,
                'email': inv.email,
                'role': inv.role,
                'status': inv.status,
                'sent_at': inv.sent_at,
                'updated_at': inv.updated_at,
                'user_id': inv.user_id,
                'invited_by': inviter_name,
            })
        return Response(data)


# ============================================================================
# Feature #7: Public email/role check
# ============================================================================

class PublicCheckEmailThrottle(AnonRateThrottle):
    rate = '30/min'


# Normalize intent aliases from public forms to actual DB role values
_INTENT_ALIASES = {
    'employee': 'general_employee',
    'staff': 'general_employee',
    'fieldofficer': 'field_officer',
    'seniorvaluer': 'senior_valuer',
    'md_gm': 'md_gm',
    'mdgm': 'md_gm',
    'hrhead': 'hr_head',
    'hr': 'hr_head',
}


def _normalize_intent(intent):
    if not intent:
        return ''
    normalized = intent.strip().lower().replace(' ', '_').replace('-', '_')
    return _INTENT_ALIASES.get(normalized.replace('_', ''), _INTENT_ALIASES.get(normalized, normalized))


class PublicCheckEmailView(APIView):
    """Rate-limited public endpoint to check email-role conflicts on landing page."""
    permission_classes = []
    throttle_classes = [PublicCheckEmailThrottle]

    def get(self, request):
        email = request.query_params.get('email', '').strip().lower()
        intent_raw = request.query_params.get('intent', '').strip()
        intent = _normalize_intent(intent_raw)
        if not email or not intent:
            return Response({'error': 'email and intent required'}, status=400)

        try:
            user = User.objects.get(email__iexact=email)
            existing_role = getattr(getattr(user, 'role', None), 'role', 'unassigned')
            conflict = existing_role not in ('unassigned',) and existing_role != intent
            return Response({
                'exists': True,
                'conflict': conflict,
                'existing_role': existing_role,
                'normalized_intent': intent,
            })
        except User.DoesNotExist:
            return Response({'exists': False, 'conflict': False, 'normalized_intent': intent})


# ============================================================================
# Feature #15: Leave Balance, Policy, Cancel
# ============================================================================

class LeaveBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import date
        user = request.user
        year = int(request.query_params.get('year', date.today().year))
        role = getattr(getattr(user, 'role', None), 'role', 'general_employee')

        policies = LeavePolicy.objects.filter(role=role)
        balances = {b.leave_type: b.used_days for b in LeaveBalance.objects.filter(user=user, year=year)}

        result = []
        for policy in policies:
            used = balances.get(policy.leave_type, 0)
            remaining = max(policy.annual_quota_days - used, 0)
            overdraft = max(used - policy.annual_quota_days, 0)
            result.append({
                'leave_type': policy.leave_type,
                'quota': float(policy.annual_quota_days),
                'used': float(used),
                'remaining': float(remaining),
                'overdraft': float(overdraft),
            })
        return Response({'year': year, 'balances': result})


class CancelLeaveRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone as tz
        try:
            leave = LeaveRequest.objects.get(pk=pk, user=request.user)
        except LeaveRequest.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if leave.status != 'approved':
            return Response({'error': 'Only approved leaves can be cancelled.'}, status=400)
        if leave.start_date <= tz.now().date():
            return Response({'error': 'Cannot cancel a leave that has already started or passed.'}, status=400)

        leave.status = 'cancelled_by_user'
        leave.cancelled_at = tz.now()
        leave.cancelled_by = request.user
        leave.save()

        # Rollback leave balance
        try:
            bal, _ = LeaveBalance.objects.get_or_create(
                user=request.user, year=leave.start_date.year, leave_type=leave.leave_type,
                defaults={'used_days': 0},
            )
            bal.used_days = max(bal.used_days - leave.days, 0)
            bal.save()
        except Exception:
            pass

        # Notify HR head
        from notifications.services import notify
        hr_heads = User.objects.filter(role__role='hr_head')
        employee_name = request.user.get_full_name() or request.user.username
        for hr in hr_heads:
            notify(
                user=hr,
                category='leave', severity='info',
                title=f'Leave Cancelled: {employee_name}',
                message=f'{employee_name} cancelled their {leave.get_leave_type_display()} leave ({leave.start_date} to {leave.end_date}).',
                meta={'leave_id': leave.id, 'user_id': request.user.id},
            )

        return Response({'status': 'cancelled'})


class LeavePolicyListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = LeavePolicy.objects.all()

    def list(self, request, *args, **kwargs):
        policies = LeavePolicy.objects.all()
        return Response([{
            'id': p.id, 'role': p.role, 'leave_type': p.leave_type,
            'annual_quota_days': float(p.annual_quota_days),
            'allow_half_day': p.allow_half_day,
            'working_days_per_month': p.working_days_per_month,
        } for p in policies])


class LeavePolicyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = LeavePolicy.objects.all()

    def retrieve(self, request, *args, **kwargs):
        p = self.get_object()
        return Response({
            'id': p.id, 'role': p.role, 'leave_type': p.leave_type,
            'annual_quota_days': float(p.annual_quota_days),
            'allow_half_day': p.allow_half_day,
            'working_days_per_month': p.working_days_per_month,
        })

    def partial_update(self, request, *args, **kwargs):
        try:
            if request.user.role.role != 'admin':
                return Response({'error': 'Admin only'}, status=403)
        except Exception:
            return Response({'error': 'Admin only'}, status=403)
        p = self.get_object()
        for field in ['annual_quota_days', 'allow_half_day', 'working_days_per_month']:
            if field in request.data:
                setattr(p, field, request.data[field])
        p.save()
        return Response({'status': 'updated'})


# ============================================================================
# Feature #16: User Profile (avatar, theme, settings)
# ============================================================================

class UserProfileMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
        role_info = {}
        try:
            r = user.role
            role_info = {
                'role': r.role,
                'role_display': r.get_role_display(),
                'assigned_at': r.assigned_at,
                'password_changed': r.password_changed,
            }
        except Exception:
            pass

        avatar_url = None
        if profile.profile_image:
            avatar_url = request.build_absolute_uri(profile.profile_image.url)

        return Response({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role_info': role_info,
            'profile': {
                'theme_preference': profile.theme_preference,
                'phone': profile.phone,
                'bio': profile.bio,
                'timezone': profile.timezone,
                'locale': profile.locale,
                'preferences': profile.preferences,
                'profile_image_url': avatar_url,
                'updated_at': profile.updated_at,
            },
        })

    def patch(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
        allowed = ['theme_preference', 'phone', 'bio', 'timezone', 'locale', 'preferences']
        for field in allowed:
            if field in request.data:
                setattr(profile, field, request.data[field])
        profile.save()

        # Also update name if provided
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        user.save(update_fields=['first_name', 'last_name'])

        return Response({'status': 'updated'})


class UserAvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        from rest_framework.parsers import MultiPartParser, FormParser
        file = request.FILES.get('avatar')
        if not file:
            return Response({'error': 'avatar file required'}, status=400)
        if file.size > 2 * 1024 * 1024:
            return Response({'error': 'File too large (max 2MB)'}, status=400)
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        if file.content_type not in allowed_types:
            return Response({'error': 'Only JPEG, PNG, or WebP images allowed'}, status=400)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.profile_image:
            try:
                profile.profile_image.delete(save=False)
            except Exception:
                pass

        import os
        ext = os.path.splitext(file.name)[1].lower() or '.jpg'
        profile.profile_image.save(f'avatar_{request.user.id}{ext}', file, save=True)

        return Response({
            'profile_image_url': request.build_absolute_uri(profile.profile_image.url)
        })

