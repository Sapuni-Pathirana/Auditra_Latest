from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification, NotificationPreference, DeviceToken
from .serializers import NotificationSerializer, NotificationPreferenceSerializer, DeviceTokenSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        unread_only = (self.request.query_params.get('unread') or '').strip().lower()
        if unread_only in ('1', 'true', 'yes'):
            qs = qs.filter(is_read=False)
        return qs[:100]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({'count': count})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_read(request, pk):
    try:
        n = Notification.objects.get(pk=pk, user=request.user)
        n.is_read = True
        n.save(update_fields=['is_read'])
        return Response({'status': 'ok'})
    except Notification.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'ok'})


class NotificationPreferenceListView(generics.ListCreateAPIView):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationPreferenceDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_device_token(request):
    token = request.data.get('token')
    platform = request.data.get('platform', 'android')
    if not token:
        return Response({'error': 'token required'}, status=400)
    obj, _ = DeviceToken.objects.get_or_create(token=token, defaults={'user': request.user, 'platform': platform})
    obj.user = request.user
    obj.platform = platform
    obj.save()
    return Response({'status': 'registered'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unregister_device_token(request):
    token = request.data.get('token')
    DeviceToken.objects.filter(user=request.user, token=token).delete()
    return Response({'status': 'unregistered'})
