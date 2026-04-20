from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0017_alter_project_admin_approval_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='projectpayment',
            name='gateway_order_id',
            field=models.CharField(blank=True, help_text='Gateway order reference used for PayHere checkout', max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='projectpayment',
            name='gateway_paid_at',
            field=models.DateTimeField(blank=True, help_text='Timestamp when the gateway payment was confirmed', null=True),
        ),
        migrations.AddField(
            model_name='projectpayment',
            name='gateway_payment_data',
            field=models.JSONField(blank=True, help_text='Raw PayHere callback or initiation payload for auditing', null=True),
        ),
        migrations.AddField(
            model_name='projectpayment',
            name='gateway_payment_id',
            field=models.CharField(blank=True, help_text='Gateway transaction reference returned by PayHere', max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='projectpayment',
            name='gateway_status',
            field=models.CharField(blank=True, help_text='Latest gateway status such as initiated, paid, cancelled, or failed', max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='projectpayment',
            name='payment_method',
            field=models.CharField(choices=[('bank_slip', 'Bank Slip'), ('payhere', 'PayHere')], default='bank_slip', help_text='How the client completed or intends to complete the payment', max_length=20),
        ),
    ]