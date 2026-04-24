"""
WebSocket consumer for per-project standup chat rooms.
Clients join group 'standup_<project_id>' upon connect.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class StandupConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if user is None or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.project_id = self.scope['url_route']['kwargs']['project_id']
        self.group_name = f'standup_{self.project_id}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or '{}')
            if data.get('action') == 'ping':
                await self.send(json.dumps({'type': 'pong'}))
        except Exception:
            pass

    async def standup_message(self, event):
        """Relay new standup message to this WebSocket client."""
        await self.send(text_data=json.dumps({
            'type': 'standup_message',
            'message': event.get('message'),
        }))
