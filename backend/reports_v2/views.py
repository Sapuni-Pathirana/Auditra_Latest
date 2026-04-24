"""API views for consolidated per-project reports (Feature #13 — D1)."""
import io
from decimal import Decimal
from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from projects.models import Project
from .models import ReportItem
from .serializers import ReportItemSerializer


class ReportItemListCreateView(generics.ListCreateAPIView):
    """List / create report items for a project."""
    serializer_class = ReportItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReportItem.objects.filter(
            project_id=self.kwargs['project_id'],
        ).select_related('created_by', 'project')

    def perform_create(self, serializer):
        project = Project.objects.get(pk=self.kwargs['project_id'])
        data = serializer.validated_data
        name = data.get('name', '')
        category = data.get('category', '')

        # Duplicate detection on (project, name, category)
        override = self.request.data.get('override_duplicate', False)
        existing = ReportItem.objects.filter(
            project=project, name__iexact=name, category=category,
        ).first()
        if existing and not override:
            raise generics.serializers.ValidationError({
                'duplicate': True,
                'existing_id': existing.id,
                'message': f'An item "{name}" ({category}) already exists in this project.',
            })

        serializer.save(project=project, created_by=self.request.user)


class ReportItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve / update / delete a single report item."""
    serializer_class = ReportItemSerializer
    permission_classes = [IsAuthenticated]
    queryset = ReportItem.objects.all()


class AllReportItemsView(generics.ListAPIView):
    """Admin / MD-GM: filterable list of ALL report items across projects.

    Query params:
        category  — filter by category
        search    — icontains on name
    """
    serializer_class = ReportItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ReportItem.objects.select_related('project', 'created_by').order_by('-created_at')
        cat = self.request.query_params.get('category')
        if cat:
            qs = qs.filter(category=cat)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        data = serializer.data
        for item, obj in zip(data, qs):
            item['project_title'] = obj.project.title if obj.project else None
        return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def consolidated_report_pdf(request, project_id):
    """Generate a single PDF containing all ReportItem rows for a project."""
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    items = ReportItem.objects.filter(project=project).order_by('category', 'name')
    if not items.exists():
        return Response({'error': 'No report items found for this project'}, status=404)

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
        )
        from reportlab.lib.styles import getSampleStyleSheet

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=2*cm, rightMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph(f'Consolidated Valuation Report', styles['Title']))
        story.append(Paragraph(f'Project: {project.title}', styles['Heading2']))
        story.append(Spacer(1, 0.5*cm))

        header = ['#', 'Item Name', 'Category', 'Qty', 'Unit Value', 'Book Value']
        data = [header]
        for idx, item in enumerate(items, 1):
            data.append([
                str(idx),
                item.name,
                item.get_category_display(),
                str(item.quantity),
                f'{item.unit_value:,.2f}',
                f'{item.book_value:,.2f}' if item.book_value is not None else '-',
            ])

        total_value = sum(
            (i.unit_value or 0) * (i.quantity or 1) for i in items
        )
        data.append(['', '', '', '', 'Total', f'{total_value:,.2f}'])

        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1565C0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.whitesmoke, colors.white]),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        story.append(t)
        doc.build(story)

        buf.seek(0)
        resp = HttpResponse(buf.read(), content_type='application/pdf')
        safe_title = project.title.replace(' ', '_')[:40]
        resp['Content-Disposition'] = f'attachment; filename="consolidated_report_{safe_title}.pdf"'
        return resp

    except ImportError:
        return Response(
            {'error': 'reportlab not installed — cannot generate PDF'},
            status=500,
        )
