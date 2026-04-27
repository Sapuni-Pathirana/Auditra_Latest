"""
Tests for ProjectDocumentView (permission and auth only; full multipart in integration).
"""
import uuid
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status

from auditra_backend.test_helpers import (
    BaseAuthAPITestCase,
    api_client_with_jwt,
    create_project,
    ensure_project_payment_row,
    user_with_role,
)


@mock.patch('system_logs.utils.log_action', mock.Mock())
@mock.patch('projects.views._notify_project_users', mock.Mock())
class TestProjectDocuments(BaseAuthAPITestCase):
    def test_upload_document_coordinator_201(self):
        """ProjectDocumentView: coordinator uploads document to own project."""
        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        p = create_project(coord, title='DocP')
        ensure_project_payment_row(p)
        c = api_client_with_jwt(coord)
        f = SimpleUploadedFile('t.txt', b'hello', content_type='text/plain')
        res = c.post(
            '/api/projects/documents/',
            {
                'project': str(p.id),
                'name': 'Test file',
                'file': f,
            },
            format='multipart',
        )
        self.assertIn(res.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))

    def test_upload_document_unauthenticated_401(self):
        """ProjectDocumentView: anonymous cannot upload (negative)."""
        f = SimpleUploadedFile('t.txt', b'hello', content_type='text/plain')
        res = self.client.post(
            '/api/projects/documents/',
            {'project': '1', 'name': 'x', 'file': f},
            format='multipart',
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
