from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailOrUsernameBackend(ModelBackend):
    """
    Allow login with either username or email address.
    Tries username first; if no match, falls back to a case-insensitive
    email lookup so users can log in with whatever credential they remember.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if not username or not password:
            return None

        # 1. Try exact username match (fast path)
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # 2. Fall back to case-insensitive email match
            try:
                user = User.objects.get(email__iexact=username)
            except User.DoesNotExist:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
