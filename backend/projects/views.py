import base64
import hashlib
import logging
import re
import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, generics, serializers
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Project, ProjectDocument, ProjectStatusHistory, ProjectPayment, ProjectCancellationRequest, CommissionReport, ProjectVisit
from .serializers import (
    ProjectSerializer,
    ProjectCreateSerializer,
    ProjectDocumentSerializer,
    ProjectPaymentSerializer,
    ProjectCancellationRequestSerializer,
    CommissionReportSerializer,
    AssignFieldOfficerSerializer,
    AssignClientSerializer,
    AssignAgentSerializer,
    AssignAccessorSerializer,
    AssignSeniorValuerSerializer
)
from .utils import check_user_by_email, process_client_for_project, process_agent_for_project

logger = logging.getLogger(__name__)


def _notify_project_users(users, *, category, severity, title, message, meta=None, action_url='', email_subject=None, actor=None):
    """Best-effort helper to send notifications to multiple users."""
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


def _format_payhere_amount(value):
    return f"{Decimal(value).quantize(Decimal('0.01')):.2f}"


def _normalize_payhere_secret():
    secret = str(getattr(settings, 'PAYHERE_MERCHANT_SECRET', '')).strip()
    if not secret:
        return ''

    try:
        decoded = base64.b64decode(secret, validate=True).decode('utf-8').strip()
        return decoded or secret
    except Exception:
        return secret


def _payhere_secret_hash():
    secret = _normalize_payhere_secret()
    return hashlib.md5(secret.encode('utf-8')).hexdigest().upper()


def _build_payhere_checkout_hash(order_id, amount, currency):
    payload = f"{settings.PAYHERE_MERCHANT_ID}{order_id}{amount}{currency}{_payhere_secret_hash()}"
    return hashlib.md5(payload.encode('utf-8')).hexdigest().upper()


def _build_payhere_notification_hash(order_id, amount, currency, status_code):
    payload = f"{settings.PAYHERE_MERCHANT_ID}{order_id}{amount}{currency}{status_code}{_payhere_secret_hash()}"
    return hashlib.md5(payload.encode('utf-8')).hexdigest().upper()


def _get_client_payment_contact(project):
    client = project.assigned_client
    client_info = project.client_info or {}

    first_name = (client.first_name if client else '') or client_info.get('first_name') or 'Client'
    last_name = (client.last_name if client else '') or client_info.get('last_name') or 'Customer'
    email = (client.email if client else '') or client_info.get('email') or ''
    phone = client_info.get('phone') or ''
    address = client_info.get('address') or 'Sri Lanka'
    city = client_info.get('city') or 'Colombo'
    country = client_info.get('country') or 'Sri Lanka'

    return {
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'phone': re.sub(r'\D+', '', str(phone)),
        'address': address,
        'city': city,
        'country': country,
    }


def get_user_role(user):
    """Safely get user role, returns None if role doesn't exist"""
    try:
        if hasattr(user, 'role'):
            return user.role.role
    except Exception:
        pass
    return None


class CheckUserByEmailView(APIView):
    """Check if a user exists by email - for coordinators during project creation"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can check user accounts'},
                status=status.HTTP_403_FORBIDDEN,
            )

        email = request.data.get('email', '').strip().lower()
        role_type = request.data.get('role_type', '')

        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        if role_type not in ('client', 'agent'):
            return Response(
                {'error': 'role_type must be "client" or "agent"'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = check_user_by_email(email)

        if user:
            existing_role = get_user_role(user)
            if existing_role == role_type:
                return Response({
                    'exists': True,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                        'email': user.email,
                        'role': existing_role,
                    },
                    'message': 'Account found',
                })
            else:
                return Response({
                    'exists': True,
                    'role_mismatch': True,
                    'current_role': existing_role,
                    'expected_role': role_type,
                    'message': f'User exists but has role "{existing_role}", not "{role_type}"',
                })
        else:
            return Response({
                'exists': False,
                'message': 'No account found with this email',
            })


class ProjectListView(generics.ListCreateAPIView):
    """List all projects or create a new project"""
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProjectCreateSerializer
        return ProjectSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Get user role safely
        user_role = get_user_role(user)
        
        # Coordinators see all projects they created
        if user_role == 'coordinator':
            queryset = Project.objects.filter(coordinator=user)
        
        # Field officers see only assigned projects (pending, in_progress, completed)
        elif user_role == 'field_officer':
            queryset = Project.objects.filter(assigned_field_officer=user, status__in=['pending', 'in_progress', 'completed'])

        # Clients see only assigned projects (pending, in_progress, completed)
        elif user_role == 'client':
            queryset = Project.objects.filter(assigned_client=user, status__in=['pending', 'in_progress', 'completed'])

        # Agents see only assigned projects (pending, in_progress, completed)
        elif user_role == 'agent':
            queryset = Project.objects.filter(assigned_agent=user, status__in=['pending', 'in_progress', 'completed'])

        # Accessors see only assigned projects (pending, in_progress, completed)
        elif user_role == 'accessor':
            queryset = Project.objects.filter(assigned_accessor=user, status__in=['pending', 'in_progress', 'completed'])

        # Senior valuers see only assigned projects (pending, in_progress, completed)
        elif user_role == 'senior_valuer':
            queryset = Project.objects.filter(assigned_senior_valuer=user, status__in=['pending', 'in_progress', 'completed'])

        # Admins and MD/GM see all projects
        elif user_role in ('admin', 'md_gm') or user.is_staff or user.is_superuser:
            queryset = Project.objects.all()
        else:
            queryset = Project.objects.none()

        # Optimize queryset with select_related and prefetch_related
        return queryset.select_related(
            'coordinator', 'assigned_field_officer', 'assigned_client',
            'assigned_agent', 'assigned_accessor', 'assigned_senior_valuer'
        ).prefetch_related(
            'documents', 'valuations__field_officer', 'valuations__photos', 'history', 'visits'
        )
    
    def perform_create(self, serializer):
        # Only coordinators can create projects
        user_role = get_user_role(self.request.user)
        if user_role != 'coordinator':
            raise serializers.ValidationError("Only coordinators can create projects.")

        project = serializer.save(coordinator=self.request.user)

        # Determine if this project needs admin approval (created without a submission)
        submission_id = self.request.data.get('submission_id', None)
        if not submission_id:
            project.admin_approval_status = 'not_submitted'
            project.save(update_fields=['admin_approval_status'])

        # Record project creation in history
        ProjectStatusHistory.objects.create(
            project=project,
            status=project.status,
            notes="Project created",
            created_by=self.request.user
        )

        # Process client info - check/create account and assign to project
        client_info = project.client_info
        if client_info and client_info.get('email'):
            client_user, was_created, error = process_client_for_project(
                project,
                client_info,
                invited_by=self.request.user,
            )
            if error:
                logger.warning(f"Client processing warning for project {project.id}: {error}")
            elif client_user:
                ProjectStatusHistory.objects.create(
                    project=project,
                    status=project.status,
                    notes=f"Client assigned: {client_user.first_name} {client_user.last_name}".strip() or client_user.username,
                    created_by=self.request.user
                )

        # Process agent info - check/create account and assign to project
        agent_info = project.agent_info
        if agent_info and agent_info.get('email'):
            agent_user, was_created, error = process_agent_for_project(
                project,
                agent_info,
                invited_by=self.request.user,
            )
            if error:
                logger.warning(f"Agent processing warning for project {project.id}: {error}")
            elif agent_user:
                ProjectStatusHistory.objects.create(
                    project=project,
                    status=project.status,
                    notes=f"Agent assigned: {agent_user.first_name} {agent_user.last_name}".strip() or agent_user.username,
                    created_by=self.request.user
                )

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='PROJECT_CREATED',
                user=self.request.user,
                description=f"Project created: {project.title} (ID: {project.id})",
                category='project',
                ip_address=get_client_ip(self.request),
                metadata={'project_id': project.id, 'project_title': project.title},
            )
        except Exception:
            pass

        # Send project assignment notification emails to assigned users
        try:
            from authentication.services import EmailService
            coordinator_name = f'{self.request.user.first_name} {self.request.user.last_name}'.strip() or self.request.user.username

            # Notify client
            if project.assigned_client:
                client = project.assigned_client
                client_name = f'{client.first_name} {client.last_name}'.strip() or client.username
                EmailService.send_project_assignment_notification(
                    email=client.email,
                    name=client_name,
                    project_title=project.title,
                    role_in_project='Client',
                    coordinator_name=coordinator_name,
                )

            # Notify agent
            if project.assigned_agent:
                agent = project.assigned_agent
                agent_name = f'{agent.first_name} {agent.last_name}'.strip() or agent.username
                EmailService.send_project_assignment_notification(
                    email=agent.email,
                    name=agent_name,
                    project_title=project.title,
                    role_in_project='Agent',
                    coordinator_name=coordinator_name,
                )
        except Exception:
            pass

        try:
            from notifications.services import notify
            from django.contrib.auth import get_user_model as _get_user_model
            _User = _get_user_model()
            action_url = f'/dashboard/projects/{project.id}'
            # Notify coordinator (themselves) that the project is now active
            notify(
                user=project.coordinator,
                category='project',
                severity='info',
                title='New Project Created',
                message=f'Project "{project.title}" has been created and assigned to you.',
                meta={'project_id': project.id},
                action_url=action_url,
            )
            # Notify all admins
            for admin in _User.objects.filter(role__role='admin', is_active=True):
                notify(
                    user=admin,
                    category='project',
                    severity='info',
                    title='New Project Created',
                    message=f'Project "{project.title}" was created by coordinator {project.coordinator.get_full_name() or project.coordinator.username}.',
                    meta={'project_id': project.id},
                    action_url=action_url,
                )
        except Exception:
            pass

        # If created from a client submission, update submission status and mark project_created
        submission_id = self.request.data.get('submission_id', None)
        if submission_id:
            try:
                from authentication.models import ClientFormSubmission
                from django.utils import timezone as tz
                submission = ClientFormSubmission.objects.get(
                    id=submission_id,
                    coordinator=self.request.user,
                    status__in=['assigned', 'approved']
                )
                submission.status = 'approved'
                submission.project_created = True
                submission.reviewed_at = tz.now()
                submission.save()

                try:
                    from authentication.services import EmailService
                    EmailService.send_status_update(submission, 'approved')
                except Exception:
                    pass

                try:
                    from system_logs.utils import log_action, get_client_ip
                    log_action(
                        action='SUBMISSION_STATUS_UPDATED',
                        user=self.request.user,
                        description=f'Submission from {submission.first_name} {submission.last_name} approved via project creation: {project.title}',
                        category='submission',
                        ip_address=get_client_ip(self.request),
                    )
                except Exception:
                    pass
            except ClientFormSubmission.DoesNotExist:
                logger.warning(f"Submission {submission_id} not found or not assigned to coordinator")


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a project"""
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    
    def get_queryset(self):
        user = self.request.user
        user_role = get_user_role(user)
        
        if user_role == 'coordinator':
            queryset = Project.objects.filter(coordinator=user)
        elif user_role == 'field_officer':
            queryset = Project.objects.filter(assigned_field_officer=user, status__in=['pending', 'in_progress', 'completed'])
        elif user_role == 'client':
            queryset = Project.objects.filter(assigned_client=user, status__in=['pending', 'in_progress', 'completed'])
        elif user_role == 'agent':
            queryset = Project.objects.filter(assigned_agent=user, status__in=['pending', 'in_progress', 'completed'])
        elif user_role == 'accessor':
            queryset = Project.objects.filter(assigned_accessor=user, status__in=['pending', 'in_progress', 'completed'])
        elif user_role == 'senior_valuer':
            queryset = Project.objects.filter(assigned_senior_valuer=user, status__in=['pending', 'in_progress', 'completed'])
        elif user_role in ('admin', 'md_gm') or user.is_staff or user.is_superuser:
            queryset = Project.objects.all()
        else:
            queryset = Project.objects.none()

        return queryset.select_related(
            'coordinator', 'assigned_field_officer', 'assigned_client',
            'assigned_agent', 'assigned_accessor', 'assigned_senior_valuer'
        ).prefetch_related(
            'documents', 'valuations__field_officer', 'valuations__photos', 'history', 'visits'
        )

    def perform_update(self, serializer):
        # Only coordinators can update projects
        user_role = get_user_role(self.request.user)
        if user_role != 'coordinator':
            raise serializers.ValidationError("Only coordinators can update projects.")
        
        project = serializer.instance
        new_status = serializer.validated_data.get('status', project.status)
        
        # If changing status to 'in_progress', validate that all required users are assigned
        if new_status == 'in_progress' and project.status != 'in_progress':
            # Check if field officer is assigned
            if project.assigned_field_officer is None:
                raise serializers.ValidationError(
                    "Cannot start project: Field officer must be assigned before starting."
                )
            
            # Check if client is assigned
            if project.assigned_client is None:
                raise serializers.ValidationError(
                    "Cannot start project: Client must be assigned before starting."
                )
            
            # Check if agent is assigned (if required)
            if project.has_agent and project.assigned_agent is None:
                raise serializers.ValidationError(
                    "Cannot start project: Agent must be assigned before starting."
                )

            # Check if accessor is assigned
            if project.assigned_accessor is None:
                raise serializers.ValidationError(
                    "Cannot start project: Accessor must be assigned before starting."
                )

            # Check if senior valuer is assigned
            if project.assigned_senior_valuer is None:
                raise serializers.ValidationError(
                    "Cannot start project: Senior valuer must be assigned before starting."
                )

        status_changed = new_status != project.status
        old_status = project.status
        if status_changed:
            ProjectStatusHistory.objects.create(
                project=project,
                status=new_status,
                notes=f"Status changed from {project.get_status_display()} to {dict(Project.STATUS_CHOICES).get(new_status)}",
                created_by=self.request.user
            )

        serializer.save()

        try:
            from system_logs.utils import log_action, get_client_ip
            description = f"Project updated: {project.title} (ID: {project.id})"
            if status_changed:
                description = f"Project status changed to {dict(Project.STATUS_CHOICES).get(new_status, new_status)}: {project.title}"
            log_action(
                action='PROJECT_UPDATED',
                user=self.request.user,
                description=description,
                category='project',
                ip_address=get_client_ip(self.request),
                metadata={'project_id': project.id, 'project_title': project.title, 'new_status': new_status},
            )
        except Exception:
            pass

        # Feature #3 (C1): fan-out notifications to stakeholders on status change.
        if status_changed:
            try:
                from notifications.services import notify
                old_label = dict(Project.STATUS_CHOICES).get(old_status, old_status)
                new_label = dict(Project.STATUS_CHOICES).get(new_status, new_status)
                title = f'Project status: {project.title}'
                msg = f'Status changed from {old_label} to {new_label}.'
                meta = {
                    'project_id': project.id,
                    'old_status': old_status,
                    'new_status': new_status,
                }
                recipients = {
                    project.coordinator,
                    project.assigned_field_officer,
                    project.assigned_client,
                    project.assigned_agent,
                    project.assigned_accessor,
                    project.assigned_senior_valuer,
                }
                recipients.discard(self.request.user)
                recipients.discard(None)
                severity = 'success' if new_status == 'completed' else 'info'
                for u in recipients:
                    notify(
                        user=u, category='project', severity=severity,
                        title=title, message=msg, meta=meta,
                        action_url=f'/dashboard/projects/{project.id}',
                        email_subject=title,
                    )
            except Exception:
                pass


class AssignFieldOfficerView(APIView):
    """Assign a field officer to a project"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, project_id):
        # Check if user is coordinator
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can assign field officers to projects'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response({
                'error': 'Project not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = AssignFieldOfficerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        field_officer_id = serializer.validated_data['field_officer_id']
        field_officer = User.objects.get(id=field_officer_id)
        
        project.assigned_field_officer = field_officer
        project.save()
        
        ProjectStatusHistory.objects.create(
            project=project,
            status=project.status,
            notes=f"Field Officer assigned: {field_officer.first_name} {field_officer.last_name}".strip() or field_officer.username,
            created_by=request.user
        )

        try:
            from system_logs.utils import log_action, get_client_ip
            fo_name = f"{field_officer.first_name} {field_officer.last_name}".strip() or field_officer.username
            log_action(
                action='FIELD_OFFICER_ASSIGNED',
                user=request.user,
                target_user=field_officer,
                description=f"Field officer {fo_name} assigned to project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'field_officer_id': field_officer.id},
            )
        except Exception:
            pass

        try:
            from notifications.services import notify
            notify(
                user=field_officer,
                category='project',
                severity='info',
                title='You Have Been Assigned to a Project',
                message=f'You have been assigned as Field Officer for project "{project.title}". Please review the project details.',
                meta={'project_id': project.id},
                action_url=f'/dashboard/projects/{project.id}',
            )
        except Exception:
            pass

        return Response({
            'message': 'Field officer assigned successfully',
            'project': ProjectSerializer(project, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class AvailableFieldOfficersView(APIView):
    """Get list of available field officers for assignment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Only coordinators can view field officers
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can view field officers'
            }, status=status.HTTP_403_FORBIDDEN)
        
        field_officers = User.objects.filter(
            role__role='field_officer',
            is_active=True
        ).select_related('role')
        
        officers_data = []
        for officer in field_officers:
            assigned_projects_count = Project.objects.filter(
                assigned_field_officer=officer,
                status__in=['pending', 'in_progress']
            ).count()
            
            officers_data.append({
                'id': officer.id,
                'username': officer.username,
                'email': officer.email,
                'first_name': officer.first_name,
                'last_name': officer.last_name,
                'full_name': f"{officer.first_name} {officer.last_name}".strip() or officer.username,
                'assigned_projects_count': assigned_projects_count,
            })
        
        return Response({
            'field_officers': officers_data
        }, status=status.HTTP_200_OK)


class AvailableClientsView(APIView):
    """Get list of available clients for assignment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Only coordinators can view clients
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can view clients'
            }, status=status.HTTP_403_FORBIDDEN)
        
        clients = User.objects.filter(
            role__role='client',
            is_active=True
        ).select_related('role')
        
        clients_data = []
        for client in clients:
            assigned_projects_count = Project.objects.filter(
                assigned_client=client
            ).count()
            
            clients_data.append({
                'id': client.id,
                'username': client.username,
                'email': client.email,
                'first_name': client.first_name,
                'last_name': client.last_name,
                'full_name': f"{client.first_name} {client.last_name}".strip() or client.username,
                'assigned_projects_count': assigned_projects_count,
            })
        
        return Response({
            'clients': clients_data
        }, status=status.HTTP_200_OK)


class AvailableAgentsView(APIView):
    """Get list of available agents for assignment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Only coordinators can view agents
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can view agents'
            }, status=status.HTTP_403_FORBIDDEN)
        
        agents = User.objects.filter(
            role__role='agent',
            is_active=True
        ).select_related('role')
        
        agents_data = []
        for agent in agents:
            assigned_projects_count = Project.objects.filter(
                assigned_agent=agent
            ).count()
            
            agents_data.append({
                'id': agent.id,
                'username': agent.username,
                'email': agent.email,
                'first_name': agent.first_name,
                'last_name': agent.last_name,
                'full_name': f"{agent.first_name} {agent.last_name}".strip() or agent.username,
                'assigned_projects_count': assigned_projects_count,
            })
        
        return Response({
            'agents': agents_data
        }, status=status.HTTP_200_OK)


class AssignClientView(APIView):
    """Assign a client to a project"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, project_id):
        # Check if user is coordinator
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can assign clients to projects'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response({
                'error': 'Project not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = AssignClientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        client_id = serializer.validated_data['client_id']
        client = User.objects.get(id=client_id)
        
        project.assigned_client = client
        project.save()
        
        ProjectStatusHistory.objects.create(
            project=project,
            status=project.status,
            notes=f"Client assigned: {client.first_name} {client.last_name}".strip() or client.username,
            created_by=request.user
        )

        try:
            from system_logs.utils import log_action, get_client_ip
            client_name = f"{client.first_name} {client.last_name}".strip() or client.username
            log_action(
                action='CLIENT_ASSIGNED',
                user=request.user,
                target_user=client,
                description=f"Client {client_name} assigned to project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'client_id': client.id},
            )
        except Exception:
            pass
        _notify_project_users(
            [client],
            category='project',
            severity='info',
            title=f'Project assignment — {project.title}',
            message='You have been assigned as client for this project.',
            meta={'project_id': project.id, 'role': 'client'},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'message': 'Client assigned successfully',
            'project': ProjectSerializer(project, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class AssignAgentView(APIView):
    """Assign an agent to a project"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, project_id):
        # Check if user is coordinator
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can assign agents to projects'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response({
                'error': 'Project not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = AssignAgentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        agent_id = serializer.validated_data['agent_id']
        agent = User.objects.get(id=agent_id)
        
        project.assigned_agent = agent
        project.save()
        
        ProjectStatusHistory.objects.create(
            project=project,
            status=project.status,
            notes=f"Agent assigned: {agent.first_name} {agent.last_name}".strip() or agent.username,
            created_by=request.user
        )

        try:
            from system_logs.utils import log_action, get_client_ip
            agent_name = f"{agent.first_name} {agent.last_name}".strip() or agent.username
            log_action(
                action='AGENT_ASSIGNED',
                user=request.user,
                target_user=agent,
                description=f"Agent {agent_name} assigned to project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'agent_id': agent.id},
            )
        except Exception:
            pass
        _notify_project_users(
            [agent],
            category='project',
            severity='info',
            title=f'Project assignment — {project.title}',
            message='You have been assigned as agent for this project.',
            meta={'project_id': project.id, 'role': 'agent'},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'message': 'Agent assigned successfully',
            'project': ProjectSerializer(project, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class AssignAccessorView(APIView):
    """Assign an accessor to a project"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, project_id):
        # Check if user is coordinator
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can assign accessors to projects'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response({
                'error': 'Project not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = AssignAccessorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        accessor_id = serializer.validated_data['accessor_id']
        accessor = User.objects.get(id=accessor_id)
        
        project.assigned_accessor = accessor
        project.save()
        
        ProjectStatusHistory.objects.create(
            project=project,
            status=project.status,
            notes=f"Accessor assigned: {accessor.first_name} {accessor.last_name}".strip() or accessor.username,
            created_by=request.user
        )

        try:
            from system_logs.utils import log_action, get_client_ip
            accessor_name = f"{accessor.first_name} {accessor.last_name}".strip() or accessor.username
            log_action(
                action='ACCESSOR_ASSIGNED',
                user=request.user,
                target_user=accessor,
                description=f"Accessor {accessor_name} assigned to project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'accessor_id': accessor.id},
            )
        except Exception:
            pass
        _notify_project_users(
            [accessor],
            category='project',
            severity='info',
            title=f'Project assignment — {project.title}',
            message='You have been assigned as accessor for this project.',
            meta={'project_id': project.id, 'role': 'accessor'},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'message': 'Accessor assigned successfully',
            'project': ProjectSerializer(project, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class AssignSeniorValuerView(APIView):
    """Assign a senior valuer to a project"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, project_id):
        # Check if user is coordinator
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can assign senior valuers to projects'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response({
                'error': 'Project not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        serializer = AssignSeniorValuerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        senior_valuer_id = serializer.validated_data['senior_valuer_id']
        senior_valuer = User.objects.get(id=senior_valuer_id)
        
        project.assigned_senior_valuer = senior_valuer
        project.save()
        
        ProjectStatusHistory.objects.create(
            project=project,
            status=project.status,
            notes=f"Senior Valuer assigned: {senior_valuer.first_name} {senior_valuer.last_name}".strip() or senior_valuer.username,
            created_by=request.user
        )

        try:
            from system_logs.utils import log_action, get_client_ip
            sv_name = f"{senior_valuer.first_name} {senior_valuer.last_name}".strip() or senior_valuer.username
            log_action(
                action='SENIOR_VALUER_ASSIGNED',
                user=request.user,
                target_user=senior_valuer,
                description=f"Senior valuer {sv_name} assigned to project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'senior_valuer_id': senior_valuer.id},
            )
        except Exception:
            pass
        _notify_project_users(
            [senior_valuer],
            category='project',
            severity='info',
            title=f'Project assignment — {project.title}',
            message='You have been assigned as senior valuer for this project.',
            meta={'project_id': project.id, 'role': 'senior_valuer'},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'message': 'Senior valuer assigned successfully',
            'project': ProjectSerializer(project, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class AvailableAccessorsView(APIView):
    """Get list of available accessors for assignment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Only coordinators can view accessors
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can view accessors'
            }, status=status.HTTP_403_FORBIDDEN)
        
        accessors = User.objects.filter(
            role__role='accessor',
            is_active=True
        ).select_related('role')
        
        accessors_data = []
        for accessor in accessors:
            assigned_projects_count = Project.objects.filter(
                assigned_accessor=accessor
            ).count()
            
            accessors_data.append({
                'id': accessor.id,
                'username': accessor.username,
                'email': accessor.email,
                'first_name': accessor.first_name,
                'last_name': accessor.last_name,
                'full_name': f"{accessor.first_name} {accessor.last_name}".strip() or accessor.username,
                'assigned_projects_count': assigned_projects_count,
            })
        
        return Response({
            'accessors': accessors_data
        }, status=status.HTTP_200_OK)


class AvailableSeniorValuersView(APIView):
    """Get list of available senior valuers for assignment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Only coordinators can view senior valuers
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can view senior valuers'
            }, status=status.HTTP_403_FORBIDDEN)
        
        senior_valuers = User.objects.filter(
            role__role='senior_valuer',
            is_active=True
        ).select_related('role')
        
        senior_valuers_data = []
        for valuer in senior_valuers:
            assigned_projects_count = Project.objects.filter(
                assigned_senior_valuer=valuer
            ).count()
            
            senior_valuers_data.append({
                'id': valuer.id,
                'username': valuer.username,
                'email': valuer.email,
                'first_name': valuer.first_name,
                'last_name': valuer.last_name,
                'full_name': f"{valuer.first_name} {valuer.last_name}".strip() or valuer.username,
                'assigned_projects_count': assigned_projects_count,
            })
        
        return Response({
            'senior_valuers': senior_valuers_data
        }, status=status.HTTP_200_OK)


class ProjectDocumentView(generics.CreateAPIView):
    """Upload document to a project"""
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectDocumentSerializer
    
    def perform_create(self, serializer):
        project_id = self.request.data.get('project')
        assigned_to_id = self.request.data.get('assigned_to')
        
        # Check if user is coordinator of the project
        try:
            project = Project.objects.get(id=project_id)
            if project.coordinator != self.request.user:
                if not (hasattr(self.request.user, 'role') and 
                       self.request.user.role.role == 'field_officer' and
                       project.assigned_field_officer == self.request.user):
                    raise serializers.ValidationError("You don't have permission to add documents to this project.")
        except Project.DoesNotExist:
            raise serializers.ValidationError("Project not found.")
        
        # Validate assigned_to user if provided
        assigned_to = None
        if assigned_to_id:
            try:
                assigned_to = User.objects.get(id=assigned_to_id)
                # Verify the user is actually assigned to this project
                if (assigned_to != project.assigned_field_officer and
                    assigned_to != project.assigned_client and
                    assigned_to != project.assigned_agent and
                    assigned_to != project.assigned_accessor and
                    assigned_to != project.assigned_senior_valuer):
                    raise serializers.ValidationError("Selected user is not assigned to this project.")
            except User.DoesNotExist:
                raise serializers.ValidationError("Assigned user not found.")
        
        doc = serializer.save(
            project=project,
            uploaded_by=self.request.user,
            assigned_to=assigned_to,
        )

        # Feature #11: set visible_to M2M (accept both 'visible_to' and 'visible_to_ids')
        visible_to_ids = self.request.data.getlist('visible_to_ids', []) or self.request.data.getlist('visible_to', [])
        if visible_to_ids:
            valid_users = User.objects.filter(id__in=visible_to_ids)
            doc.visible_to.set(valid_users)

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='DOCUMENT_UPLOADED',
                user=self.request.user,
                description=f"Document uploaded to project: {project.title} (ID: {project.id})",
                category='project',
                ip_address=get_client_ip(self.request),
                metadata={'project_id': project.id, 'project_title': project.title},
            )
        except Exception:
            pass
        _notify_project_users(
            [
                project.coordinator,
                project.assigned_field_officer,
                project.assigned_client,
                project.assigned_agent,
                project.assigned_accessor,
                project.assigned_senior_valuer,
            ],
            category='project',
            severity='success',
            title=f'New document uploaded — {project.title}',
            message=f'"{doc.name}" was uploaded to the project documents.',
            meta={'project_id': project.id, 'document_id': doc.id},
            action_url=f'/dashboard/projects/{project.id}',
            actor=self.request.user,
        )

        # Feature #3 (C1): notify recipients of a new document.
        try:
            from notifications.services import notify
            doc_title = getattr(doc, 'name', None) or 'Document'
            title = f'New document on {project.title}'
            msg = f'"{doc_title}" was uploaded by {self.request.user.get_full_name() or self.request.user.username}.'
            meta = {'project_id': project.id, 'document_id': doc.id}
            if visible_to_ids:
                recipients = list(User.objects.filter(id__in=visible_to_ids))
            else:
                recipients = [u for u in [
                    project.coordinator,
                    project.assigned_field_officer,
                    project.assigned_accessor,
                    project.assigned_senior_valuer,
                ] if u is not None]
            seen = set()
            for u in recipients:
                if u is None or u.id in seen or u == self.request.user:
                    continue
                seen.add(u.id)
                notify(
                    user=u, category='document', severity='info',
                    title=title, message=msg, meta=meta,
                    action_url=f'/dashboard/projects/{project.id}',
                    email_subject=title,
                )
        except Exception:
            pass


class ProjectDocumentDeleteView(generics.DestroyAPIView):
    """Delete a project document"""
    permission_classes = [IsAuthenticated]
    queryset = ProjectDocument.objects.all()

    def get_queryset(self):
        user = self.request.user
        user_role = get_user_role(user)
        # Coordinators can delete documents from their projects
        # Field officers can delete documents from assigned projects
        if user_role == 'coordinator':
            return ProjectDocument.objects.filter(project__coordinator=user)
        elif user_role == 'field_officer':
            return ProjectDocument.objects.filter(project__assigned_field_officer=user)
        return ProjectDocument.objects.none()

    def perform_destroy(self, instance):
        project = instance.project
        doc_name = getattr(instance, 'name', None) or str(instance.id)
        instance.delete()

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='DOCUMENT_DELETED',
                user=self.request.user,
                description=f"Document deleted from project: {project.title} (ID: {project.id})",
                category='project',
                ip_address=get_client_ip(self.request),
                metadata={'project_id': project.id, 'document': doc_name},
            )
        except Exception:
            pass
        _notify_project_users(
            [
                project.coordinator,
                project.assigned_field_officer,
                project.assigned_client,
                project.assigned_agent,
                project.assigned_accessor,
                project.assigned_senior_valuer,
            ],
            category='project',
            severity='success',
            title=f'Document deleted — {project.title}',
            message=f'"{doc_name}" was removed from project documents.',
            meta={'project_id': project.id, 'document': doc_name},
            action_url=f'/dashboard/projects/{project.id}',
            actor=self.request.user,
        )

        # Feature #3 (C1): tell the coordinator when someone else deletes a document.
        try:
            from notifications.services import notify
            if project.coordinator and project.coordinator != self.request.user:
                notify(
                    user=project.coordinator, category='document', severity='warning',
                    title=f'Document removed from {project.title}',
                    message=f'"{doc_name}" was deleted by {self.request.user.get_full_name() or self.request.user.username}.',
                    meta={'project_id': project.id, 'document': doc_name},
                    action_url=f'/dashboard/projects/{project.id}',
                )
        except Exception:
            pass


from rest_framework.decorators import api_view, permission_classes as perm_classes
from django.utils import timezone


@api_view(['POST'])
@perm_classes([IsAuthenticated])
def md_gm_approve_project(request, pk):
    """MD/GM approves a project"""
    user_role = get_user_role(request.user)
    if user_role not in ('md_gm', 'admin') and not request.user.is_staff:
        return Response(
            {'error': 'Only MD/GM can approve projects'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    project.md_gm_approval_status = 'approved'
    project.md_gm_approved_at = timezone.now()
    project.md_gm_rejection_reason = None
    project.save()

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='PROJECT_APPROVED',
            user=request.user,
            description=f"Project approved by MD/GM: {project.title} (ID: {project.id})",
            category='project',
            ip_address=get_client_ip(request),
            metadata={'project_id': project.id, 'project_title': project.title},
        )
    except Exception:
        pass
    _notify_project_users(
        [
            project.coordinator,
            project.assigned_field_officer,
            project.assigned_client,
            project.assigned_agent,
            project.assigned_accessor,
            project.assigned_senior_valuer,
        ],
        category='project',
        severity='success',
        title=f'Project approved — {project.title}',
        message='MD/GM approved this project.',
        meta={'project_id': project.id, 'approval_status': 'approved'},
        action_url=f'/dashboard/projects/{project.id}',
        actor=request.user,
    )

    return Response({
        'message': 'Project approved successfully',
        'project': ProjectSerializer(project, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@perm_classes([IsAuthenticated])
def md_gm_reject_project(request, pk):
    """MD/GM rejects a project"""
    user_role = get_user_role(request.user)
    if user_role not in ('md_gm', 'admin') and not request.user.is_staff:
        return Response(
            {'error': 'Only MD/GM can reject projects'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    reason = request.data.get('reason', '')
    project.md_gm_approval_status = 'rejected'
    project.md_gm_rejected_at = timezone.now()
    project.md_gm_rejection_reason = reason
    project.save()

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='PROJECT_REJECTED',
            user=request.user,
            description=f"Project rejected by MD/GM: {project.title} (ID: {project.id}). Reason: {reason or 'No reason provided'}",
            category='project',
            ip_address=get_client_ip(request),
            metadata={'project_id': project.id, 'project_title': project.title, 'reason': reason},
        )
    except Exception:
        pass
    _notify_project_users(
        [
            project.coordinator,
            project.assigned_field_officer,
            project.assigned_client,
            project.assigned_agent,
            project.assigned_accessor,
            project.assigned_senior_valuer,
        ],
        category='project',
        severity='warning',
        title=f'Project rejected — {project.title}',
        message=f'MD/GM rejected this project. Reason: {reason or "No reason provided"}',
        meta={'project_id': project.id, 'approval_status': 'rejected', 'reason': reason},
        action_url=f'/dashboard/projects/{project.id}',
        actor=request.user,
    )

    return Response({
        'message': 'Project rejected',
        'project': ProjectSerializer(project, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@perm_classes([IsAuthenticated])
def admin_approve_project(request, pk):
    """Admin approves a direct project (created without a submission)"""
    user_role = get_user_role(request.user)
    if user_role != 'admin' and not request.user.is_staff:
        return Response(
            {'error': 'Only admins can approve direct projects'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if project.admin_approval_status != 'pending':
        return Response(
            {'error': f'Project admin approval is not pending (current: {project.admin_approval_status})'},
            status=status.HTTP_400_BAD_REQUEST
        )

    project.admin_approval_status = 'approved'
    project.admin_approved_at = timezone.now()
    project.admin_approved_by = request.user
    project.admin_rejection_reason = None
    project.save()

    ProjectStatusHistory.objects.create(
        project=project,
        status=project.status,
        notes="Admin approved direct project",
        created_by=request.user
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='DIRECT_PROJECT_APPROVED',
            user=request.user,
            description=f"Direct project approved by admin: {project.title} (ID: {project.id})",
            category='project',
            ip_address=get_client_ip(request),
            metadata={'project_id': project.id, 'project_title': project.title},
        )
    except Exception:
        pass
    _notify_project_users(
        [project.coordinator],
        category='project',
        severity='success',
        title=f'Direct project approved — {project.title}',
        message='Admin approved your project for progression.',
        meta={'project_id': project.id, 'admin_approval_status': 'approved'},
        action_url=f'/dashboard/projects/{project.id}',
        actor=request.user,
    )

    return Response({
        'message': 'Project approved successfully',
        'project': ProjectSerializer(project, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@perm_classes([IsAuthenticated])
def admin_reject_project(request, pk):
    """Admin rejects a direct project (created without a submission)"""
    user_role = get_user_role(request.user)
    if user_role != 'admin' and not request.user.is_staff:
        return Response(
            {'error': 'Only admins can reject direct projects'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        project = Project.objects.get(pk=pk)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if project.admin_approval_status != 'pending':
        return Response(
            {'error': f'Project admin approval is not pending (current: {project.admin_approval_status})'},
            status=status.HTTP_400_BAD_REQUEST
        )

    reason = request.data.get('reason', '')
    if not reason.strip():
        return Response(
            {'error': 'Rejection reason is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    project.admin_approval_status = 'rejected'
    project.admin_rejected_at = timezone.now()
    project.admin_approved_by = request.user
    project.admin_rejection_reason = reason
    project.save()

    ProjectStatusHistory.objects.create(
        project=project,
        status=project.status,
        notes=f"Admin rejected direct project. Reason: {reason}",
        created_by=request.user
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='DIRECT_PROJECT_REJECTED',
            user=request.user,
            description=f"Direct project rejected by admin: {project.title} (ID: {project.id}). Reason: {reason}",
            category='project',
            ip_address=get_client_ip(request),
            metadata={'project_id': project.id, 'project_title': project.title, 'reason': reason},
        )
    except Exception:
        pass
    _notify_project_users(
        [project.coordinator],
        category='project',
        severity='warning',
        title=f'Direct project rejected — {project.title}',
        message=f'Admin rejected this project. Reason: {reason}',
        meta={'project_id': project.id, 'admin_approval_status': 'rejected', 'reason': reason},
        action_url=f'/dashboard/projects/{project.id}',
        actor=request.user,
    )

    return Response({
        'message': 'Project rejected',
        'project': ProjectSerializer(project, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@perm_classes([IsAuthenticated])
def request_admin_approval(request, pk):
    """Coordinator requests admin approval for a direct project"""
    user_role = get_user_role(request.user)
    if user_role != 'coordinator':
        return Response(
            {'error': 'Only coordinators can request admin approval'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        project = Project.objects.get(pk=pk, coordinator=request.user)
    except Project.DoesNotExist:
        return Response(
            {'error': 'Project not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if project.admin_approval_status not in ('not_submitted', 'rejected'):
        return Response(
            {'error': f'Cannot request approval (current status: {project.admin_approval_status})'},
            status=status.HTTP_400_BAD_REQUEST
        )

    project.admin_approval_status = 'pending'
    project.admin_rejection_reason = None
    project.admin_rejected_at = None
    project.save(update_fields=['admin_approval_status', 'admin_rejection_reason', 'admin_rejected_at'])

    ProjectStatusHistory.objects.create(
        project=project,
        status=project.status,
        notes="Coordinator requested admin approval for direct project",
        created_by=request.user
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='ADMIN_APPROVAL_REQUESTED',
            user=request.user,
            description=f"Admin approval requested for project: {project.title} (ID: {project.id})",
            category='project',
            ip_address=get_client_ip(request),
            metadata={'project_id': project.id, 'project_title': project.title},
        )
    except Exception:
        pass
    try:
        admins = User.objects.filter(role__role='admin', is_active=True)
        _notify_project_users(
            list(admins),
            category='project',
            severity='info',
            title=f'Admin approval requested — {project.title}',
            message=f'{request.user.get_full_name() or request.user.username} requested admin approval for a direct project.',
            meta={'project_id': project.id, 'admin_approval_status': 'pending'},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )
    except Exception:
        pass

    return Response({
        'message': 'Admin approval request submitted successfully',
        'project': ProjectSerializer(project, context={'request': request}).data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@perm_classes([IsAuthenticated])
def admin_pending_projects(request):
    """Get projects requiring admin approval, with optional status filter"""
    user_role = get_user_role(request.user)
    if user_role != 'admin' and not request.user.is_staff:
        return Response(
            {'error': 'Only admins can view this'},
            status=status.HTTP_403_FORBIDDEN
        )

    status_filter = request.query_params.get('status', 'all')

    if status_filter in ('pending', 'approved', 'rejected'):
        queryset = Project.objects.filter(admin_approval_status=status_filter)
    else:
        queryset = Project.objects.exclude(admin_approval_status__in=['not_required', 'not_submitted'])

    queryset = queryset.select_related(
        'coordinator', 'admin_approved_by'
    ).order_by('-created_at')

    serializer = ProjectSerializer(queryset, many=True, context={'request': request})
    return Response({
        'projects': serializer.data,
        'summary': {
            'total': Project.objects.exclude(admin_approval_status__in=['not_required', 'not_submitted']).count(),
            'pending': Project.objects.filter(admin_approval_status='pending').count(),
            'approved': Project.objects.filter(admin_approval_status='approved').count(),
            'rejected': Project.objects.filter(admin_approval_status='rejected').count(),
        },
    }, status=status.HTTP_200_OK)


class UserAssignedProjectsView(APIView):
    """Get projects assigned to a specific user"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id, role_type):
        # Check if user is coordinator
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response({
                'error': 'Only coordinators can view user assigned projects'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get projects based on role type
        if role_type == 'field_officer':
            projects = Project.objects.filter(assigned_field_officer=user).order_by('-created_at')
        elif role_type == 'accessor':
            projects = Project.objects.filter(assigned_accessor=user).order_by('-created_at')
        elif role_type == 'senior_valuer':
            projects = Project.objects.filter(assigned_senior_valuer=user).order_by('-created_at')
        else:
            return Response({
                'error': 'Invalid role type'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        projects_data = []
        for project in projects:
            # Get the assignment date (use created_at as proxy, or we could add an assigned_at field)
            projects_data.append({
                'id': project.id,
                'title': project.title,
                'status': project.status,
                'status_display': project.get_status_display(),
                'assigned_date': project.created_at.isoformat(),  # Using created_at as assigned date
            })
        
        return Response({
            'projects': projects_data,
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            }
        }, status=status.HTTP_200_OK)


# =============================================================================
# PAYMENT WORKFLOW VIEWS
# =============================================================================

class SendPaymentRequestView(APIView):
    """Coordinator sends payment request to client for a project"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can send payment requests'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Ensure client is assigned. If missing, try recovering from saved client_info.
        if not project.assigned_client:
            client_info = project.client_info or {}
            if client_info.get('email'):
                client_user, _, client_error = process_client_for_project(project, client_info)
                if client_error or not client_user:
                    return Response(
                        {'error': client_error or 'No client assigned to this project'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                project.refresh_from_db(fields=['assigned_client'])

        if not project.assigned_client:
            return Response(
                {'error': 'No client assigned to this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create payment record
        payment, created = ProjectPayment.objects.get_or_create(
            project=project,
            defaults={
                'estimated_value': project.estimated_value,
                'payment_status': 'pending'
            }
        )

        # Idempotent behavior: if already requested, return success payload.
        if payment.payment_status == 'requested':
            return Response({
                'success': True,
                'message': 'Payment request already sent to client',
                'payment': ProjectPaymentSerializer(payment, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        # Check if payment request can be sent
        if payment.payment_status not in ['pending', 'rejected']:
            return Response(
                {'error': f'Payment request already sent (current status: {payment.payment_status})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get payment instructions from request
        payment_instructions = request.data.get('payment_instructions', '')
        if not payment_instructions:
            payment_instructions = f"""Please make the payment of Rs. {project.estimated_value:,.2f} for your project "{project.title}".

Bank Details:
Bank Name: [Your Bank Name]
Account Name: Auditra Valuations
Account Number: [Account Number]
Branch: [Branch Name]

Please upload the bank slip after making the payment."""

        # Update payment record
        payment.payment_status = 'requested'
        payment.payment_requested_at = timezone.now()
        payment.payment_requested_by = request.user
        payment.payment_instructions = payment_instructions
        payment.coordinator_notes = request.data.get('coordinator_notes', '')
        payment.save()

        # Send email to client
        try:
            from authentication.services import EmailService
            EmailService.send_payment_request_to_client(
                project=project,
                client=project.assigned_client,
                estimated_value=project.estimated_value,
                payment_instructions=payment_instructions
            )
        except Exception as e:
            logger.warning(f"Failed to send payment request email: {str(e)}")

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='PAYMENT_REQUEST_SENT',
                user=request.user,
                target_user=project.assigned_client,
                description=f"Payment request sent for project: {project.title}. Amount: Rs. {project.estimated_value:,.2f}",
                category='payment',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'amount': str(project.estimated_value)},
            )
        except Exception:
            pass
        _notify_project_users(
            [project.assigned_client],
            category='payment',
            severity='info',
            title=f'Payment requested — {project.title}',
            message=f'A payment request was sent for Rs. {project.estimated_value:,.2f}.',
            meta={'project_id': project.id, 'payment_id': payment.id, 'status': payment.payment_status},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Payment request sent to client successfully',
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class UploadBankSlipView(APIView):
    """Client uploads bank slip for project payment"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'client':
            return Response(
                {'error': 'Only clients can upload bank slips'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.get(id=project_id, assigned_client=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found or not assigned to you'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if payment record exists
        try:
            payment = project.payment
        except ProjectPayment.DoesNotExist:
            return Response(
                {'error': 'No payment request found for this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if payment request was sent
        if payment.payment_status not in ['requested', 'rejected']:
            return Response(
                {'error': f'Cannot upload bank slip at this time (status: {payment.payment_status})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the uploaded file
        bank_slip = request.FILES.get('bank_slip')
        if not bank_slip:
            return Response(
                {'error': 'Bank slip file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update payment record
        payment.bank_slip = bank_slip
        payment.bank_slip_uploaded_at = timezone.now()
        payment.bank_slip_uploaded_by = request.user
        payment.payment_status = 'submitted'
        payment.client_notes = request.data.get('client_notes', '')
        payment.save()

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='BANK_SLIP_UPLOADED',
                user=request.user,
                description=f"Bank slip uploaded for project: {project.title}",
                category='payment',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id},
            )
        except Exception:
            pass

        # Feature #3 (C1): notify coordinator that a bank slip is awaiting review.
        try:
            from notifications.services import notify
            if project.coordinator:
                notify(
                    user=project.coordinator, category='payment', severity='info',
                    title=f'Bank slip submitted — {project.title}',
                    message=f'{request.user.get_full_name() or request.user.username} uploaded a bank slip. Review required.',
                    meta={'project_id': project.id, 'payment_id': payment.id},
                    action_url=f'/dashboard/projects/{project.id}',
                    email_subject=f'Bank slip awaiting review — {project.title}',
                )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Bank slip uploaded successfully. Awaiting coordinator review.',
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ApprovePaymentView(APIView):
    """Coordinator approves payment after reviewing bank slip"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can approve payments'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get or create payment record
        try:
            payment = project.payment
        except ProjectPayment.DoesNotExist:
            payment = ProjectPayment.objects.create(
                project=project,
                estimated_value=project.estimated_value or 0,
                payment_status='pending'
            )

        # Allow approval from pending, requested, or submitted status
        if payment.payment_status == 'approved':
            return Response(
                {'error': 'Payment is already approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Approve payment
        payment.payment_status = 'approved'
        payment.payment_approved_at = timezone.now()
        payment.payment_approved_by = request.user
        payment.project.payment_completed = True
        payment.project.save(update_fields=['payment_completed', 'updated_at'])
        payment.coordinator_notes = request.data.get('coordinator_notes', payment.coordinator_notes)
        payment.save(update_fields=[
            'payment_status', 'payment_approved_at', 'payment_approved_by',
            'coordinator_notes', 'updated_at'
        ])

        # Send email to client
        try:
            from authentication.services import EmailService
            EmailService.send_payment_approved_to_client(
                project=project,
                client=project.assigned_client
            )
        except Exception as e:
            logger.warning(f"Failed to send payment approval email: {str(e)}")

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='PAYMENT_APPROVED',
                user=request.user,
                target_user=project.assigned_client,
                description=f"Payment approved for project: {project.title}",
                category='payment',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id},
            )
        except Exception:
            pass

        # Feature #3 (C1): notify client that payment was approved.
        try:
            from notifications.services import notify
            if project.assigned_client:
                notify(
                    user=project.assigned_client, category='payment', severity='success',
                    title=f'Payment approved — {project.title}',
                    message='Your payment has been approved. The project will now proceed.',
                    meta={'project_id': project.id, 'payment_id': payment.id},
                    action_url=f'/dashboard/projects/{project.id}',
                    email_subject=f'Payment approved — {project.title}',
                )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Payment approved successfully. You can now start the project.',
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class RejectPaymentView(APIView):
    """Coordinator rejects payment with reason"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can reject payments'},
                status=status.HTTP_403_FORBIDDEN
            )

        rejection_reason = request.data.get('rejection_reason', '').strip()
        if not rejection_reason:
            return Response(
                {'error': 'Rejection reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if payment record exists
        try:
            payment = project.payment
        except ProjectPayment.DoesNotExist:
            return Response(
                {'error': 'No payment record found for this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if bank slip is submitted
        if payment.payment_status != 'submitted':
            return Response(
                {'error': f'Cannot reject payment (current status: {payment.payment_status})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reject payment
        payment.payment_status = 'rejected'
        payment.payment_rejection_reason = rejection_reason
        payment.payment_rejection_count += 1
        payment.last_rejected_at = timezone.now()
        payment.coordinator_notes = request.data.get('coordinator_notes', payment.coordinator_notes)
        payment.save()

        # Send email to client
        try:
            from authentication.services import EmailService
            EmailService.send_payment_rejected_to_client(
                project=project,
                client=project.assigned_client,
                rejection_reason=rejection_reason
            )
        except Exception as e:
            logger.warning(f"Failed to send payment rejection email: {str(e)}")

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='PAYMENT_REJECTED',
                user=request.user,
                target_user=project.assigned_client,
                description=f"Payment rejected for project: {project.title}. Reason: {rejection_reason}",
                category='payment',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'reason': rejection_reason},
            )
        except Exception:
            pass

        # Feature #3 (C1): notify client that payment was rejected.
        try:
            from notifications.services import notify
            if project.assigned_client:
                notify(
                    user=project.assigned_client, category='payment', severity='warning',
                    title=f'Payment rejected — {project.title}',
                    message=f'Your bank slip was rejected. Reason: {rejection_reason}',
                    meta={'project_id': project.id, 'payment_id': payment.id, 'reason': rejection_reason},
                    action_url=f'/dashboard/projects/{project.id}',
                    email_subject=f'Payment rejected — {project.title}',
                )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Payment rejected. Client has been notified to re-upload the bank slip.',
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class InitiatePayHerePaymentView(APIView):
    """Create a PayHere checkout payload for a client project payment"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'client':
            return Response(
                {'error': 'Only clients can initiate gateway payments'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.select_related('assigned_client').get(
                id=project_id,
                assigned_client=request.user
            )
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found or not assigned to you'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            payment = project.payment
        except ProjectPayment.DoesNotExist:
            return Response(
                {'error': 'No payment request found for this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if payment.payment_status not in ['requested', 'rejected']:
            return Response(
                {'error': f'Gateway payment is only available after a payment request (current status: {payment.payment_status})'},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount = Decimal(payment.estimated_value or project.estimated_value or 0).quantize(Decimal('0.01'))
        if amount <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if getattr(settings, 'PAYHERE_DUMMY_MODE', False):
            order_id = f'DUMMY{project.id}{uuid.uuid4().hex[:10].upper()}'
            amount_str = _format_payhere_amount(amount)
            now_iso = timezone.now().isoformat()

            payment.payment_method = 'payhere'
            payment.gateway_order_id = order_id
            payment.gateway_status = 'dummy_paid'
            payment.gateway_payment_id = f'DUMMYTXN{uuid.uuid4().hex[:12].upper()}'
            payment.gateway_paid_at = timezone.now()
            payment.payment_status = 'approved'
            payment.payment_approved_at = timezone.now()
            payment.gateway_payment_data = {
                'mode': 'dummy',
                'initiated_by': request.user.id,
                'initiated_at': now_iso,
                'amount': amount_str,
                'currency': settings.PAYHERE_CURRENCY,
            }
            payment.project.payment_completed = True
            payment.project.save(update_fields=['payment_completed', 'updated_at'])
            payment.save(update_fields=[
                'payment_method', 'gateway_order_id', 'gateway_status', 'gateway_payment_id',
                'gateway_paid_at', 'payment_status', 'payment_approved_at', 'gateway_payment_data', 'updated_at'
            ])

            return Response({
                'success': True,
                'dummy_mode': True,
                'message': 'Dummy payment completed successfully',
                'payment': ProjectPaymentSerializer(payment, context={'request': request}).data,
            }, status=status.HTTP_200_OK)

        if not str(settings.PAYHERE_MERCHANT_ID).strip() or not _normalize_payhere_secret():
            return Response(
                {'error': 'PayHere gateway is not configured correctly'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        order_id = f'PAY{project.id}{uuid.uuid4().hex[:12].upper()}'
        amount_str = _format_payhere_amount(amount)
        contact = _get_client_payment_contact(project)

        missing_contact_fields = [
            field for field in ('first_name', 'last_name', 'email', 'phone', 'address', 'city', 'country')
            if not str(contact.get(field, '')).strip()
        ]
        if missing_contact_fields:
            return Response(
                {
                    'error': 'Client contact details are incomplete for PayHere checkout',
                    'missing_fields': missing_contact_fields,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.payment_method = 'payhere'
        payment.gateway_order_id = order_id
        payment.gateway_status = 'initiated'
        payment.gateway_payment_data = {
            'initiated_by': request.user.id,
            'initiated_at': timezone.now().isoformat(),
            'amount': amount_str,
            'currency': settings.PAYHERE_CURRENCY,
        }
        payment.save(update_fields=[
            'payment_method', 'gateway_order_id', 'gateway_status', 'gateway_payment_data', 'updated_at'
        ])

        payload = {
            'merchant_id': settings.PAYHERE_MERCHANT_ID,
            'return_url': f"{settings.PAYHERE_RETURN_URL}?payment_status=success&order_id={order_id}",
            'cancel_url': f"{settings.PAYHERE_CANCEL_URL}?payment_status=cancelled&order_id={order_id}",
            'notify_url': settings.PAYHERE_NOTIFY_URL,
            'order_id': order_id,
            'items': f'Project payment - {project.title}',
            'amount': amount_str,
            'currency': settings.PAYHERE_CURRENCY,
            'hash': _build_payhere_checkout_hash(order_id, amount_str, settings.PAYHERE_CURRENCY),
            'first_name': contact['first_name'],
            'last_name': contact['last_name'],
            'email': contact['email'],
            'phone': contact['phone'],
            'address': contact['address'],
            'city': contact['city'],
            'country': contact['country'],
            'custom_1': str(project.id),
            'custom_2': str(payment.id),
        }

        return Response({
            'success': True,
            'message': 'PayHere checkout created successfully',
            'checkout_url': settings.PAYHERE_CHECKOUT_URL,
            'payload': payload,
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data,
        }, status=status.HTTP_200_OK)


class PayHerePaymentNotificationView(APIView):
    """PayHere server-to-server callback endpoint"""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        merchant_id = str(request.data.get('merchant_id', '')).strip()
        order_id = str(request.data.get('order_id', '')).strip()
        amount = _format_payhere_amount(request.data.get('payhere_amount') or request.data.get('amount') or 0)
        currency = str(request.data.get('payhere_currency') or request.data.get('currency') or '').strip()
        status_code = str(request.data.get('status_code', '')).strip()
        signature = str(request.data.get('md5sig', '')).strip().upper()

        if merchant_id != settings.PAYHERE_MERCHANT_ID:
            return Response({'error': 'Invalid merchant id'}, status=status.HTTP_400_BAD_REQUEST)

        expected_signature = _build_payhere_notification_hash(order_id, amount, currency, status_code)
        if signature != expected_signature:
            return Response({'error': 'Invalid payment signature'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = ProjectPayment.objects.select_related('project').get(gateway_order_id=order_id)
        except ProjectPayment.DoesNotExist:
            return Response({'error': 'Payment record not found'}, status=status.HTTP_404_NOT_FOUND)

        payment.gateway_payment_data = request.data

        if status_code == '2':
            payment.gateway_status = 'paid'
            payment.gateway_payment_id = str(request.data.get('payment_id') or request.data.get('payhere_payment_id') or '')
            payment.gateway_paid_at = timezone.now()
            payment.payment_status = 'approved'
            payment.payment_approved_at = timezone.now()
            payment.project.payment_completed = True
            payment.project.save(update_fields=['payment_completed', 'updated_at'])
            payment.save(update_fields=[
                'gateway_payment_data', 'gateway_status', 'gateway_payment_id', 'gateway_paid_at',
                'payment_status', 'payment_approved_at', 'updated_at'
            ])
        elif status_code in {'0', '1'}:
            payment.gateway_status = 'pending'
            payment.save(update_fields=['gateway_payment_data', 'gateway_status', 'updated_at'])
        else:
            payment.gateway_status = 'failed'
            payment.save(update_fields=['gateway_payment_data', 'gateway_status', 'updated_at'])

        return Response({'success': True}, status=status.HTTP_200_OK)


class GetPaymentDetailsView(APIView):
    """Get payment details for a project"""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        user_role = get_user_role(request.user)
        
        try:
            # Different access based on role
            if user_role == 'coordinator':
                project = Project.objects.get(id=project_id, coordinator=request.user)
            elif user_role == 'client':
                project = Project.objects.get(id=project_id, assigned_client=request.user)
            elif user_role == 'admin' or request.user.is_staff:
                project = Project.objects.get(id=project_id)
            else:
                return Response(
                    {'error': 'You do not have permission to view this payment'},
                    status=status.HTTP_403_FORBIDDEN
                )
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get or create payment record
        payment, created = ProjectPayment.objects.get_or_create(
            project=project,
            defaults={
                'estimated_value': project.estimated_value,
                'payment_status': 'pending'
            }
        )

        return Response({
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data,
            'project': {
                'id': project.id,
                'title': project.title,
                'status': project.status,
                'estimated_value': str(project.estimated_value),
            }
        }, status=status.HTTP_200_OK)


class StartProjectView(APIView):
    """Start a project after validating payment and role assignments"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can start projects'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if project is already started
        if project.status == 'in_progress':
            return Response(
                {'error': 'Project is already in progress'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if project.status == 'completed':
            return Response(
                {'error': 'Cannot start a completed project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate admin approval for direct projects
        if project.admin_approval_status == 'not_submitted':
            return Response({
                'error': 'Please request admin approval before starting this project',
                'admin_approval_status': project.admin_approval_status,
            }, status=status.HTTP_400_BAD_REQUEST)

        if project.admin_approval_status == 'pending':
            return Response({
                'error': 'Admin approval is required before starting this project',
                'admin_approval_status': project.admin_approval_status,
            }, status=status.HTTP_400_BAD_REQUEST)

        if project.admin_approval_status == 'rejected':
            return Response({
                'error': 'This project was rejected by admin and cannot be started',
                'admin_approval_status': project.admin_approval_status,
                'admin_rejection_reason': project.admin_rejection_reason,
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate payment
        try:
            payment = project.payment
            if payment.payment_status != 'approved':
                return Response({
                    'error': 'Payment must be approved before starting the project',
                    'payment_status': payment.payment_status,
                    'payment_status_display': payment.get_payment_status_display()
                }, status=status.HTTP_400_BAD_REQUEST)
        except ProjectPayment.DoesNotExist:
            return Response(
                {'error': 'No payment record found. Please send payment request first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate mandatory role assignments
        missing_roles = []
        
        # Field Officer is mandatory
        if not project.assigned_field_officer:
            missing_roles.append('Field Officer')
        
        # Client is mandatory
        if not project.assigned_client:
            missing_roles.append('Client')
        
        # Accessor is mandatory
        if not project.assigned_accessor:
            missing_roles.append('Accessor')
        
        # Senior Valuer is mandatory
        if not project.assigned_senior_valuer:
            missing_roles.append('Senior Valuer')
        
        # Agent is optional - only required if has_agent is True
        if project.has_agent and not project.assigned_agent:
            missing_roles.append('Agent (marked as required)')

        if missing_roles:
            return Response({
                'error': 'Cannot start project. Missing mandatory role assignments.',
                'missing_roles': missing_roles
            }, status=status.HTTP_400_BAD_REQUEST)

        # Start the project
        project.status = 'in_progress'
        project.save()

        # Record in history
        ProjectStatusHistory.objects.create(
            project=project,
            status='in_progress',
            notes='Project started after payment approval and role assignments',
            created_by=request.user
        )

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='PROJECT_STARTED',
                user=request.user,
                description=f"Project started: {project.title} (ID: {project.id})",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id},
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Project started successfully!',
            'project': ProjectSerializer(project, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ClientPaymentOverviewView(APIView):
    """Get all projects with payment info for the logged-in client"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_role = get_user_role(request.user)
        if user_role != 'client':
            return Response(
                {'error': 'Only clients can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        projects = Project.objects.filter(assigned_client=request.user).select_related('coordinator')
        
        result = []
        for project in projects:
            payment_data = None
            try:
                payment = project.payment
                payment_data = ProjectPaymentSerializer(payment, context={'request': request}).data
            except ProjectPayment.DoesNotExist:
                pass

            result.append({
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'status': project.status,
                'status_display': project.get_status_display(),
                'estimated_value': str(project.estimated_value),
                'payment_completed': project.payment_completed,
                'coordinator_name': f"{project.coordinator.first_name} {project.coordinator.last_name}".strip() or project.coordinator.username if project.coordinator else None,
                'created_at': project.created_at.isoformat(),
                'payment': payment_data
            })

        return Response({
            'projects': result
        }, status=status.HTTP_200_OK)


class AgentPaymentOverviewView(APIView):
    """Get all projects with payment info for the logged-in agent"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_role = get_user_role(request.user)
        if user_role != 'agent':
            return Response(
                {'error': 'Only agents can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        projects = Project.objects.filter(assigned_agent=request.user).select_related('coordinator')

        result = []
        for project in projects:
            payment_data = None
            try:
                payment = project.payment
                payment_data = ProjectPaymentSerializer(payment, context={'request': request}).data
            except ProjectPayment.DoesNotExist:
                pass

            result.append({
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'status': project.status,
                'status_display': project.get_status_display(),
                'estimated_value': str(project.estimated_value),
                'coordinator_name': f"{project.coordinator.first_name} {project.coordinator.last_name}".strip() or project.coordinator.username if project.coordinator else None,
                'created_at': project.created_at.isoformat(),
                'payment': payment_data
            })

        return Response({
            'projects': result
        }, status=status.HTTP_200_OK)


class RecordAgentPaymentView(APIView):
    """Coordinator records payment made to agent for a project"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can record agent payments'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not project.assigned_agent:
            return Response(
                {'error': 'No agent assigned to this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount = request.data.get('amount')
        if not amount:
            return Response(
                {'error': 'Payment amount is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = float(amount)
            if amount <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid payment amount'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment, created = ProjectPayment.objects.get_or_create(
            project=project,
            defaults={
                'estimated_value': project.estimated_value,
                'payment_status': 'pending'
            }
        )

        if payment.agent_payment_status == 'paid':
            return Response(
                {'error': 'Agent payment has already been recorded for this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.agent_payment_amount = amount
        payment.agent_payment_status = 'paid'
        payment.agent_paid_at = timezone.now()
        payment.agent_paid_by = request.user
        payment.agent_payment_notes = request.data.get('notes', '')
        payment.save()

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='AGENT_PAYMENT_RECORDED',
                user=request.user,
                target_user=project.assigned_agent,
                description=f"Agent payment recorded for project: {project.title}. Amount: Rs. {amount:,.2f}",
                category='payment',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'amount': str(amount)},
            )
        except Exception:
            pass
        _notify_project_users(
            [project.assigned_agent],
            category='payment',
            severity='success',
            title=f'Agent payment recorded — {project.title}',
            message=f'Your commission payment of Rs. {amount:,.2f} has been recorded.',
            meta={'project_id': project.id, 'amount': str(amount)},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Agent payment recorded successfully',
            'payment': ProjectPaymentSerializer(payment, context={'request': request}).data
        }, status=status.HTTP_200_OK)


# ============================================================================
# Cancellation Request Views
# ============================================================================

class RequestCancellationView(APIView):
    """Coordinator requests project cancellation"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can request cancellation'},
                status=status.HTTP_403_FORBIDDEN
            )

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'error': 'Cancellation reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if there's already a pending cancellation request
        existing_request = ProjectCancellationRequest.objects.filter(
            project=project,
            status='pending'
        ).first()
        
        if existing_request:
            return Response(
                {'error': 'A cancellation request is already pending for this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create cancellation request
        cancellation_request = ProjectCancellationRequest.objects.create(
            project=project,
            requested_by=request.user,
            reason=reason
        )

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='CANCELLATION_REQUESTED',
                user=request.user,
                description=f"Cancellation requested for project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'reason': reason},
            )
        except Exception:
            pass
        _notify_project_users(
            list(User.objects.filter(role__role='admin', is_active=True)),
            category='project',
            severity='warning',
            title=f'Cancellation requested — {project.title}',
            message=f'{request.user.get_full_name() or request.user.username} requested cancellation.',
            meta={'project_id': project.id, 'request_id': cancellation_request.id, 'reason': reason},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Cancellation request submitted. Waiting for admin approval.',
            'request': ProjectCancellationRequestSerializer(cancellation_request, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class GetCancellationRequestsView(APIView):
    """Get cancellation requests - admin sees all, coordinator sees their own"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_role = get_user_role(request.user)
        
        if user_role == 'admin':
            # Admin sees all pending requests by default
            status_filter = request.query_params.get('status', 'pending')
            if status_filter == 'all':
                queryset = ProjectCancellationRequest.objects.all()
            else:
                queryset = ProjectCancellationRequest.objects.filter(status=status_filter)
        elif user_role == 'coordinator':
            # Coordinator sees only their own requests
            queryset = ProjectCancellationRequest.objects.filter(
                requested_by=request.user
            )
        else:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        queryset = queryset.select_related('project', 'requested_by', 'reviewed_by').order_by('-created_at')
        
        # Summary counts for admin
        summary = {}
        if user_role == 'admin':
            all_requests = ProjectCancellationRequest.objects.all()
            summary = {
                'total': all_requests.count(),
                'pending': all_requests.filter(status='pending').count(),
                'approved': all_requests.filter(status='approved').count(),
                'rejected': all_requests.filter(status='rejected').count(),
            }

        serializer = ProjectCancellationRequestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'requests': serializer.data,
            'summary': summary
        }, status=status.HTTP_200_OK)


class ApproveCancellationView(APIView):
    """Admin approves cancellation request"""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        user_role = get_user_role(request.user)
        if user_role != 'admin':
            return Response(
                {'error': 'Only admins can approve cancellation requests'},
                status=status.HTTP_403_FORBIDDEN
            )

        admin_remarks = request.data.get('admin_remarks', '').strip()

        try:
            cancellation_request = ProjectCancellationRequest.objects.select_related('project').get(id=request_id)
        except ProjectCancellationRequest.DoesNotExist:
            return Response(
                {'error': 'Cancellation request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if cancellation_request.status != 'pending':
            return Response(
                {'error': f'Request has already been {cancellation_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update cancellation request
        cancellation_request.status = 'approved'
        cancellation_request.reviewed_by = request.user
        cancellation_request.admin_remarks = admin_remarks
        cancellation_request.reviewed_at = timezone.now()
        cancellation_request.save()

        # Update project status to cancelled
        project = cancellation_request.project
        old_status = project.status
        project.status = 'cancelled'
        project.save()

        # Record status change in history
        ProjectStatusHistory.objects.create(
            project=project,
            status='cancelled',
            notes=f"Project cancelled. Reason: {cancellation_request.reason}",
            created_by=request.user
        )

        # Get all assigned users for notification
        assigned_users = []
        for field in ['coordinator', 'assigned_field_officer', 'assigned_client', 'assigned_agent', 'assigned_accessor', 'assigned_senior_valuer']:
            user = getattr(project, field, None)
            if user and user not in assigned_users:
                assigned_users.append(user)
        
        # Add to notified users
        cancellation_request.notified_users.add(*assigned_users)

        # Send notifications to all assigned users
        try:
            from authentication.services import EmailService
            for user in assigned_users:
                if user.email:
                    EmailService.send_cancellation_notification(
                        project=project,
                        user=user,
                        is_approved=True,
                        reason=cancellation_request.reason,
                        admin_remarks=admin_remarks
                    )
        except Exception as e:
            logger.warning(f"Failed to send cancellation notifications: {str(e)}")

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='CANCELLATION_APPROVED',
                user=request.user,
                description=f"Cancellation approved for project: {project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'request_id': request_id},
            )
        except Exception:
            pass
        _notify_project_users(
            assigned_users,
            category='project',
            severity='warning',
            title=f'Project cancelled — {project.title}',
            message=f'Cancellation approved. Reason: {cancellation_request.reason}',
            meta={'project_id': project.id, 'request_id': request_id, 'status': 'approved'},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Cancellation approved. Project status updated and all team members notified.',
            'request': ProjectCancellationRequestSerializer(cancellation_request, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class RejectCancellationView(APIView):
    """Admin rejects cancellation request"""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        user_role = get_user_role(request.user)
        if user_role != 'admin':
            return Response(
                {'error': 'Only admins can reject cancellation requests'},
                status=status.HTTP_403_FORBIDDEN
            )

        admin_remarks = request.data.get('admin_remarks', '').strip()
        if not admin_remarks:
            return Response(
                {'error': 'Admin remarks are required when rejecting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cancellation_request = ProjectCancellationRequest.objects.select_related('project').get(id=request_id)
        except ProjectCancellationRequest.DoesNotExist:
            return Response(
                {'error': 'Cancellation request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if cancellation_request.status != 'pending':
            return Response(
                {'error': f'Request has already been {cancellation_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update cancellation request
        cancellation_request.status = 'rejected'
        cancellation_request.reviewed_by = request.user
        cancellation_request.admin_remarks = admin_remarks
        cancellation_request.reviewed_at = timezone.now()
        cancellation_request.save()

        # Notify coordinator of rejection
        try:
            from authentication.services import EmailService
            if cancellation_request.requested_by.email:
                EmailService.send_cancellation_notification(
                    project=cancellation_request.project,
                    user=cancellation_request.requested_by,
                    is_approved=False,
                    reason=cancellation_request.reason,
                    admin_remarks=admin_remarks
                )
        except Exception as e:
            logger.warning(f"Failed to send rejection notification: {str(e)}")

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='CANCELLATION_REJECTED',
                user=request.user,
                description=f"Cancellation rejected for project: {cancellation_request.project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': cancellation_request.project.id, 'request_id': request_id},
            )
        except Exception:
            pass
        _notify_project_users(
            [cancellation_request.requested_by],
            category='project',
            severity='info',
            title=f'Cancellation request rejected — {cancellation_request.project.title}',
            message=f'Admin remarks: {admin_remarks}',
            meta={'project_id': cancellation_request.project.id, 'request_id': request_id, 'status': 'rejected'},
            action_url=f'/dashboard/projects/{cancellation_request.project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Cancellation request rejected. Coordinator has been notified.',
            'request': ProjectCancellationRequestSerializer(cancellation_request, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class GetProjectCancellationStatusView(APIView):
    """Get cancellation request status for a specific project"""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        user_role = get_user_role(request.user)
        
        # Check access
        if user_role == 'coordinator' and project.coordinator != request.user:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get latest cancellation request
        latest_request = ProjectCancellationRequest.objects.filter(
            project=project
        ).order_by('-created_at').first()

        if not latest_request:
            return Response({
                'has_request': False,
                'request': None
            }, status=status.HTTP_200_OK)

        return Response({
            'has_request': True,
            'request': ProjectCancellationRequestSerializer(latest_request, context={'request': request}).data
        }, status=status.HTTP_200_OK)


# ============================================================================
# Commission Report Views
# ============================================================================

class GenerateCommissionReportView(APIView):
    """Generate a PDF commission report for a project's agent payment"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can generate commission reports'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project = Project.objects.get(id=project_id, coordinator=request.user)
        except Project.DoesNotExist:
            return Response(
                {'error': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not project.assigned_agent:
            return Response(
                {'error': 'No agent assigned to this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = project.payment
        except ProjectPayment.DoesNotExist:
            return Response(
                {'error': 'No payment record found for this project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if payment.agent_payment_status != 'paid':
            return Response(
                {'error': 'Agent payment must be recorded before generating commission report'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate PDF
        import io
        from django.core.files.base import ContentFile
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import inch, mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=30*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm)

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=20, spaceAfter=6, textColor=colors.HexColor('#1565C0'))
        subtitle_style = ParagraphStyle('CustomSubtitle', parent=styles['Normal'], fontSize=10, textColor=colors.grey, spaceAfter=20)
        heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=13, textColor=colors.HexColor('#1565C0'), spaceBefore=16, spaceAfter=8)
        normal_style = styles['Normal']

        elements = []

        # Header
        elements.append(Paragraph('AUDITRA', title_style))
        elements.append(Paragraph('Commission Report', subtitle_style))
        elements.append(Spacer(1, 10))

        # Project Information
        elements.append(Paragraph('Project Information', heading_style))

        agent = project.assigned_agent
        agent_name = f"{agent.first_name} {agent.last_name}".strip() or agent.username
        coordinator_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        project_data = [
            ['Project Title', project.title],
            ['Description', project.description or 'N/A'],
            ['Status', project.get_status_display()],
            ['Start Date', str(project.start_date) if project.start_date else 'N/A'],
            ['End Date', str(project.end_date) if project.end_date else 'N/A'],
            ['Coordinator', coordinator_name],
        ]

        project_table = Table(project_data, colWidths=[150, 350])
        project_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F4F8')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#333333')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DEE2E6')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(project_table)

        # Agent & Payment Information
        elements.append(Paragraph('Agent Payment Details', heading_style))

        payment_data = [
            ['Agent Name', agent_name],
            ['Agent Email', agent.email or 'N/A'],
            ['Commission Amount', f'Rs. {payment.agent_payment_amount:,.2f}'],
            ['Payment Date', str(payment.agent_paid_at.strftime('%Y-%m-%d %H:%M')) if payment.agent_paid_at else 'N/A'],
            ['Payment Notes', payment.agent_payment_notes or 'N/A'],
        ]

        payment_table = Table(payment_data, colWidths=[150, 350])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F0F4F8')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#333333')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DEE2E6')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(payment_table)

        # Footer
        elements.append(Spacer(1, 30))
        footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)
        elements.append(Paragraph(f'Generated on {timezone.now().strftime("%Y-%m-%d %H:%M")} by {coordinator_name}', footer_style))
        elements.append(Paragraph('This is a system-generated document from Auditra.', footer_style))

        doc.build(elements)
        pdf_content = buffer.getvalue()
        buffer.close()

        # Save to CommissionReport
        filename = f'commission_report_{project.id}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        report = CommissionReport.objects.create(
            project=project,
            generated_by=request.user,
            agent=agent,
            commission_amount=payment.agent_payment_amount,
        )
        report.report_file.save(filename, ContentFile(pdf_content))

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='COMMISSION_REPORT_GENERATED',
                user=request.user,
                target_user=agent,
                description=f"Commission report generated for project: {project.title}. Amount: Rs. {payment.agent_payment_amount:,.2f}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': project.id, 'report_id': report.id},
            )
        except Exception:
            pass
        _notify_project_users(
            [agent],
            category='project',
            severity='info',
            title=f'Commission report generated — {project.title}',
            message='A commission report has been generated for your payment.',
            meta={'project_id': project.id, 'report_id': report.id},
            action_url=f'/dashboard/projects/{project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Commission report generated successfully',
            'report': CommissionReportSerializer(report, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class SendCommissionReportView(APIView):
    """Send a commission report to the agent via email"""
    permission_classes = [IsAuthenticated]

    def post(self, request, report_id):
        user_role = get_user_role(request.user)
        if user_role != 'coordinator':
            return Response(
                {'error': 'Only coordinators can send commission reports'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            report = CommissionReport.objects.select_related('project', 'agent').get(
                id=report_id,
                generated_by=request.user
            )
        except CommissionReport.DoesNotExist:
            return Response(
                {'error': 'Commission report not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not report.agent or not report.agent.email:
            return Response(
                {'error': 'Agent has no email address'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Send email with PDF attachment
        try:
            from authentication.services import EmailService
            EmailService.send_commission_report_to_agent(
                report=report,
                agent=report.agent,
                project=report.project
            )
        except Exception as e:
            logger.warning(f"Failed to send commission report email: {str(e)}")
            return Response(
                {'error': 'Failed to send email. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Update report
        report.sent_to_agent = True
        report.sent_at = timezone.now()
        report.save()

        # Log action
        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='COMMISSION_REPORT_SENT',
                user=request.user,
                target_user=report.agent,
                description=f"Commission report sent to agent for project: {report.project.title}",
                category='project',
                ip_address=get_client_ip(request),
                metadata={'project_id': report.project.id, 'report_id': report.id},
            )
        except Exception:
            pass
        _notify_project_users(
            [report.agent],
            category='project',
            severity='info',
            title=f'Commission report sent — {report.project.title}',
            message='Your commission report was sent to your email.',
            meta={'project_id': report.project.id, 'report_id': report.id},
            action_url=f'/dashboard/projects/{report.project.id}',
            actor=request.user,
        )

        return Response({
            'success': True,
            'message': 'Commission report sent to agent successfully',
            'report': CommissionReportSerializer(report, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class AgentCommissionReportsView(APIView):
    """Get all commission reports sent to the logged-in agent"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_role = get_user_role(request.user)
        if user_role != 'agent':
            return Response(
                {'error': 'Only agents can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )

        reports = CommissionReport.objects.filter(
            agent=request.user,
            sent_to_agent=True
        ).select_related('project', 'generated_by').order_by('-created_at')

        serializer = CommissionReportSerializer(reports, many=True, context={'request': request})
        return Response({
            'reports': serializer.data
        }, status=status.HTTP_200_OK)


# ============================================================================
# Feature #2: Project Visit Scheduling
# ============================================================================

from rest_framework.throttling import AnonRateThrottle


class ProjectVisitSerializer(generics.GenericAPIView):
    pass


from rest_framework import serializers as drf_serializers


class ProjectVisitModelSerializer(drf_serializers.ModelSerializer):
    field_officer_name = drf_serializers.SerializerMethodField()
    # Accept both 'note' and 'notes' from clients (mobile uses 'notes')
    notes = drf_serializers.CharField(source='note', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = ProjectVisit
        fields = ['id', 'project', 'field_officer', 'field_officer_name', 'scheduled_date', 'note', 'notes', 'status', 'created_at', 'updated_at']
        # project and field_officer are injected by the view (URL + authenticated user)
        # so clients (mobile/web) should not be forced to send them in payload.
        read_only_fields = ['id', 'project', 'field_officer', 'field_officer_name', 'created_at', 'updated_at']

    def get_field_officer_name(self, obj):
        return obj.field_officer.get_full_name() or obj.field_officer.username


class ProjectVisitListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectVisitModelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ProjectVisit.objects.filter(project_id=self.kwargs['project_id'])

    def perform_create(self, serializer):
        from django.utils import timezone as tz
        project = get_object_or_404(Project, pk=self.kwargs['project_id'])
        user = self.request.user
        role = get_user_role(user)
        if role != 'field_officer':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only field officers can schedule visits.')
        if project.assigned_field_officer != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You are not assigned to this project.')

        visit = serializer.save(project=project, field_officer=user)

        # Notify client, agent, coordinator
        from notifications.services import notify
        fo_name = user.get_full_name() or user.username
        msg = f'Field Officer {fo_name} is scheduled to visit on {visit.scheduled_date} for project "{project.title}".'
        meta = {'project_id': project.id, 'visit_id': visit.id}
        for u in [project.assigned_client, project.assigned_agent, project.coordinator]:
            if u:
                notify(user=u, category='visit', severity='info',
                       title='Site Visit Scheduled', message=msg,
                       meta=meta, action_url=f'/dashboard/projects/{project.id}',
                       email_subject=f'Site Visit Scheduled — {project.title}')


class ProjectVisitDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProjectVisitModelSerializer
    permission_classes = [IsAuthenticated]
    queryset = ProjectVisit.objects.all()

    def perform_update(self, serializer):
        visit = serializer.save()
        project = visit.project
        from notifications.services import notify
        fo_name = visit.field_officer.get_full_name() or visit.field_officer.username
        msg = f'Site visit for project "{project.title}" has been updated. New date: {visit.scheduled_date}.'
        meta = {'project_id': project.id, 'visit_id': visit.id}
        for u in [project.assigned_client, project.assigned_agent, project.coordinator]:
            if u:
                notify(user=u, category='visit', severity='info',
                       title='Site Visit Updated', message=msg,
                       meta=meta, action_url=f'/dashboard/projects/{project.id}',
                       email_subject=f'Site Visit Updated — {project.title}')


# ============================================================================
# Feature #7: Public email/role check (rate-throttled)
# ============================================================================

class PublicEmailCheckThrottle(AnonRateThrottle):
    rate = '20/min'


class PublicCheckEmailView(APIView):
    """
    Public endpoint for landing-page forms to check if an email already
    exists in the system with a different role than intended.
    Returns only boolean flags (no PII).
    """
    permission_classes = []
    throttle_classes = [PublicEmailCheckThrottle]

    def get(self, request):
        email = request.query_params.get('email', '').strip().lower()
        intent = request.query_params.get('intent', '').strip()

        if not email or not intent:
            return Response({'error': 'email and intent required'}, status=400)

        from django.contrib.auth.models import User
        from authentication.models import UserRole

        try:
            user = User.objects.get(email__iexact=email)
            try:
                existing_role = user.role.role
            except Exception:
                existing_role = 'unassigned'

            conflict = existing_role not in ('unassigned',) and existing_role != intent
            return Response({'exists': True, 'conflict': conflict})
        except User.DoesNotExist:
            return Response({'exists': False, 'conflict': False})
