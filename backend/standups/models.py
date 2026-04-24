import re
from django.db import models
from django.contrib.auth.models import User
from projects.models import Project

# Roles excluded from standup participation
EXCLUDED_ROLES = {'client', 'agent'}


class StandupRoom(models.Model):
    """One standup room per project (auto-created on first message)."""
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name='standup_room')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'standup_rooms'

    def __str__(self):
        return f"Standup: {self.project.title}"

    def get_members(self):
        """Return all eligible users for this room (excludes client & agent)."""
        project = self.project
        candidates = [
            project.coordinator,
            project.assigned_field_officer,
            project.assigned_accessor,
            project.assigned_senior_valuer,
        ]
        return [u for u in candidates if u is not None]


class StandupMessage(models.Model):
    KIND_CHOICES = [
        ('work_to_do', 'Work To Do'),
        ('work_done', 'Work Done'),
        ('free', 'Free Text'),
    ]

    room = models.ForeignKey(StandupRoom, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='standup_messages')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='free')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'standup_messages'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author.username}: {self.body[:50]}"

    def parse_mentions(self):
        """Return list of @mentioned usernames found in body."""
        # Support usernames containing dots/hyphens (e.g. @saman.fernando).
        return re.findall(r'@([a-zA-Z0-9_.-]+)', self.body)

    def parse_role_mentions(self):
        """Return list of @role tokens (e.g. coordinator, field_officer) used in body.

        Matches both snake_case (@field_officer) and spaced forms (@field officer → @field_officer).
        """
        tokens = set(re.findall(r'@([a-zA-Z_]+)', self.body))
        from authentication.models import UserRole as _UR
        role_keys = {r for r, _ in _UR.ROLE_CHOICES}
        return [t for t in tokens if t.lower() in role_keys]


class StandupMention(models.Model):
    message = models.ForeignKey(StandupMessage, on_delete=models.CASCADE, related_name='mentions')
    mentioned_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='standup_mentions')

    class Meta:
        db_table = 'standup_mentions'
        unique_together = ('message', 'mentioned_user')


class StandupMessageView(models.Model):
    """Tracks which users have seen each standup message."""
    message = models.ForeignKey(StandupMessage, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='seen_standup_messages')
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'standup_message_views'
        unique_together = ('message', 'viewer')
