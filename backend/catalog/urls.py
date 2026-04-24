from django.urls import path
from . import views

urlpatterns = [
    path('suggestions/', views.get_suggestions, name='catalog-suggestions'),
    path('items/confirm/', views.confirm_item, name='catalog-confirm-item'),
    path('items/', views.ItemCatalogListView.as_view(), name='catalog-list'),
    path('depreciation/calculate/', views.calculate_depreciation, name='depreciation-calculate'),
    path('depreciation/policies/', views.DepreciationPolicyListView.as_view(), name='depreciation-policies'),
    path('depreciation/policies/<int:pk>/', views.DepreciationPolicyDetailView.as_view(), name='depreciation-policy-detail'),
]
