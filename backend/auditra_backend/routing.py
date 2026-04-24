"""Global WebSocket URL routing."""
from django.urls import re_path
from notifications.consumers import NotificationConsumer
from standups.consumers import StandupConsumer

websocket_urlpatterns = [
    re_path(r'^ws/notifications/$', NotificationConsumer.as_asgi()),
    re_path(r'^ws/standups/(?P<project_id>\d+)/$', StandupConsumer.as_asgi()),
]
