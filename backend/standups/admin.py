from django.contrib import admin
from .models import StandupRoom, StandupMessage, StandupMention, StandupMessageView


@admin.register(StandupRoom)
class StandupRoomAdmin(admin.ModelAdmin):
    list_display = ['project', 'created_at']


@admin.register(StandupMessage)
class StandupMessageAdmin(admin.ModelAdmin):
    list_display = ['author', 'room', 'kind', 'body', 'created_at']
    list_filter = ['kind']


@admin.register(StandupMention)
class StandupMentionAdmin(admin.ModelAdmin):
    list_display = ['message', 'mentioned_user']


@admin.register(StandupMessageView)
class StandupMessageViewAdmin(admin.ModelAdmin):
    list_display = ['message', 'viewer', 'viewed_at']
    list_filter = ['viewed_at']
