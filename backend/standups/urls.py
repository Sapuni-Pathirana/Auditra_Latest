from django.urls import path
from . import views

urlpatterns = [
    path('projects/<int:project_id>/messages/', views.list_messages, name='standup-messages'),
    path('projects/<int:project_id>/messages/post/', views.post_message, name='standup-post'),
    path('projects/<int:project_id>/messages/seen/', views.mark_seen, name='standup-seen'),
    path('projects/<int:project_id>/members/', views.list_members, name='standup-members'),
]
