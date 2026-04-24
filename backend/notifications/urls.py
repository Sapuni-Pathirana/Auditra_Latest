from django.urls import path
from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', views.unread_count, name='notification-unread-count'),
    path('<int:pk>/read/', views.mark_read, name='notification-mark-read'),
    path('mark-all-read/', views.mark_all_read, name='notification-mark-all-read'),
    path('preferences/', views.NotificationPreferenceListView.as_view(), name='notification-preferences'),
    path('preferences/<int:pk>/', views.NotificationPreferenceDetailView.as_view(), name='notification-preference-detail'),
    path('device-tokens/register/', views.register_device_token, name='register-device-token'),
    path('device-tokens/unregister/', views.unregister_device_token, name='unregister-device-token'),
]
