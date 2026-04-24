from django.urls import path
from . import views

urlpatterns = [
    path('projects/<int:project_id>/', views.get_or_create_report, name='report-detail'),
    path('projects/<int:project_id>/submit/', views.submit_report, name='report-submit'),
    path('<int:report_id>/items/', views.ValuationItemListCreateView.as_view(), name='item-list'),
    path('items/<int:pk>/', views.ValuationItemDetailView.as_view(), name='item-detail'),
    path('items/<int:pk>/merge/', views.merge_item, name='item-merge'),
    path('items/<int:item_id>/photos/', views.ItemPhotoListCreateView.as_view(), name='item-photos'),
    path('items/<int:item_id>/photos/reorder/', views.reorder_item_photos, name='item-photos-reorder'),
    path('items/<int:item_id>/photos/<int:photo_id>/set-primary/', views.set_primary_item_photo, name='item-photo-set-primary'),
]
