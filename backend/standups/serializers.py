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
    author_role = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    mentions = serializers.SerializerMethodField()

    class Meta:
        model = StandupMessage
        fields = ['id', 'author', 'author_name', 'author_role', 'author_avatar', 'kind', 'body', 'created_at', 'mentions']
        read_only_fields = ['id', 'author', 'author_name', 'author_role', 'author_avatar', 'created_at', 'mentions']

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username

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
