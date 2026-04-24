from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('standups', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='StandupMessageView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('viewed_at', models.DateTimeField(auto_now_add=True)),
                ('message', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='views', to='standups.standupmessage')),
                ('viewer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seen_standup_messages', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'standup_message_views',
                'unique_together': {('message', 'viewer')},
            },
        ),
    ]
