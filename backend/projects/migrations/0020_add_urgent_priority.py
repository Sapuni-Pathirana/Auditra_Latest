from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0019_projectdocument_visible_to_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='project',
            name='priority',
            field=models.CharField(
                choices=[
                    ('urgent', 'Urgent'),
                    ('high', 'High'),
                    ('medium', 'Medium'),
                    ('low', 'Low'),
                ],
                default='medium',
                max_length=10,
            ),
        ),
    ]
