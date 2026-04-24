"""Celery tasks for the projects app."""
from celery import shared_task
from django.core.management import call_command


@shared_task(name='projects.send_visit_reminders')
def send_visit_reminders_task():
    """Wrapper that invokes the `send_visit_reminders` management command.

    Scheduled daily via CELERY_BEAT_SCHEDULE (Feature #2 — visit reminders).
    """
    call_command('send_visit_reminders')
    return 'ok'
