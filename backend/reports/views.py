"""
Reports app views — one report per project (Feature #13).
Handles ProjectReport CRUD, ValuationItem CRUD, photo management, and PDF generation.
"""
import io
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from projects.models import Project
from .models import ProjectReport, ValuationItem, ValuationItemPhoto
from .serializers import ProjectReportSerializer, ValuationItemSerializer, ValuationItemPhotoSerializer


def _require_fo_or_coordinator(user, project):
    role = getattr(getattr(user, 'role', None), 'role', None)
    if role == 'admin':
        return True
    if role == 'field_officer' and project.assigned_field_officer == user:
        return True
    if role == 'coordinator' and project.coordinator == user:
        return True
    return False


# --- Project Report ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_or_create_report(request, project_id):
    project = get_object_or_404(Project, pk=project_id)
    report, _ = ProjectReport.objects.get_or_create(project=project)
    serializer = ProjectReportSerializer(report, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def submit_report(request, project_id):
    """Submit the full project report for accessor review."""
    project = get_object_or_404(Project, pk=project_id)
    if not _require_fo_or_coordinator(request.user, project):
        return Response({'error': 'Permission denied'}, status=403)

    report, _ = ProjectReport.objects.get_or_create(project=project)
    if report.status not in ('draft', 'rejected'):
        return Response({'error': f'Cannot submit from status: {report.status}'}, status=400)

    if not report.items.exists():
        return Response({'error': 'Report must have at least one item before submitting'}, status=400)

    report.status = 'submitted'
    report.submitted_at = timezone.now()
    report.save()

    # Generate PDF
    _generate_report_pdf(report)

    from notifications.services import notify
    if project.assigned_accessor:
        notify(
            user=project.assigned_accessor,
            category='valuation', severity='info',
            title=f'Report submitted: {project.title}',
            message=f'A new valuation report for "{project.title}" has been submitted for your review.',
            meta={'project_id': project.id, 'report_id': report.id},
            action_url=f'/dashboard/projects/{project.id}',
        )

    return Response(ProjectReportSerializer(report, context={'request': request}).data)


# --- Valuation Items ---

class ValuationItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ValuationItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        report_id = self.kwargs.get('report_id')
        return ValuationItem.objects.filter(report_id=report_id).prefetch_related('photos')

    def perform_create(self, serializer):
        report_id = self.kwargs.get('report_id')
        report = get_object_or_404(ProjectReport, pk=report_id)

        title = serializer.validated_data.get('title', '')
        category = serializer.validated_data.get('category', '')

        # Duplicate detection
        existing = ValuationItem.objects.filter(
            report=report, title__iexact=title, category=category
        ).first()
        is_dup = existing is not None

        item = serializer.save(report=report, added_by=self.request.user, is_merged_duplicate=is_dup)

        # Upsert into ItemCatalog
        from catalog.models import ItemCatalog
        try:
            ItemCatalog.objects.get_or_create(
                title__iexact=title, category=category,
                defaults={'title': title, 'category': category, 'specs': serializer.validated_data.get('specs', {}), 'created_by': self.request.user},
            )
        except Exception:
            pass

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Check for duplicates before saving
        report_id = kwargs.get('report_id')
        report = get_object_or_404(ProjectReport, pk=report_id)
        title = serializer.validated_data.get('title', '')
        category = serializer.validated_data.get('category', '')
        existing = ValuationItem.objects.filter(report=report, title__iexact=title, category=category).first()

        if existing:
            return Response({
                'duplicate': True,
                'existing_item': ValuationItemSerializer(existing, context={'request': request}).data,
                'message': f'An item named "{title}" of type "{category}" already exists in this report. Merge or create new?',
            }, status=status.HTTP_200_OK)

        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ValuationItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ValuationItemSerializer
    permission_classes = [IsAuthenticated]
    queryset = ValuationItem.objects.all()

    def update(self, request, *args, **kwargs):
        item = self.get_object()
        expected = request.data.get('expected_updated_at')
        if expected and str(item.updated_at.isoformat()) != expected:
            return Response({
                'conflict': True,
                'server': ValuationItemSerializer(item, context={'request': request}).data,
            }, status=409)
        return super().update(request, *args, **kwargs)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def merge_item(request, pk):
    """Merge a duplicate item into an existing one."""
    source = get_object_or_404(ValuationItem, pk=pk)
    target_id = request.data.get('target_id')
    target = get_object_or_404(ValuationItem, pk=target_id, report=source.report)

    # Merge notes
    if source.notes:
        target.notes = (target.notes + '\n\n' + source.notes).strip()
    # Transfer photos
    source.photos.update(item=target)
    source.delete()
    target.save()

    return Response(ValuationItemSerializer(target, context={'request': request}).data)


# --- Item Photos ---

class ItemPhotoListCreateView(generics.ListCreateAPIView):
    serializer_class = ValuationItemPhotoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ValuationItemPhoto.objects.filter(item_id=self.kwargs['item_id'])

    def perform_create(self, serializer):
        item = get_object_or_404(ValuationItem, pk=self.kwargs['item_id'])
        serializer.save(item=item)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reorder_item_photos(request, item_id):
    item = get_object_or_404(ValuationItem, pk=item_id)
    ordered_ids = request.data.get('photo_ids', [])
    for idx, pid in enumerate(ordered_ids):
        ValuationItemPhoto.objects.filter(pk=pid, item=item).update(ordering=idx)
    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def set_primary_item_photo(request, item_id, photo_id):
    item = get_object_or_404(ValuationItem, pk=item_id)
    ValuationItemPhoto.objects.filter(item=item).update(is_primary=False)
    updated = ValuationItemPhoto.objects.filter(pk=photo_id, item=item).update(is_primary=True)
    if not updated:
        return Response({'error': 'Photo not found'}, status=404)
    return Response({'status': 'ok'})


# --- PDF Generation ---

def _generate_report_pdf(report: ProjectReport):
    """Generate a combined PDF for all items in the report using reportlab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
        from django.core.files.base import ContentFile

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph(f"Valuation Report: {report.project.title}", styles['Title']))
        story.append(Paragraph(f"Status: {report.get_status_display()}", styles['Normal']))
        story.append(Spacer(1, 12))

        for item in report.items.all():
            story.append(Paragraph(f"{item.title} ({item.get_category_display()})", styles['Heading2']))
            story.append(Paragraph(f"Description: {item.description or '—'}", styles['Normal']))
            if item.estimated_value:
                story.append(Paragraph(f"Estimated Value: Rs. {item.estimated_value:,.2f}", styles['Normal']))
            if item.computed_book_value:
                story.append(Paragraph(f"Book Value (after depreciation): Rs. {item.computed_book_value:,.2f}", styles['Normal']))
            story.append(Spacer(1, 8))

        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Total Estimated Value: Rs. {report.total_estimated_value:,.2f}", styles['Heading2']))

        doc.build(story)

        filename = f"report_{report.project_id}.pdf"
        report.final_pdf.save(filename, ContentFile(buffer.getvalue()), save=True)
        buffer.close()
    except Exception:
        pass
