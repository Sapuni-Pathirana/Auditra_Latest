"""
Management command: send visit reminders.
Run daily via cron or celery-beat:
  python manage.py send_visit_reminders
"""
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from projects.models import ProjectVisit


class Command(BaseCommand):
    help = 'Send visit reminders for upcoming scheduled visits (3, 2, 1 day before and on the day)'

    def handle(self, *args, **options):
        from notifications.services import notify
        today = date.today()
        reminder_offsets = [0, 1, 2, 3]  # days before visit

        for offset in reminder_offsets:
            target_date = today + timedelta(days=offset)
            visits = ProjectVisit.objects.filter(
                scheduled_date=target_date,
                status='scheduled',
            ).select_related('project', 'field_officer', 'project__assigned_client', 'project__assigned_agent', 'project__coordinator')

            for visit in visits:
                project = visit.project
                fo_name = visit.field_officer.get_full_name() or visit.field_officer.username

                if offset == 0:
                    msg = f'REMINDER: Field Officer {fo_name} is visiting your site TODAY for project "{project.title}".'
                    title = f'Site Visit TODAY — {project.title}'
                else:
                    msg = f'REMINDER: Field Officer {fo_name} will visit your site in {offset} day(s) on {visit.scheduled_date} for project "{project.title}".'
                    title = f'Site Visit in {offset} day(s) — {project.title}'

                meta = {'project_id': project.id, 'visit_id': visit.id}
                for u in [project.assigned_client, project.assigned_agent, project.coordinator]:
                    if u:
                        notify(
                            user=u, category='visit', severity='info',
                            title=title, message=msg, meta=meta,
                            action_url=f'/dashboard/projects/{project.id}',
                            email_subject=title,
                        )

        self.stdout.write(self.style.SUCCESS('Visit reminders sent.'))
