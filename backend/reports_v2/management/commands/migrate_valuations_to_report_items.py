"""One-shot management command: migrate existing Valuation rows into ReportItem.

Usage:
    python manage.py migrate_valuations_to_report_items [--dry-run]
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Migrate each existing Valuation into a ReportItem with merged_from_valuation set.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Print what would be created without writing.')

    def handle(self, *args, **options):
        from valuations.models import Valuation
        from reports_v2.models import ReportItem

        dry_run = options['dry_run']
        created = 0
        skipped = 0

        for v in Valuation.objects.select_related('project', 'field_officer').iterator():
            if ReportItem.objects.filter(merged_from_valuation=v).exists():
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f'  [DRY] Would create ReportItem for Valuation #{v.id} in Project #{v.project_id}')
                created += 1
                continue

            ReportItem.objects.create(
                project=v.project,
                created_by=v.field_officer,
                name=v.description or f'{v.get_category_display()} #{v.id}',
                category=v.category,
                description=v.notes or '',
                quantity=1,
                unit_value=v.estimated_value or 0,
                book_value=v.estimated_value,
                merged_from_valuation=v,
            )
            created += 1

        verb = 'Would create' if dry_run else 'Created'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {created} ReportItem(s), skipped {skipped} already-migrated.'
        ))
