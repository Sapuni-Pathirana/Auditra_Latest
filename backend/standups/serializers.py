from rest_framework import serializers
from django.contrib.auth.models import User
from .models import StandupMessage, StandupMention


class MentionedUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'role']

    def get_role(self, obj):
        if hasattr(obj, 'role'):
            return obj.role.role
        return ''


class StandupMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_username = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    mentions = serializers.SerializerMethodField()
    seen_by = serializers.SerializerMethodField()
    seen_count = serializers.SerializerMethodField()
    seen_by_me = serializers.SerializerMethodField()

    class Meta:
        model = StandupMessage
        fields = [
            'id', 'author', 'author_name', 'author_username', 'author_role', 'author_avatar',
            'kind', 'body', 'created_at', 'mentions', 'seen_by', 'seen_count', 'seen_by_me'
        ]
        read_only_fields = [
            'id', 'author', 'author_name', 'author_username', 'author_role', 'author_avatar',
            'created_at', 'mentions', 'seen_by', 'seen_count', 'seen_by_me'
        ]

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

    def get_author_username(self, obj):
        return obj.author.username

    def get_author_role(self, obj):
        if hasattr(obj.author, 'role'):
            return obj.author.role.get_role_display()
        return ''

    def get_author_avatar(self, obj):
        request = self.context.get('request')
        try:
            profile = obj.author.userprofile
            if profile.profile_image and request:
                return request.build_absolute_uri(profile.profile_image.url)
        except Exception:
            pass
        return None

    def get_mentions(self, obj):
        return list(obj.mentions.values_list('mentioned_user__username', flat=True))

    def get_seen_by(self, obj):
        views = obj.views.select_related('viewer').order_by('viewed_at')
        return [
            {
                'id': v.viewer.id,
                'username': v.viewer.username,
                'name': v.viewer.get_full_name() or v.viewer.username,
                'viewed_at': v.viewed_at,
            }
            for v in views
        ]

    def get_seen_count(self, obj):
        return obj.views.count()

    def get_seen_by_me(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return obj.views.filter(viewer=request.user).exists()
