from django.urls import path
from . import views

urlpatterns = [
    path(
        'projects/<int:project_id>/report-items/',
        views.ReportItemListCreateView.as_view(),
        name='report-items-list',
    ),
    path(
        'report-items/<int:pk>/',
        views.ReportItemDetailView.as_view(),
        name='report-items-detail',
    ),
    path(
        'report-items/all/',
        views.AllReportItemsView.as_view(),
        name='all-report-items',
    ),
    path(
        'projects/<int:project_id>/consolidated-report/',
        views.consolidated_report_pdf,
        name='consolidated-report',
    ),
]
