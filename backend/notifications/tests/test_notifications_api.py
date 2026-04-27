"""Notifications API tests: all views and query params."""
import uuid

from django.contrib.auth.models import User
from rest_framework import status

from auditra_backend.test_helpers import BaseAuthAPITestCase, api_client_with_jwt, user_with_role
from notifications.models import DeviceToken, Notification, NotificationPreference


class TestNotificationsAPI(BaseAuthAPITestCase):
    def test_list_requires_auth_401(self):
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_authenticated_200(self):
        u = user_with_role(f'n_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/notifications/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, (list, dict))
        if isinstance(res.data, dict) and 'results' in res.data:
            self.assertIn('results', res.data)
        else:
            self.assertIsInstance(res.data, list)

    def test_unread_count_401(self):
        res = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unread_count_200(self):
        u = user_with_role(f'n2_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        res = c.get('/api/notifications/unread-count/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('count'), 0)
        Notification.objects.create(
            user=u,
            title='t',
            message='m',
            category='general',
            is_read=False,
        )
        res2 = c.get('/api/notifications/unread-count/')
        self.assertEqual(res2.data.get('count'), 1)

    def test_list_filter_category(self):
        u = user_with_role(f'nf_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        Notification.objects.create(user=u, title='p', message='m', category='project', is_read=True)
        Notification.objects.create(user=u, title='g', message='m', category='general', is_read=True)
        res = c.get('/api/notifications/?category=project')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        if isinstance(data, dict) and 'results' in data:
            items = data['results']
        else:
            items = data
        titles = {item.get('title') for item in items}
        self.assertIn('p', titles)
        self.assertNotIn('g', titles)

    def test_list_filter_unread(self):
        u = user_with_role(f'nu_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        Notification.objects.create(user=u, title='r1', message='m', category='general', is_read=True)
        Notification.objects.create(user=u, title='u1', message='m', category='general', is_read=False)
        for param in ('1', 'true', 'yes'):
            res = c.get(f'/api/notifications/?unread={param}')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            data = res.data
            items = data['results'] if isinstance(data, dict) and 'results' in data else data
            titles = {item.get('title') for item in items}
            self.assertIn('u1', titles)
            self.assertNotIn('r1', titles)

    def test_mark_read_401(self):
        n = Notification.objects.create(
            user=User.objects.create_user('x_mr', 'x_mr@test.com', 'p'),
            title='t',
            message='m',
        )
        res = self.client.patch(f'/api/notifications/{n.pk}/read/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mark_read_404_wrong_user(self):
        owner = user_with_role(f'o_{uuid.uuid4().hex[:8]}', 'client')
        other = user_with_role(f'p_{uuid.uuid4().hex[:8]}', 'client')
        n = Notification.objects.create(user=owner, title='t', message='m')
        c = api_client_with_jwt(other)
        res = c.patch(f'/api/notifications/{n.pk}/read/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', res.data)

    def test_mark_read_200_idempotent(self):
        u = user_with_role(f'mk_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        n = Notification.objects.create(user=u, title='t', message='m', is_read=False)
        res = c.patch(f'/api/notifications/{n.pk}/read/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('status'), 'ok')
        n.refresh_from_db()
        self.assertTrue(n.is_read)
        res2 = c.patch(f'/api/notifications/{n.pk}/read/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

    def test_mark_all_read_401(self):
        res = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mark_all_read_200(self):
        u = user_with_role(f'ma_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        Notification.objects.create(user=u, title='a', message='m', is_read=False)
        Notification.objects.create(user=u, title='b', message='m', is_read=False)
        res = c.post('/api/notifications/mark-all-read/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('status'), 'ok')
        self.assertEqual(
            Notification.objects.filter(user=u, is_read=False).count(),
            0,
        )

    def test_preferences_list_get_post_401(self):
        res = self.client.get('/api/notifications/preferences/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        res2 = self.client.post('/api/notifications/preferences/', {'category': 'project'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_preferences_list_200_and_create(self):
        u = user_with_role(f'pr_{uuid.uuid4().hex[:8]}', 'client')
        c = api_client_with_jwt(u)
        res = c.get('/api/notifications/preferences/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res_p = c.post(
            '/api/notifications/preferences/',
            {'category': 'valuation', 'in_app': True, 'email': False, 'push': True},
            format='json',
        )
        self.assertEqual(res_p.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NotificationPreference.objects.filter(user=u, category='valuation').count(), 1)

    def test_preference_detail_404(self):
        u = user_with_role(f'pd_{uuid.uuid4().hex[:8]}', 'client')
        c = api_client_with_jwt(u)
        res = c.get('/api/notifications/preferences/999999/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_preference_detail_get_patch(self):
        u = user_with_role(f'pg_{uuid.uuid4().hex[:8]}', 'client')
        c = api_client_with_jwt(u)
        p = NotificationPreference.objects.create(
            user=u, category='document', in_app=True, email=False, push=False
        )
        res = c.get(f'/api/notifications/preferences/{p.pk}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data.get('category'), 'document')
        res2 = c.patch(
            f'/api/notifications/preferences/{p.pk}/',
            {'email': True},
            format='json',
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        p.refresh_from_db()
        self.assertTrue(p.email)

    def test_register_device_token_401_400_200(self):
        res = self.client.post(
            '/api/notifications/device-tokens/register/',
            {'platform': 'ios'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        u = user_with_role(f'dr_{uuid.uuid4().hex[:8]}', 'field_officer')
        c = api_client_with_jwt(u)
        bad = c.post('/api/notifications/device-tokens/register/', {}, format='json')
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', bad.data)
        ok = c.post(
            '/api/notifications/device-tokens/register/',
            {'token': 'fcm_token_abc', 'platform': 'ios'},
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(ok.data.get('status'), 'registered')
        self.assertTrue(DeviceToken.objects.filter(user=u, token='fcm_token_abc', platform='ios').exists())

    def test_unregister_device_token_401_and_idempotent_200(self):
        res = self.client.delete(
            '/api/notifications/device-tokens/unregister/',
            {'token': 'any'},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        u = user_with_role(f'du_{uuid.uuid4().hex[:8]}', 'client')
        c = api_client_with_jwt(u)
        DeviceToken.objects.create(user=u, token='tok_to_remove', platform='web')
        res2 = c.delete(
            '/api/notifications/device-tokens/unregister/',
            {'token': 'tok_to_remove'},
            format='json',
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data.get('status'), 'unregistered')
        self.assertFalse(DeviceToken.objects.filter(token='tok_to_remove').exists())
        res3 = c.delete(
            '/api/notifications/device-tokens/unregister/',
            {'token': 'tok_to_remove'},
            format='json',
        )
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
