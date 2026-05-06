from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
import logging
from .models import Valuation, ValuationPhoto, ValuationHistory
from .serializers import (
    ValuationSerializer, ValuationCreateSerializer,
    ValuationPhotoSerializer, ValuationPhotoCreateSerializer,
)
from notifications.services import notify as send_notification
from projects.models import Project, ProjectStatusHistory

logger = logging.getLogger(__name__)


class ValuationListCreateView(generics.ListCreateAPIView):
    """List and create valuations"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        project_id = self.request.query_params.get('project', None)

        # Field Officers see their own valuations
        # Accessors see valuations for projects assigned to them
        # Senior Valuers see valuations for projects assigned to them
        if hasattr(user, 'role') and user.role.role == 'accessor':
            queryset = Valuation.objects.filter(project__assigned_accessor=user)
        elif hasattr(user, 'role') and user.role.role == 'senior_valuer':
            queryset = Valuation.objects.filter(project__assigned_senior_valuer=user)
        else:
            queryset = Valuation.objects.filter(field_officer=user)
        
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset.select_related('project', 'field_officer').prefetch_related('photos')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ValuationCreateSerializer
        return ValuationSerializer
    
    def perform_create(self, serializer):
        instance = serializer.save(field_officer=self.request.user)

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='VALUATION_CREATED',
                user=self.request.user,
                description=f"Valuation created for project: {instance.project.title} (category: {instance.get_category_display()})",
                category='valuation',
                ip_address=get_client_ip(self.request),
                metadata={'valuation_id': instance.id, 'project_id': instance.project.id},
            )
        except Exception:
            pass
        try:
            project = instance.project
            actor_name = self.request.user.get_full_name() or self.request.user.username
            meta = {'valuation_id': instance.id, 'project_id': project.id}
            title = f'Valuation created — {project.title}'

            # Notify creator
            send_notification(
                user=self.request.user,
                category='valuation',
                severity='info',
                title=title,
                message=f'You created a {instance.get_category_display()} valuation.',
                meta=meta,
                action_url=f'/dashboard/projects/{project.id}',
            )

            # Notify next reviewer if available
            reviewer = project.assigned_accessor or project.assigned_senior_valuer
            if reviewer and reviewer != self.request.user:
                send_notification(
                    user=reviewer,
                    category='valuation',
                    severity='info',
                    title=title,
                    message=f'{actor_name} created a {instance.get_category_display()} valuation.',
                    meta=meta,
                    action_url=f'/dashboard/projects/{project.id}',
                    email_subject=title,
                )
        except Exception:
            pass
    
    def create(self, request, *args, **kwargs):
        """Override create to provide better error messages and return full object with id"""
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'detail': 'Validation failed',
                    'errors': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        self.perform_create(serializer)
        
        # Return the full object with id using ValuationSerializer
        instance = serializer.instance
        full_serializer = ValuationSerializer(instance, context={'request': request})
        headers = self.get_success_headers(full_serializer.data)
        return Response(full_serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ValuationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a valuation"""
    permission_classes = [IsAuthenticated]
    serializer_class = ValuationSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Field Officers see their own valuations
        # Accessors see valuations for projects assigned to them
        if hasattr(user, 'role') and user.role.role == 'accessor':
            return Valuation.objects.filter(project__assigned_accessor=user).select_related(
                'project', 'field_officer'
            ).prefetch_related('photos')
            
        return Valuation.objects.filter(field_officer=user).select_related(
            'project', 'field_officer'
        ).prefetch_related('photos')
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ValuationCreateSerializer
        return ValuationSerializer
    
    def update(self, request, *args, **kwargs):
        """Override update to check if valuation can be edited"""
        instance = self.get_object()
        
        # Check if valuation can be edited (draft or submitted within 2 hours)
        if not instance.can_be_edited():
            return Response(
                {
                    'error': 'This valuation cannot be edited. Only draft valuations or valuations submitted within the last 2 hours can be edited.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If status is submitted or rejected and being edited, reset to draft
        # This allows rejected reports to be updated and resubmitted
        if instance.status == 'submitted':
            instance.status = 'draft'
            instance.submitted_at = None
            instance.save()
        elif instance.status == 'rejected':
            instance.status = 'draft'
            instance.rejection_reason = ''  # Clear rejection reason when resubmitting
            instance.save()
        
        return super().update(request, *args, **kwargs)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def submit_valuation(request, pk):
    """Submit a valuation (change status from draft to submitted)"""
    valuation = get_object_or_404(
        Valuation,
        pk=pk,
        field_officer=request.user
    )
    
    if valuation.status not in ['draft', 'rejected']:
        return Response(
            {'error': 'Only draft or rejected valuations can be submitted.'},
            status=status.HTTP_400_BAD_REQUEST
        )
   
    is_resubmit = valuation.status == 'rejected'
    valuation.submit()

    # Create history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='resubmitted' if is_resubmit else 'submitted',
        performed_by=request.user,
        comments='Report resubmitted after rejection' if is_resubmit else 'Report submitted for review',
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_SUBMITTED',
            user=request.user,
            description=f"Valuation submitted for project: {valuation.project.title} (category: {valuation.get_category_display()})",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id},
        )
    except Exception as e:
        logger.warning(f"Failed to log valuation submission for valuation {valuation.id}: {str(e)}")

    # Feature #3 (C1): notify the accessor / next reviewer.
    try:
        from notifications.services import notify
        project = valuation.project
        title = f'Valuation submitted — {project.title}'
        msg = (
            f'{request.user.get_full_name() or request.user.username} submitted a '
            f'{valuation.get_category_display()} valuation for review.'
        )
        meta = {'valuation_id': valuation.id, 'project_id': project.id}
        next_reviewer = project.assigned_accessor or project.assigned_senior_valuer
        if next_reviewer:
            notify(
                user=next_reviewer, category='valuation', severity='info',
                title=title, message=msg, meta=meta,
                action_url=f'/dashboard/projects/{project.id}',
                email_subject=title,
            )
    except Exception as e:
        logger.warning(f"Failed to send notification for valuation submission {valuation.id}: {str(e)}")

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_submitted_report(request, pk):
    """Upload the field officer's generated PDF report for a valuation"""
    valuation = get_object_or_404(
        Valuation,
        pk=pk,
        field_officer=request.user
    )

    report_file = request.FILES.get('submitted_report', None)
    if not report_file:
        return Response(
            {'error': 'No report file provided.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    valuation.submitted_report = report_file
    valuation.save(update_fields=['submitted_report', 'updated_at'])

    try:
        project = valuation.project
        title = f'Valuation report uploaded — {project.title}'
        meta = {'valuation_id': valuation.id, 'project_id': project.id}
        send_notification(
            user=request.user,
            category='valuation',
            severity='info',
            title=title,
            message='Your generated valuation report was uploaded successfully.',
            meta=meta,
            action_url=f'/dashboard/projects/{project.id}',
        )
        reviewer = project.assigned_accessor or project.assigned_senior_valuer
        if reviewer and reviewer != request.user:
            send_notification(
                user=reviewer,
                category='valuation',
                severity='info',
                title=title,
                message='A field officer uploaded a valuation report file for review.',
                meta=meta,
                action_url=f'/dashboard/projects/{project.id}',
                email_subject=title,
            )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


class ValuationPhotoListCreateView(generics.ListCreateAPIView):
    """List and create valuation photos"""
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        valuation_id = self.kwargs.get('valuation_id')
        return ValuationPhoto.objects.filter(
            valuation_id=valuation_id,
            valuation__field_officer=self.request.user
        )
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ValuationPhotoCreateSerializer
        return ValuationPhotoSerializer
    
    def perform_create(self, serializer):
        valuation_id = self.kwargs.get('valuation_id')
        valuation = get_object_or_404(
            Valuation,
            pk=valuation_id,
            field_officer=self.request.user
        )
        serializer.save(valuation=valuation)


class ValuationPhotoDetailView(generics.RetrieveDestroyAPIView):
    """Retrieve or delete a valuation photo"""
    permission_classes = [IsAuthenticated]
    serializer_class = ValuationPhotoSerializer
    
    def get_queryset(self):
        return ValuationPhoto.objects.filter(
            valuation__field_officer=self.request.user
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def accept_valuation(request, pk):
    """Accept a valuation (change status to reviewed) and send to senior valuer for approval"""
    valuation = get_object_or_404(Valuation, pk=pk)
    
    # Check if user is an accessor (has accessor role)
    if not hasattr(request.user, 'role') or request.user.role.role != 'accessor':
        return Response(
            {'error': 'Only accessors can accept valuations.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check if accessor is assigned to the project
    if valuation.project.assigned_accessor != request.user:
        return Response(
            {'error': 'You can only accept valuations for projects assigned to you.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Allow accepting draft or submitted valuations only
    if valuation.status not in ['draft', 'submitted']:
        return Response(
            {'error': f'Cannot accept valuation with status: {valuation.status}. Only draft or submitted valuations can be accepted.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if project has an assigned senior valuer
    if not valuation.project.assigned_senior_valuer:
        return Response(
            {'error': 'Cannot accept valuation: Project must have an assigned senior valuer before accepting. Please contact the coordinator to assign a senior valuer to this project.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Change status to reviewed (accessor acceptance - not final approval)
    # Reports are automatically sent to senior valuer for final approval
    valuation.status = 'reviewed'

    # Save accessor comments if provided
    accessor_comments = request.data.get('accessor_comments', '').strip()
    valuation.accessor_comments = accessor_comments

    # Clear rejection reason if it exists
    valuation.rejection_reason = ''
    valuation.save(update_fields=['status', 'accessor_comments', 'rejection_reason', 'updated_at'])
    
    senior_valuer_name = valuation.project.assigned_senior_valuer.get_full_name() or valuation.project.assigned_senior_valuer.username
    logger.info(
        f'Valuation {valuation.id} accepted by accessor {request.user.username} - '
        f'status changed to reviewed and sent to senior valuer {senior_valuer_name} (ID: {valuation.project.assigned_senior_valuer.id})'
    )
    
    ProjectStatusHistory.objects.create(
        project=valuation.project,
        status=valuation.project.status,
        notes=f"Valuation ({valuation.get_category_display()}) accepted by Accessor and sent to Senior Valuer for approval.",
        created_by=request.user
    )

    # Create valuation history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='reviewed',
        performed_by=request.user,
        comments=accessor_comments,
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_ACCEPTED',
            user=request.user,
            description=f"Valuation accepted for project: {valuation.project.title} (sent to senior valuer {senior_valuer_name})",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id},
        )
    except Exception:
        pass

    # Feature #3 (C1): notify the senior valuer and the field officer.
    try:
        from notifications.services import notify
        sv = valuation.project.assigned_senior_valuer
        fo = valuation.field_officer
        meta = {'valuation_id': valuation.id, 'project_id': valuation.project.id}
        if sv:
            notify(
                user=sv, category='valuation', severity='info',
                title=f'Valuation ready for final review — {valuation.project.title}',
                message=f'Accessor accepted a {valuation.get_category_display()} valuation.',
                meta=meta,
                action_url=f'/dashboard/projects/{valuation.project.id}',
                email_subject='Valuation ready for your review',
            )
        if fo:
            notify(
                user=fo, category='valuation', severity='success',
                title=f'Valuation accepted — {valuation.project.title}',
                message='Your valuation has been accepted by the accessor and forwarded to the senior valuer.',
                meta=meta,
                action_url=f'/dashboard/projects/{valuation.project.id}',
            )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response({
        **serializer.data,
        'message': f'Valuation accepted and sent to senior valuer ({senior_valuer_name}) for final approval.'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reject_valuation(request, pk):
    """Reject a valuation (change status to rejected)"""
    valuation = get_object_or_404(Valuation, pk=pk)
    
    # Check if user is an accessor (has accessor role)
    if not hasattr(request.user, 'role') or request.user.role.role != 'accessor':
        return Response(
            {'error': 'Only accessors can reject valuations.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check if accessor is assigned to the project
    if valuation.project.assigned_accessor != request.user:
        return Response(
            {'error': 'You can only reject valuations for projects assigned to you.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Allow rejecting draft, submitted, or reviewed valuations
    if valuation.status not in ['draft', 'submitted', 'reviewed']:
        return Response(
            {'error': f'Cannot reject valuation with status: {valuation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get rejection reason from request
    rejection_reason = request.data.get('rejection_reason', '').strip()
    if not rejection_reason:
        return Response(
            {'error': 'Rejection reason is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Update valuation status and rejection reason
    valuation.status = 'rejected'
    valuation.rejection_reason = rejection_reason
    valuation.save(update_fields=['status', 'rejection_reason', 'updated_at'])
    
    logger.info(f'Valuation {valuation.id} rejected by accessor {request.user.username}')
    
    ProjectStatusHistory.objects.create(
        project=valuation.project,
        status=valuation.project.status,
        notes=f"Valuation ({valuation.get_category_display()}) rejected by Accessor. Reason: {rejection_reason}",
        created_by=request.user
    )

    # Create valuation history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='rejected_by_accessor',
        performed_by=request.user,
        comments=rejection_reason,
    )

    # Notify field officer
    accessor_name = request.user.get_full_name() or request.user.username
    send_notification(
        user=valuation.field_officer,
        category='valuation',
        severity='error',
        title='Valuation Rejected by Assessor',
        message=f'Your {valuation.get_category_display()} valuation for project "{valuation.project.title}" has been rejected by Assessor ({accessor_name}). Reason: {rejection_reason}',
        meta={'valuation_id': valuation.id, 'project_id': valuation.project.id},
        action_url=f'/dashboard/projects/{valuation.project.id}',
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_REJECTED',
            user=request.user,
            description=f"Valuation rejected by accessor for project: {valuation.project.title}. Reason: {rejection_reason}",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id, 'reason': rejection_reason},
        )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


class SeniorValuerValuationListView(generics.ListAPIView):
    """List reviewed valuations assigned to senior valuer"""
    permission_classes = [IsAuthenticated]
    serializer_class = ValuationSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Check if user is a senior valuer
        if not hasattr(user, 'role') or user.role.role != 'senior_valuer':
            return Valuation.objects.none()
        
        # Get reviewed valuations for projects assigned to this senior valuer
        queryset = Valuation.objects.filter(
            project__assigned_senior_valuer=user,
            status='reviewed'
        ).select_related('project', 'field_officer').prefetch_related('photos')
        
        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        return queryset


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def senior_valuer_submit_proposal(request, pk):
    """Submit senior valuer's proposal for a reviewed valuation"""
    valuation = get_object_or_404(Valuation, pk=pk)
    
    # Check if user is a senior valuer
    if not hasattr(request.user, 'role') or request.user.role.role != 'senior_valuer':
        return Response(
            {'error': 'Only senior valuers can submit proposals.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check if senior valuer is assigned to the project
    if valuation.project.assigned_senior_valuer != request.user:
        return Response(
            {'error': 'You can only submit proposals for projects assigned to you.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Only reviewed valuations can receive proposals
    if valuation.status != 'reviewed':
        return Response(
            {'error': f'Only reviewed valuations can receive proposals. Current status: {valuation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get proposal data from request
    senior_valuer_comments = request.data.get('senior_valuer_comments', '').strip()
    final_report = request.FILES.get('final_report', None)
    
    # Update valuation with senior valuer's proposal
    if senior_valuer_comments:
        valuation.senior_valuer_comments = senior_valuer_comments
    if final_report:
        valuation.final_report = final_report
    
    valuation.save(update_fields=['senior_valuer_comments', 'final_report', 'updated_at'])
    
    logger.info(f'Valuation {valuation.id} proposal submitted by senior valuer {request.user.username}')
    try:
        title = f'Senior valuer proposal submitted — {valuation.project.title}'
        meta = {'valuation_id': valuation.id, 'project_id': valuation.project.id}
        send_notification(
            user=request.user,
            category='valuation',
            severity='info',
            title=title,
            message='Your proposal details were saved successfully.',
            meta=meta,
            action_url=f'/dashboard/projects/{valuation.project.id}',
        )
        if valuation.field_officer and valuation.field_officer != request.user:
            send_notification(
                user=valuation.field_officer,
                category='valuation',
                severity='info',
                title=title,
                message='A senior valuer submitted proposal details for your valuation.',
                meta=meta,
                action_url=f'/dashboard/projects/{valuation.project.id}',
            )
    except Exception:
        pass
    
    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def senior_valuer_approve_valuation(request, pk):
    """Approve a valuation (change status to approved) - Only senior valuer can do this"""
    valuation = get_object_or_404(Valuation, pk=pk)
    
    # Check if user is a senior valuer (has senior_valuer role)
    if not hasattr(request.user, 'role') or request.user.role.role != 'senior_valuer':
        return Response(
            {'error': 'Only senior valuers can approve valuations.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check if senior valuer is assigned to the project
    if valuation.project.assigned_senior_valuer != request.user:
        return Response(
            {'error': 'You can only approve valuations for projects assigned to you.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Only reviewed valuations can be approved by senior valuer
    if valuation.status != 'reviewed':
        return Response(
            {'error': f'Only reviewed valuations can be approved. Current status: {valuation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Save senior valuer comments if provided
    senior_valuer_comments = request.data.get('senior_valuer_comments', '').strip()
    if senior_valuer_comments:
        valuation.senior_valuer_comments = senior_valuer_comments

    # Change status to approved (sends to MD/GM for final approval)
    valuation.status = 'approved'

    update_fields = ['status', 'updated_at']
    if senior_valuer_comments:
        update_fields.append('senior_valuer_comments')
    valuation.save(update_fields=update_fields)

    logger.info(f'Valuation {valuation.id} approved by senior valuer {request.user.username} and sent to MD/GM')

    ProjectStatusHistory.objects.create(
        project=valuation.project,
        status=valuation.project.status,
        notes=f"Valuation ({valuation.get_category_display()}) approved by Senior Valuer and sent to MD/GM for final approval.",
        created_by=request.user
    )

    # Create valuation history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='approved_by_sv',
        performed_by=request.user,
        comments=senior_valuer_comments,
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_APPROVED',
            user=request.user,
            description=f"Valuation approved by senior valuer for project: {valuation.project.title} and sent to MD/GM",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id},
        )
    except Exception:
        pass

    # Feature #3 (C1): notify the field officer + MD/GM users.
    try:
        from notifications.services import notify
        meta = {'valuation_id': valuation.id, 'project_id': valuation.project.id}
        if valuation.field_officer:
            notify(
                user=valuation.field_officer, category='valuation', severity='success',
                title=f'Valuation approved — {valuation.project.title}',
                message='Your valuation has been approved by the senior valuer and sent to MD/GM.',
                meta=meta,
                action_url=f'/dashboard/projects/{valuation.project.id}',
            )
        from django.contrib.auth.models import User
        for md in User.objects.filter(role__role='md_gm', is_active=True):
            notify(
                user=md, category='valuation', severity='info',
                title=f'Valuation awaiting MD/GM approval — {valuation.project.title}',
                message='A senior-valuer-approved valuation is ready for final approval.',
                meta=meta,
                action_url=f'/dashboard/projects/{valuation.project.id}',
                email_subject='Valuation awaiting MD/GM approval',
            )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response({
        **serializer.data,
        'message': 'Valuation approved and sent to MD/GM for final approval.'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def senior_valuer_reject_valuation(request, pk):
    """Reject a valuation (change status to rejected) - Only senior valuer can do this"""
    valuation = get_object_or_404(Valuation, pk=pk)
    
    # Check if user is a senior valuer (has senior_valuer role)
    if not hasattr(request.user, 'role') or request.user.role.role != 'senior_valuer':
        return Response(
            {'error': 'Only senior valuers can reject valuations.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check if senior valuer is assigned to the project
    if valuation.project.assigned_senior_valuer != request.user:
        return Response(
            {'error': 'You can only reject valuations for projects assigned to you.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Only reviewed valuations can be rejected by senior valuer
    if valuation.status != 'reviewed':
        return Response(
            {'error': f'Only reviewed valuations can be rejected. Current status: {valuation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get rejection reason from request
    rejection_reason = request.data.get('rejection_reason', '').strip()
    if not rejection_reason:
        return Response(
            {'error': 'Rejection reason is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Update valuation status and rejection reason
    valuation.status = 'rejected'
    valuation.rejection_reason = rejection_reason
    valuation.save(update_fields=['status', 'rejection_reason', 'updated_at'])
    
    logger.info(f'Valuation {valuation.id} rejected by senior valuer {request.user.username}')
    
    ProjectStatusHistory.objects.create(
        project=valuation.project,
        status=valuation.project.status,
        notes=f"Valuation ({valuation.get_category_display()}) rejected by Senior Valuer. Reason: {rejection_reason}",
        created_by=request.user
    )

    # Create valuation history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='rejected_by_sv',
        performed_by=request.user,
        comments=rejection_reason,
    )

    # Notify assessor and field officer
    sv_name = request.user.get_full_name() or request.user.username
    notification_msg = f'{valuation.get_category_display()} valuation for project "{valuation.project.title}" has been rejected by Senior Valuer ({sv_name}). Reason: {rejection_reason}'
    meta = {'valuation_id': valuation.id, 'project_id': valuation.project.id}
    action_url = f'/dashboard/projects/{valuation.project.id}'

    if valuation.project.assigned_accessor:
        send_notification(
            user=valuation.project.assigned_accessor,
            category='valuation', severity='warning',
            title='Valuation Rejected by Senior Valuer',
            message=notification_msg, meta=meta, action_url=action_url,
        )

    send_notification(
        user=valuation.field_officer,
        category='valuation', severity='error',
        title='Valuation Rejected by Senior Valuer',
        message=notification_msg, meta=meta, action_url=action_url,
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_REJECTED',
            user=request.user,
            description=f"Valuation rejected by senior valuer for project: {valuation.project.title}. Reason: {rejection_reason}",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id, 'reason': rejection_reason},
        )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


# ============================================================================
# MD/GM Valuation Views
# ============================================================================

class MDGMValuationListView(generics.ListAPIView):
    """List approved valuations for MD/GM review"""
    permission_classes = [IsAuthenticated]
    serializer_class = ValuationSerializer

    def get_queryset(self):
        user = self.request.user

        if not hasattr(user, 'role') or user.role.role != 'md_gm':
            return Valuation.objects.none()

        # MD/GM sees all approved and md_approved valuations
        queryset = Valuation.objects.filter(
            status__in=['approved', 'md_approved', 'rejected']
        ).select_related('project', 'field_officer').prefetch_related('photos')

        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def md_gm_approve_valuation(request, pk):
    """MD/GM approves a valuation (change status to md_approved)"""
    valuation = get_object_or_404(Valuation, pk=pk)

    if not hasattr(request.user, 'role') or request.user.role.role != 'md_gm':
        return Response(
            {'error': 'Only MD/GM can approve valuations at this stage.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if valuation.status != 'approved':
        return Response(
            {'error': f'Only senior-valuer-approved valuations can be approved by MD/GM. Current status: {valuation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    md_gm_comments = request.data.get('md_gm_comments', '').strip()

    valuation.status = 'md_approved'
    valuation.md_gm_comments = md_gm_comments
    valuation.save(update_fields=['status', 'md_gm_comments', 'updated_at'])

    logger.info(f'Valuation {valuation.id} approved by MD/GM {request.user.username}')

    ProjectStatusHistory.objects.create(
        project=valuation.project,
        status=valuation.project.status,
        notes=f"Valuation ({valuation.get_category_display()}) approved by MD/GM.",
        created_by=request.user
    )

    # Create valuation history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='md_approved',
        performed_by=request.user,
        comments=md_gm_comments,
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_MD_APPROVED',
            user=request.user,
            description=f"Valuation approved by MD/GM for project: {valuation.project.title}",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id},
        )
    except Exception:
        pass
    try:
        meta = {'valuation_id': valuation.id, 'project_id': valuation.project.id}
        title = f'Valuation approved by MD/GM — {valuation.project.title}'

        # Actor
        send_notification(
            user=request.user,
            category='valuation',
            severity='success',
            title=title,
            message='You approved this valuation.',
            meta=meta,
            action_url=f'/dashboard/projects/{valuation.project.id}',
        )

        # Stakeholders
        stakeholders = [
            valuation.field_officer,
            valuation.project.assigned_senior_valuer,
            valuation.project.assigned_accessor,
            valuation.project.coordinator,
        ]
        for u in stakeholders:
            if u and u != request.user:
                send_notification(
                    user=u,
                    category='valuation',
                    severity='success',
                    title=title,
                    message='A valuation has received final MD/GM approval.',
                    meta=meta,
                    action_url=f'/dashboard/projects/{valuation.project.id}',
                    email_subject=title,
                )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def md_gm_reject_valuation(request, pk):
    """MD/GM rejects a valuation (change status to rejected)"""
    valuation = get_object_or_404(Valuation, pk=pk)

    if not hasattr(request.user, 'role') or request.user.role.role != 'md_gm':
        return Response(
            {'error': 'Only MD/GM can reject valuations at this stage.'},
            status=status.HTTP_403_FORBIDDEN
        )

    if valuation.status != 'approved':
        return Response(
            {'error': f'Only senior-valuer-approved valuations can be rejected by MD/GM. Current status: {valuation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    rejection_reason = request.data.get('rejection_reason', '').strip()
    if not rejection_reason:
        return Response(
            {'error': 'Rejection reason is required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    md_gm_comments = request.data.get('md_gm_comments', '').strip()

    valuation.status = 'rejected'
    valuation.rejection_reason = rejection_reason
    valuation.md_gm_comments = md_gm_comments
    valuation.save(update_fields=['status', 'rejection_reason', 'md_gm_comments', 'updated_at'])

    logger.info(f'Valuation {valuation.id} rejected by MD/GM {request.user.username}')

    ProjectStatusHistory.objects.create(
        project=valuation.project,
        status=valuation.project.status,
        notes=f"Valuation ({valuation.get_category_display()}) rejected by MD/GM. Reason: {rejection_reason}",
        created_by=request.user
    )

    # Create valuation history entry
    ValuationHistory.objects.create(
        valuation=valuation,
        action='rejected_by_mdgm',
        performed_by=request.user,
        comments=rejection_reason,
    )

    # Notify senior valuer and field officer
    mdgm_name = request.user.get_full_name() or request.user.username
    notification_msg = f'{valuation.get_category_display()} valuation for project "{valuation.project.title}" has been rejected by MD/GM ({mdgm_name}). Reason: {rejection_reason}'
    meta = {'valuation_id': valuation.id, 'project_id': valuation.project.id}
    action_url = f'/dashboard/projects/{valuation.project.id}'

    if valuation.project.assigned_senior_valuer:
        send_notification(
            user=valuation.project.assigned_senior_valuer,
            category='valuation', severity='warning',
            title='Valuation Rejected by MD/GM',
            message=notification_msg, meta=meta, action_url=action_url,
        )

    send_notification(
        user=valuation.field_officer,
        category='valuation', severity='error',
        title='Valuation Rejected by MD/GM',
        message=notification_msg, meta=meta, action_url=action_url,
    )

    try:
        from system_logs.utils import log_action, get_client_ip
        log_action(
            action='VALUATION_MD_REJECTED',
            user=request.user,
            description=f"Valuation rejected by MD/GM for project: {valuation.project.title}. Reason: {rejection_reason}",
            category='valuation',
            ip_address=get_client_ip(request),
            metadata={'valuation_id': valuation.id, 'project_id': valuation.project.id, 'reason': rejection_reason},
        )
    except Exception:
        pass

    serializer = ValuationSerializer(valuation, context={'request': request})
    return Response(serializer.data, status=status.HTTP_200_OK)



# ============================================================================
# Photo reorder + primary photo (Feature #9)
# ============================================================================

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reorder_valuation_photos(request, valuation_id):
    """Accept an ordered list of photo IDs and update ordering field."""
    valuation = get_object_or_404(Valuation, pk=valuation_id)
    ordered_ids = request.data.get('photo_ids', [])
    if not isinstance(ordered_ids, list):
        return Response({'error': 'photo_ids must be a list'}, status=400)
    for idx, photo_id in enumerate(ordered_ids):
        ValuationPhoto.objects.filter(pk=photo_id, valuation=valuation).update(ordering=idx)
    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def set_primary_photo(request, valuation_id, photo_id):
    """Set one photo as primary (clears all others for this valuation first)."""
    valuation = get_object_or_404(Valuation, pk=valuation_id)
    ValuationPhoto.objects.filter(valuation=valuation).update(is_primary=False)
    updated = ValuationPhoto.objects.filter(pk=photo_id, valuation=valuation).update(is_primary=True)
    if not updated:
        return Response({'error': 'Photo not found'}, status=404)
    return Response({'status': 'ok'})

