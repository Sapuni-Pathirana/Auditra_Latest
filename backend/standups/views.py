from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from projects.models import Project
from .models import StandupRoom, StandupMessage, StandupMention, StandupMessageView, EXCLUDED_ROLES
from .serializers import StandupMessageSerializer, MentionedUserSerializer
from notifications.models import NotificationPreference


def _get_room_or_404(project_id, user):
    """Get or create standup room; verify user is an eligible member."""
    project = get_object_or_404(Project, pk=project_id)

    # Check role eligibility
    role = getattr(getattr(user, 'role', None), 'role', None)
    if role in EXCLUDED_ROLES:
        return None, None, Response({'error': 'Clients and agents cannot access standups.'}, status=403)

    # Only assigned project members + admin can access
    allowed_users = {
        project.coordinator_id,
        project.assigned_field_officer_id,
        project.assigned_accessor_id,
        project.assigned_senior_valuer_id,
    }
    if role not in ('admin',) and user.id not in allowed_users:
        return None, None, Response({'error': 'You are not assigned to this project.'}, status=403)

    room, _ = StandupRoom.objects.get_or_create(project=project)
    return room, project, None


def _mark_seen(messages, user):
    """Mark returned messages as seen by the current user."""
    for msg in messages:
        StandupMessageView.objects.get_or_create(message=msg, viewer=user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_messages(request, project_id):
    room, project, err = _get_room_or_404(project_id, request.user)
    if err:
        return err

    limit = int(request.query_params.get('limit', 50))
    before_id = request.query_params.get('before')

    qs = StandupMessage.objects.filter(room=room).select_related('author', 'author__role').prefetch_related('mentions')
    if before_id:
        qs = qs.filter(id__lt=before_id)
    messages = list(qs.order_by('-created_at')[:limit])
    messages.reverse()
    _mark_seen(messages, request.user)

    serializer = StandupMessageSerializer(messages, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def post_message(request, project_id):
    room, project, err = _get_room_or_404(project_id, request.user)
    if err:
        return err

    body = request.data.get('body', '').strip()
    kind = request.data.get('kind', 'free')
    if not body:
        return Response({'error': 'body is required'}, status=400)

    msg = StandupMessage.objects.create(room=room, author=request.user, kind=kind, body=body)

    # Resolve @mentions → only valid room members, excluding client/agent
    members = room.get_members()
    member_map = {u.username.lower(): u for u in members}
    role_map = {}
    for u in members:
        role = getattr(getattr(u, 'role', None), 'role', None)
        if role:
            role_map.setdefault(role, []).append(u)

    mentioned_users_set = {}
    # Username mentions
    for uname in set(msg.parse_mentions()):
        u = member_map.get(uname.lower())
        if u:
            mentioned_users_set[u.id] = u

    # Role mentions (e.g. @coordinator, @field_officer) → fan out to all room members in that role
    for role_token in set(msg.parse_role_mentions()):
        for u in role_map.get(role_token.lower(), []):
            mentioned_users_set[u.id] = u

    mentioned_users = list(mentioned_users_set.values())
    for u in mentioned_users:
        StandupMention.objects.get_or_create(message=msg, mentioned_user=u)

    # Notify room members and give mention-specific notification to mentioned users.
    from notifications.services import notify
    author_name = request.user.get_full_name() or request.user.username
    mentioned_ids = {u.id for u in mentioned_users}
    for u in members:
        if u.id == request.user.id:
            continue

        is_mentioned = u.id in mentioned_ids
        # Ensure standup chat stays visible in-app even if an old preference row disabled it.
        pref, _ = NotificationPreference.objects.get_or_create(
            user=u,
            category='chat',
            defaults={'in_app': True, 'email': False, 'push': False},
        )
        if not pref.in_app:
            pref.in_app = True
            pref.save(update_fields=['in_app'])

        notify(
            user=u,
            category='chat',
            title=f'{author_name} mentioned you' if is_mentioned else f'New standup message from {author_name}',
            message=body[:200],
            meta={
                'project_id': project.id,
                'message_id': msg.id,
                'is_mention': is_mentioned,
                'kind': kind,
            },
            action_url=f'/dashboard/projects/{project.id}/standups',
        )

    # Author has seen their own message.
    StandupMessageView.objects.get_or_create(message=msg, viewer=request.user)

    # Broadcast via WebSocket
    _broadcast_message(room, msg, request)

    serializer = StandupMessageSerializer(msg, context={'request': request})
    return Response(serializer.data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_members(request, project_id):
    room, project, err = _get_room_or_404(project_id, request.user)
    if err:
        return err

    members = room.get_members()
    serializer = MentionedUserSerializer(members, many=True)
    return Response(serializer.data)


def _broadcast_message(room, msg, request):
    """Push new message to all standup group members via channels."""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from standups.serializers import StandupMessageSerializer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        data = StandupMessageSerializer(msg, context={'request': request}).data
        async_to_sync(channel_layer.group_send)(
            f'standup_{room.project_id}',
            {'type': 'standup.message', 'message': data},
        )
        return
    except Exception:
        pass


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_seen(request, project_id):
    room, project, err = _get_room_or_404(project_id, request.user)
    if err:
        return err

    message_ids = request.data.get('message_ids', [])
    if not isinstance(message_ids, list):
        return Response({'error': 'message_ids must be a list'}, status=400)

    qs = StandupMessage.objects.filter(room=room, id__in=message_ids)
    for msg in qs:
        StandupMessageView.objects.get_or_create(message=msg, viewer=request.user)

    return Response({'success': True, 'marked': qs.count()})
