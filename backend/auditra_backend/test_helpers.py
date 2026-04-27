"""
Shared helpers for Django/DRF tests (user factories, JWT, project fixtures).
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Optional

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from authentication.models import UserRole

# All role choices on UserRole (string values)
ROLES = [c[0] for c in UserRole.ROLE_CHOICES]


def create_user(
    username: str,
    *,
    email: str | None = None,
    password: str = 'TestPassword123!',
    is_active: bool = True,
    first_name: str = '',
    last_name: str = '',
    **user_kwargs: Any,
) -> User:
    """Create a User; UserRole is created by post_save signal with role='unassigned'."""
    if email is None:
        email = f'{username}@test.example.com'
    return User.objects.create_user(
        username=username,
        email=email,
        password=password,
        is_active=is_active,
        first_name=first_name,
        last_name=last_name,
        **user_kwargs,
    )


def set_user_role(
    user: User,
    role: str,
    *,
    password_changed: bool = True,
    assigned_by: User | None = None,
) -> UserRole:
    """Set or update UserRole; role must be in UserRole.ROLE_CHOICES."""
    ur, _ = UserRole.objects.get_or_create(user=user)
    ur.role = role
    if assigned_by is not None:
        ur.assigned_by = assigned_by
    ur.password_changed = password_changed
    ur.save()
    return ur


def user_with_role(
    username: str,
    role: str,
    *,
    assigned_by: User | None = None,
    **kwargs: Any,
) -> User:
    """Convenience: create_user + set_user_role."""
    u = create_user(username, **kwargs)
    set_user_role(u, role, assigned_by=assigned_by)
    return u


def access_token_for(user: User) -> str:
    return str(AccessToken.for_user(user))


def refresh_pair_for(user: User) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    return str(refresh), str(refresh.access_token)


def api_client_with_jwt(user: User) -> APIClient:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token_for(user)}')
    return client


def simple_uploaded_text(name: str, content: bytes = b'x' * 100) -> SimpleUploadedFile:
    return SimpleUploadedFile(name, content, content_type='text/plain')


class AuthAPIMixin:
    """
    Mixin for APITestCase: assert 401/403/404 helpers and client setup.
    """

    def assert_unauthorized(self, response) -> None:
        self.assertIn(response.status_code, (401, 403))

    def assert_bad_request(self, response) -> None:
        self.assertEqual(response.status_code, 400)


class BaseAuthAPITestCase(APITestCase, AuthAPIMixin):
    """Base class for DRF API tests with shared assertions."""


def create_project(coordinator: User, title: str = 'Test Project', **kwargs):
    """Create a minimal Project; coordinator must be a coordinator-role user."""
    from projects.models import Project

    return Project.objects.create(coordinator=coordinator, title=title, **kwargs)


def ensure_project_payment_row(project):
    """
    Ensure Project has a related ProjectPayment row. Some serializers access
    `project.payment` and assume the OneToOne exists.
    """
    from decimal import Decimal

    from projects.models import ProjectPayment

    ProjectPayment.objects.get_or_create(
        project=project,
        defaults={'estimated_value': Decimal('0.00')},
    )


@contextmanager
def override_celery_eager():
    from django.test.utils import override_settings
    with override_settings(
        CELERY_TASK_ALWAYS_EAGER=True,
        CELERY_TASK_EAGER_PROPAGATES=True,
    ):
        yield


@contextmanager
def locmem_email_backend():
    from django.core import mail
    from django.test.utils import override_settings
    with override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
        mail.outbox.clear()
        yield mail
