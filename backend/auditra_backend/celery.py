"""Celery app configuration."""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auditra_backend.settings')

app = Celery('auditra_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Windows does not support Celery's default prefork pool reliably.
# Use solo pool by default on Windows unless explicitly overridden.
if os.name == 'nt':
    pool = os.getenv('CELERY_WORKER_POOL', '').strip().lower()
    if not pool:
        app.conf.worker_pool = 'solo'
        app.conf.worker_concurrency = 1

app.autodiscover_tasks()
