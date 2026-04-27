#!/usr/bin/env python
"""
Test script to verify email configuration and sending
Run: python email_manual_check.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auditra_backend.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings
from authentication.services import EmailService

print("=" * 50)
print("Email Configuration Test")
print("=" * 50)
print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
print(f"EMAIL_HOST_PASSWORD: {'*' * len(settings.EMAIL_HOST_PASSWORD) if settings.EMAIL_HOST_PASSWORD else 'NOT SET'}")
print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
print("=" * 50)

# Test email sending
test_email = "test@example.com"  # Change this to your test email
print(f"\nAttempting to send test email to {test_email}...")

try:
    result = EmailService.send_account_credentials(
        email=test_email,
        username="testuser",
        password="testpass123",
        user_type="client",
        name="Test User"
    )
    if result:
        print("✅ Email sent successfully!")
    else:
        print("❌ Email sending returned False")
except Exception as e:
    print(f"❌ Error sending email: {e}")
    import traceback
    traceback.print_exc()

print("=" * 50)

