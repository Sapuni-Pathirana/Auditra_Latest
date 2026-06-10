"""
Reports app views for one report per project.
This file handles report loading, saving, item management, photo management, and PDF generation.
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
    """Checks whether the user can edit this project report."""
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
    """Loads the report for a project, or creates it if it does not exist yet."""
    project = get_object_or_404(Project, pk=project_id)
    report, _ = ProjectReport.objects.get_or_create(project=project)
    serializer = ProjectReportSerializer(report, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def submit_report(request, project_id):
    """Submits the full project report so the accessor can review it."""
    project = get_object_or_404(Project, pk=project_id)
    if not _require_fo_or_coordinator(request.user, project):
        return Response({'error': 'Permission denied'}, status=403)

    # Make sure the report exists before we try to submit it.
    report, _ = ProjectReport.objects.get_or_create(project=project)
    if report.status not in ('draft', 'rejected'):
        return Response({'error': f'Cannot submit from status: {report.status}'}, status=400)

    # A report must have at least one item before it can be sent for review.
    if not report.items.exists():
        return Response({'error': 'Report must have at least one item before submitting'}, status=400)

    # Change the status so the workflow moves to the next stage.
    report.status = 'submitted'
    report.submitted_at = timezone.now()
    report.save()

    # Build the PDF copy after the report is submitted.
    _generate_report_pdf(report)

    # Tell the accessor that a report is ready for review.
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
    """Lists valuation items in a report and lets users add new items."""
    serializer_class = ValuationItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns the items that belong to the selected report."""
        report_id = self.kwargs.get('report_id')
        return ValuationItem.objects.filter(report_id=report_id).prefetch_related('photos')

    def perform_create(self, serializer):
        """Saves a new item and marks it if it matches an existing duplicate."""
        report_id = self.kwargs.get('report_id')
        report = get_object_or_404(ProjectReport, pk=report_id)

        title = serializer.validated_data.get('title', '')
        category = serializer.validated_data.get('category', '')

        # Check if the same item already exists in this report.
        existing = ValuationItem.objects.filter(
            report=report, title__iexact=title, category=category
        ).first()
        is_dup = existing is not None

        # Save the item and remember who added it.
        item = serializer.save(report=report, added_by=self.request.user, is_merged_duplicate=is_dup)

        # Store the item in the shared catalog if it is not there already.
        from catalog.models import ItemCatalog
        try:
            ItemCatalog.objects.get_or_create(
                title__iexact=title, category=category,
                defaults={'title': title, 'category': category, 'specs': serializer.validated_data.get('specs', {}), 'created_by': self.request.user},
            )
        except Exception:
            pass

    def create(self, request, *args, **kwargs):
        """Stops duplicate items from being created twice in the same report."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Check for an existing matching item before creating a new one.
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
    """Shows, updates, or deletes one valuation item."""
    serializer_class = ValuationItemSerializer
    permission_classes = [IsAuthenticated]
    queryset = ValuationItem.objects.all()

    def update(self, request, *args, **kwargs):
        """Blocks stale updates when the client data is older than the server data."""
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
    """Merges one duplicate item into another item in the same report."""
    source = get_object_or_404(ValuationItem, pk=pk)
    target_id = request.data.get('target_id')
    target = get_object_or_404(ValuationItem, pk=target_id, report=source.report)

    # Combine notes from both items so nothing is lost.
    if source.notes:
        target.notes = (target.notes + '\n\n' + source.notes).strip()
    # Move all photos from the duplicate item to the target item.
    source.photos.update(item=target)
    source.delete()
    target.save()

    return Response(ValuationItemSerializer(target, context={'request': request}).data)


# --- Item Photos ---

class ItemPhotoListCreateView(generics.ListCreateAPIView):
    """Lists photos for one item and lets users upload more photos."""
    serializer_class = ValuationItemPhotoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Returns the photos that belong to the selected item."""
        return ValuationItemPhoto.objects.filter(item_id=self.kwargs['item_id'])

    def perform_create(self, serializer):
        """Attaches a new photo to the selected item."""
        item = get_object_or_404(ValuationItem, pk=self.kwargs['item_id'])
        serializer.save(item=item)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reorder_item_photos(request, item_id):
    """Saves the new order for photos inside one item."""
    item = get_object_or_404(ValuationItem, pk=item_id)
    ordered_ids = request.data.get('photo_ids', [])
    # The list order sent by the client becomes the saved order number.
    for idx, pid in enumerate(ordered_ids):
        ValuationItemPhoto.objects.filter(pk=pid, item=item).update(ordering=idx)
    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def set_primary_item_photo(request, item_id, photo_id):
    """Marks one photo as the main photo for the item."""
    item = get_object_or_404(ValuationItem, pk=item_id)
    # Only one photo can be primary, so clear all others first.
    ValuationItemPhoto.objects.filter(item=item).update(is_primary=False)
    updated = ValuationItemPhoto.objects.filter(pk=photo_id, item=item).update(is_primary=True)
    if not updated:
        return Response({'error': 'Photo not found'}, status=404)
    return Response({'status': 'ok'})


# --- PDF Generation ---

def _generate_report_pdf(report: ProjectReport):
    """Builds a PDF file for the report and saves it on the model."""
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

        # Add the report header.
        story.append(Paragraph(f"Valuation Report: {report.project.title}", styles['Title']))
        story.append(Paragraph(f"Status: {report.get_status_display()}", styles['Normal']))
        story.append(Spacer(1, 12))

        # Add one section for each item in the report.
        for item in report.items.all():
            story.append(Paragraph(f"{item.title} ({item.get_category_display()})", styles['Heading2']))
            story.append(Paragraph(f"Description: {item.description or '—'}", styles['Normal']))
            if item.estimated_value:
                story.append(Paragraph(f"Estimated Value: Rs. {item.estimated_value:,.2f}", styles['Normal']))
            if item.computed_book_value:
                story.append(Paragraph(f"Book Value (after depreciation): Rs. {item.computed_book_value:,.2f}", styles['Normal']))
            story.append(Spacer(1, 8))

        # Add the total value at the end of the document.
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Total Estimated Value: Rs. {report.total_estimated_value:,.2f}", styles['Heading2']))

        # Write the PDF file into the report model.
        doc.build(story)

        filename = f"report_{report.project_id}.pdf"
        report.final_pdf.save(filename, ContentFile(buffer.getvalue()), save=True)
        buffer.close()
    except Exception:
        # PDF generation is best-effort here, so the report flow does not break.
        pass
