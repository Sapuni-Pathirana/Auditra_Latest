"""Unit tests for notifications.services (notify, helpers, project team)."""
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings

from auditra_backend.test_helpers import create_project, create_user, user_with_role
from notifications import services as notif_services
from notifications.models import DeviceToken, Notification, NotificationPreference


class TestNotifyService(TestCase):
    def setUp(self):
        self.user = user_with_role(f'nu_{uuid.uuid4().hex[:8]}', 'client')

    @patch.object(notif_services, '_send_email')
    @patch.object(notif_services, '_send_fcm')
    @patch.object(notif_services, '_push_websocket')
    def test_notify_creates_in_app_and_calls_websocket(
        self, mock_ws, mock_fcm, mock_email
    ):
        n = notif_services.notify(
            self.user,
            category='project',
            title='Hello',
            message='Body',
            meta={'k': 1},
            action_url='/p/1',
        )
        self.assertIsNotNone(n)
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)
        mock_ws.assert_called_once()
        args, _ = mock_ws.call_args
        self.assertEqual(args[0], self.user.id)
        self.assertIsNotNone(args[1])
        mock_fcm.assert_not_called()
        mock_email.assert_not_called()

    @patch.object(notif_services, '_push_websocket')
    def test_notify_in_app_off_skips_row_but_still_pushes_socket(self, mock_ws):
        NotificationPreference.objects.create(
            user=self.user, category='valuation', in_app=False, email=False, push=False
        )
        n = notif_services.notify(
            self.user, category='valuation', title='T', message='M'
        )
        self.assertIsNone(n)
        self.assertEqual(
            Notification.objects.filter(user=self.user, category='valuation').count(),
            0,
        )
        mock_ws.assert_called_once()

    @patch.object(notif_services, '_send_email')
    @patch.object(notif_services, '_send_fcm')
    @patch.object(notif_services, '_push_websocket')
    def test_notify_push_calls_fcm_when_tokens(
        self, mock_ws, mock_fcm, mock_email
    ):
        NotificationPreference.objects.filter(
            user=self.user, category='attendance'
        ).delete()
        p, _ = NotificationPreference.objects.get_or_create(
            user=self.user,
            category='attendance',
            defaults={'in_app': True, 'email': False, 'push': True},
        )
        p.push = True
        p.in_app = False
        p.save()
        DeviceToken.objects.create(
            user=self.user, token='t_fcm_1', platform='android'
        )
        n = notif_services.notify(
            self.user, category='attendance', title='T', message='M', meta={'a': 'b'}
        )
        self.assertIsNone(n)
        mock_fcm.assert_called_once()
        ftokens, ttitle, tmsg, tmeta = mock_fcm.call_args[0]
        self.assertEqual(ftokens, ['t_fcm_1'])
        self.assertEqual(ttitle, 'T')
        self.assertEqual(tmsg, 'M')

    @patch.object(notif_services, '_send_email')
    @patch.object(notif_services, '_send_fcm')
    @patch.object(notif_services, '_push_websocket')
    @override_settings(
        DEFAULT_FROM_EMAIL='test@example.com', EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
    )
    def test_notify_email_uses_user_email(
        self, mock_ws, mock_fcm, mock_email
    ):
        NotificationPreference.objects.update_or_create(
            user=self.user,
            category='account',
            defaults={'in_app': False, 'email': True, 'push': False},
        )
        notif_services.notify(
            self.user,
            category='account',
            title='Subj',
            message='Text',
            email_subject='Custom subj',
        )
        mock_email.assert_called_once()
        u, subj, body = mock_email.call_args[0]
        self.assertEqual(u, self.user)
        self.assertEqual(subj, 'Custom subj')
        self.assertEqual(body, 'Text')

    @patch.object(notif_services, 'notify')
    def test_notify_project_team_replaces_and_calls_notify(self, mock_notify):
        coord = user_with_role(f'c_{uuid.uuid4().hex[:8]}', 'coordinator')
        fo = user_with_role(f'f_{uuid.uuid4().hex[:8]}', 'field_officer')
        proj = create_project(coord, title='MyTitle')
        proj.assigned_field_officer = fo
        proj.save()
        notif_services.notify_project_team(
            proj,
            category='project',
            title_template='Hi {role} on {project}',
            message_template='Work for {project} as {role}',
            meta={'x': 1},
        )
        self.assertTrue(mock_notify.call_count >= 1)
        # coordinator + field_officer
        usernames = {call[0][0].username for call in mock_notify.call_args_list}
        self.assertIn(coord.username, usernames)
        self.assertIn(fo.username, usernames)

    @patch.object(notif_services, 'notify')
    def test_notify_project_team_excludes_role(self, mock_notify):
        coord = user_with_role(f'c2_{uuid.uuid4().hex[:8]}', 'coordinator')
        proj = create_project(coord, title='P3')
        notif_services.notify_project_team(
            proj,
            category='project',
            title_template='T',
            message_template='M',
            exclude_roles=['coordinator'],
        )
        for call in mock_notify.call_args_list:
            self.assertNotEqual(call[0][0].username, coord.username)

    def test_get_project_users_includes_assigned_and_agent_when_has_agent(self):
        coord = user_with_role(f'c3_{uuid.uuid4().hex[:8]}', 'coordinator')
        cl = user_with_role(f'cl_{uuid.uuid4().hex[:8]}', 'client')
        ag = user_with_role(f'ag_{uuid.uuid4().hex[:8]}', 'agent')
        p = create_project(coord, title='PX', has_agent=True, assigned_client=cl, assigned_agent=ag)
        pairs = notif_services._get_project_users(p, [])
        roles = {r for _, r in pairs}
        self.assertIn('client', roles)
        self.assertIn('agent', roles)
        self.assertIn('coordinator', roles)

    @patch('channels.layers.get_channel_layer', side_effect=RuntimeError('no layer'))
    @patch('notifications.services.logger')
    def test_push_websocket_swallows_channel_error(self, mock_log, _gl):
        notif_services._push_websocket(1, None)
        mock_log.warning.assert_called()

    @override_settings(FCM_CREDENTIALS_PATH='')
    def test_send_fcm_no_credentials_returns_without_log(self):
        with patch('notifications.services.logger') as log:
            notif_services._send_fcm(['t'], 'a', 'b', {})
        log.warning.assert_not_called()

    @patch('firebase_admin.messaging.send_each_for_multicast', side_effect=OSError('fcm down'))
    @patch('firebase_admin.initialize_app')
    @patch('firebase_admin.credentials.Certificate')
    @patch('notifications.services.logger')
    def test_send_fcm_swallows_messaging_error(self, mock_log, mock_cert, mock_init, mock_send):
        import os
        fd, name = tempfile.mkstemp(suffix='.json')
        os.close(fd)
        path = Path(name)
        self.addCleanup(lambda: path.unlink(missing_ok=True))
        path.write_text('{}', encoding='utf-8')
        with override_settings(FCM_CREDENTIALS_PATH=str(path)):
            notif_services._send_fcm(['t'], 'a', 'b', {'k': 1})
        mock_log.warning.assert_called()

    @patch('django.core.mail.send_mail', side_effect=OSError('bad'))
    @patch('notifications.services.logger')
    def test_send_email_swallows_send_failure(self, mock_log, _mock_send):
        u = create_user('em_fail')
        notif_services._send_email(u, 's', 'b')
        mock_log.warning.assert_called()
