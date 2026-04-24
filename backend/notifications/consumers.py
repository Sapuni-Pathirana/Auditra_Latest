"""
WebSocket consumer for per-user notification delivery.
Each authenticated user joins group 'user_<id>' and receives real-time pushes.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f'user_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # Clients can send {"action": "mark_read", "id": 123}
        try:
            data = json.loads(text_data or '{}')
            if data.get('action') == 'ping':
                await self.send(json.dumps({'type': 'pong'}))
        except Exception:
            pass

    async def notification_message(self, event):
        """Handler called by channel layer group_send."""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'id': event.get('id'),
            'title': event.get('title'),
            'message': event.get('message'),
            'category': event.get('category'),
            'severity': event.get('severity'),
            'action_url': event.get('action_url'),
            'created_at': event.get('created_at'),
        }))
