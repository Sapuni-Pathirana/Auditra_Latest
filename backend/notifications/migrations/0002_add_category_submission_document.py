"""Add 'submission' and 'document' to Notification.CATEGORY_CHOICES (C1)."""
from django.db import migrations, models


CHOICES = [
    ('project', 'Project'),
    ('valuation', 'Valuation'),
    ('chat', 'Chat Mention'),
    ('visit', 'Site Visit'),
    ('payment', 'Payment'),
    ('account', 'Account'),
    ('leave', 'Leave'),
    ('attendance', 'Attendance'),
    ('submission', 'Form Submission'),
    ('document', 'Document'),
    ('general', 'General'),
]


class Migration(migrations.Migration):
    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='category',
            field=models.CharField(
                max_length=30,
                choices=CHOICES,
                default='general',
            ),
        ),
        migrations.AlterField(
            model_name='notificationpreference',
            name='category',
            field=models.CharField(max_length=30, choices=CHOICES),
        ),
    ]
