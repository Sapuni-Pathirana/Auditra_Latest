"""
Standups REST API tests (list_messages, post_message, etc.).

WebSocket consumers are optional to test in CI; see consumers.py.
"""
import uuid

from rest_framework import status

from auditra_backend.test_helpers import (
    BaseAuthAPITestCase,
    api_client_with_jwt,
    create_project,
    ensure_project_payment_row,
    user_with_role,
)


class TestStandupsAPI(BaseAuthAPITestCase):
    def test_list_messages_forbidden_client_403(self):
        """list_messages: client role cannot access standups (negative)."""
        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        cli = user_with_role(f'cl_{uuid.uuid4().hex[:8]}', 'client')
        p = create_project(coord, title='S1')
        ensure_project_payment_row(p)
        p.assigned_client = cli
        p.save()
        c = api_client_with_jwt(cli)
        res = c.get(f'/api/standups/projects/{p.id}/messages/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_messages_field_officer_200(self):
        """list_messages: assigned field officer can list messages."""
        coord = user_with_role(f'c2_{uuid.uuid4().hex[:8]}', 'coordinator')
        fo = user_with_role(f'fo_{uuid.uuid4().hex[:8]}', 'field_officer')
        p = create_project(coord, title='S2')
        ensure_project_payment_row(p)
        p.assigned_field_officer = fo
        p.status = 'in_progress'
        p.save()
        c = api_client_with_jwt(fo)
        res = c.get(f'/api/standups/projects/{p.id}/messages/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_post_message_empty_body_400(self):
        """post_message: empty body rejected (negative)."""
        coord = user_with_role(f'c3_{uuid.uuid4().hex[:8]}', 'coordinator')
        fo = user_with_role(f'fo2_{uuid.uuid4().hex[:8]}', 'field_officer')
        p = create_project(coord, title='S3')
        ensure_project_payment_row(p)
        p.assigned_field_officer = fo
        p.status = 'in_progress'
        p.save()
        c = api_client_with_jwt(fo)
        res = c.post(
            f'/api/standups/projects/{p.id}/messages/post/',
            {'body': '  ', 'kind': 'free'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
