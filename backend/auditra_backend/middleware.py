"""
JWT auth middleware for Django Channels WebSocket connections.
Reads the token from:
  - Query param ?token=<jwt>
  - Subprotocol header (legacy)
"""
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.auth import AuthMiddlewareStack
from django.contrib.auth.models import AnonymousUser


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_list = params.get('token', [])

        if token_list:
            token = token_list[0]
            user = await self._get_user(token)
            scope['user'] = user
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @staticmethod
    async def _get_user(token_key):
        from django.contrib.auth.models import AnonymousUser
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth.models import User
            from asgiref.sync import sync_to_async

            access_token = AccessToken(token_key)
            user_id = access_token['user_id']
            get_user = sync_to_async(User.objects.get)
            user = await get_user(id=user_id)
            return user
        except Exception:
            return AnonymousUser()
