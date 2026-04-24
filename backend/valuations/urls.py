from django.urls import path
from . import views

app_name = 'valuations'

urlpatterns = [
    # Valuation endpoints
    path('', views.ValuationListCreateView.as_view(), name='valuation-list-create'),
    path('<int:pk>/', views.ValuationDetailView.as_view(), name='valuation-detail'),
    path('<int:pk>/submit/', views.submit_valuation, name='valuation-submit'),
    path('<int:pk>/upload-report/', views.upload_submitted_report, name='valuation-upload-report'),
    path('<int:pk>/accept/', views.accept_valuation, name='valuation-accept'),
    path('<int:pk>/reject/', views.reject_valuation, name='valuation-reject'),
    path('<int:pk>/approve/', views.senior_valuer_approve_valuation, name='valuation-approve'),
    path('<int:pk>/senior-valuer-reject/', views.senior_valuer_reject_valuation, name='senior-valuer-reject'),

    # Senior valuer endpoints
    path('senior-valuer/reviewed/', views.SeniorValuerValuationListView.as_view(), name='senior-valuer-valuations'),
    path('<int:pk>/submit-proposal/', views.senior_valuer_submit_proposal, name='senior-valuer-submit-proposal'),

    # MD/GM endpoints
    path('md-gm/valuations/', views.MDGMValuationListView.as_view(), name='md-gm-valuations'),
    path('<int:pk>/md-gm-approve/', views.md_gm_approve_valuation, name='md-gm-approve'),
    path('<int:pk>/md-gm-reject/', views.md_gm_reject_valuation, name='md-gm-reject'),

    # Valuation photo endpoints
    path('<int:valuation_id>/photos/', views.ValuationPhotoListCreateView.as_view(), name='valuation-photo-list-create'),
    path('photos/<int:pk>/', views.ValuationPhotoDetailView.as_view(), name='valuation-photo-detail'),
    path('<int:valuation_id>/photos/reorder/', views.reorder_valuation_photos, name='valuation-photo-reorder'),
    path('<int:valuation_id>/photos/<int:photo_id>/set-primary/', views.set_primary_photo, name='valuation-photo-set-primary'),
]
