"""
Email service for sending account credentials and notifications
"""
import logging
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SendGrid API"""

    @staticmethod
    def send_account_credentials(email, username, password, user_type, name=None, role=None, salary=None):
        """
        Send account credentials to newly created user

        Args:
            email: Recipient email address
            username: Username for login
            password: System-generated password
            user_type: 'client', 'agent', or 'employee'
            name: User's name (optional)
            role: Role display name (optional, e.g. 'Client', 'Field Officer')
            salary: Basic salary amount (optional)
        """
        type_map = {'client': 'Client', 'agent': 'Agent', 'employee': 'Employee'}
        user_type_display = type_map.get(user_type, user_type.title() if user_type else 'User')
        recipient_name = name if name else user_type_display

        login_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173') + '/login'

        subject = f'Welcome to Auditra - Your {user_type_display} Account Credentials'

        # Build detail rows
        detail_rows = f"""
                        <p style="margin: 10px 0;"><strong>Name:</strong> {recipient_name}</p>
                        <p style="margin: 10px 0;"><strong>Username:</strong> {username}</p>
                        <p style="margin: 10px 0;"><strong>Password:</strong> {password}</p>"""

        if role:
            detail_rows += f"""
                        <p style="margin: 10px 0;"><strong>Role:</strong> {role}</p>"""

        if salary is not None and salary > 0:
            detail_rows += f"""
                        <p style="margin: 10px 0;"><strong>Basic Salary:</strong> Rs. {salary:,.2f}</p>"""

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Welcome to Auditra</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {recipient_name},</p>
                    <p>Your {user_type_display.lower()} account has been created for the Auditra system. You can now log in using the credentials below:</p>

                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0;">
                        {detail_rows}
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{login_url}" style="display: inline-block; background-color: #1565C0; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Login to System</a>
                    </div>

                    <p style="color: #d9534f; font-weight: bold;">Important: Please keep these credentials secure.</p>
                    <p>For your security, you will be required to change your password after your first login.</p>

                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Plain text version
        role_line = f"\nRole: {role}" if role else ""
        salary_line = f"\nBasic Salary: Rs. {salary:,.2f}" if salary and salary > 0 else ""
        plain_message = f"""
Dear {recipient_name},

Your {user_type_display.lower()} account has been created for the Auditra system. You can now log in using the credentials below:

Name: {recipient_name}
Username: {username}
Password: {password}{role_line}{salary_line}

Login here: {login_url}

IMPORTANT: Please keep these credentials secure.

For your security, you will be required to change your password after your first login.

Best regards,
The Auditra Team

---
This is an automated message. Please do not reply to this email.
        """

        try:
            logger.info(f"Attempting to send credentials email to {email} for {user_type} {username}")

            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(f"Successfully sent credentials email to {email} for {user_type} {username}")
            return True
        except Exception as e:
            logger.error(f"Error sending email to {email}: {str(e)}", exc_info=True)
            return False

    @staticmethod
    def send_submission_confirmation(email, name, submission_type, project_title=None):
        """
        Send confirmation email when a form submission is received.

        Args:
            email: Recipient email address
            name: Submitter's name
            submission_type: 'client', 'agent', or 'employee'
            project_title: Project title (for client submissions)
        """
        type_map = {'client': 'Client Registration', 'agent': 'Agent', 'employee': 'Employee Application'}
        type_display = type_map.get(submission_type, 'Registration')
        recipient_name = name or 'Applicant'

        subject = f'Auditra - {type_display} Submission Received'

        project_line = ''
        if project_title:
            project_line = f'<p style="margin: 10px 0;"><strong>Project:</strong> {project_title}</p>'

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Submission Received</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {recipient_name},</p>
                    <p>Thank you for submitting your {type_display.lower()} form. We have received your submission and it is currently under review.</p>
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Submission Type:</strong> {type_display}</p>
                        {project_line}
                        <p style="margin: 10px 0;"><strong>Status:</strong> Pending Review</p>
                    </div>
                    <p>Our team will review your submission and you will be notified via email once it has been processed.</p>
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        project_text = f"\nProject: {project_title}" if project_title else ""
        plain_message = f"""
Dear {recipient_name},

Thank you for submitting your {type_display.lower()} form. We have received your submission and it is currently under review.

Submission Type: {type_display}{project_text}
Status: Pending Review

Our team will review your submission and you will be notified via email once it has been processed.

Best regards,
The Auditra Team
        """

        try:
            logger.info(f'Sending submission confirmation to {email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending submission confirmation to {email}: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_status_update(submission, new_status, coordinator_name=None):
        """Send status update email to client and agent when submission status changes."""
        status_display = dict(submission.STATUS_CHOICES).get(new_status, new_status).title()
        recipients = [submission.email]
        if submission.agent_email:
            recipients.append(submission.agent_email)

        subject = f'Auditra - Submission Status Update: {status_display}'

        coordinator_line = ''
        if new_status == 'assigned' and coordinator_name:
            coordinator_line = f'<p style="margin: 10px 0;"><strong>Assigned Coordinator:</strong> {coordinator_name}</p>'

        client_name = submission.first_name or 'Client'

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Submission Status Update</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {client_name},</p>
                    <p>Your submission for project <strong>{submission.project_title}</strong> has been updated.</p>
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>New Status:</strong> {status_display}</p>
                        {coordinator_line}
                    </div>
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        plain_message = f'Your submission for {submission.project_title} status: {status_display}'

        try:
            logger.info(f'Sending status update email to {recipients}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending status update email: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_employee_status_update(submission, new_status):
        """Send status update email to employee applicant when submission status changes."""
        status_display = dict(submission.STATUS_CHOICES).get(new_status, new_status).title()
        applicant_name = f'{submission.first_name or ""} {submission.last_name or ""}'.strip() or 'Applicant'

        if not submission.email:
            return False

        subject = f'Auditra - Application Status Update: {status_display}'

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Application Status Update</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {applicant_name},</p>
                    <p>Your employee application at Auditra has been updated.</p>
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>New Status:</strong> {status_display}</p>
                    </div>
                    <p>If you have any questions, please contact our HR team.</p>
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        plain_message = f'Dear {applicant_name}, your employee application status has been updated to: {status_display}.'

        try:
            logger.info(f'Sending employee status update email to {submission.email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[submission.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending employee status update email: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_project_assignment_notification(email, name, project_title, role_in_project, coordinator_name=None):
        """
        Send email notification when a user is assigned to a project.

        Args:
            email: Recipient email
            name: Recipient name
            project_title: Title of the project
            role_in_project: Their role in the project (e.g. 'Client', 'Agent')
            coordinator_name: Name of the coordinator (optional)
        """
        recipient_name = name or 'User'

        subject = f'Auditra - You Have Been Assigned to a Project'

        coordinator_line = ''
        if coordinator_name:
            coordinator_line = f'<p style="margin: 10px 0;"><strong>Coordinator:</strong> {coordinator_name}</p>'

        login_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173') + '/login'

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Project Assignment</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {recipient_name},</p>
                    <p>You have been assigned to a new project on the Auditra system.</p>
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Project:</strong> {project_title}</p>
                        <p style="margin: 10px 0;"><strong>Your Role:</strong> {role_in_project}</p>
                        {coordinator_line}
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{login_url}" style="display: inline-block; background-color: #1565C0; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">View Project</a>
                    </div>
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        plain_message = f"""
Dear {recipient_name},

You have been assigned to a new project on the Auditra system.

Project: {project_title}
Your Role: {role_in_project}
{f'Coordinator: {coordinator_name}' if coordinator_name else ''}

Login to view the project: {login_url}

Best regards,
The Auditra Team
        """

        try:
            logger.info(f'Sending project assignment notification to {email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending project assignment email to {email}: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_otp_email(email, otp):
        """Send OTP code for password reset."""
        subject = 'Auditra - Password Reset OTP'

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Password Reset</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>You requested a password reset for your Auditra account.</p>
                    <p>Use the following OTP code to reset your password:</p>
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0; text-align: center;">
                        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #1565C0;">{otp}</p>
                    </div>
                    <p style="color: #d9534f; font-weight: bold;">This code expires in 10 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        plain_message = f"Your Auditra password reset OTP is: {otp}\nThis code expires in 10 minutes."

        try:
            logger.info(f'Sending OTP email to {email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending OTP email to {email}: {str(e)}', exc_info=True)
            return False
    @staticmethod
    def send_assignment_rejection_to_admin(submission, coordinator, rejection_reason):
        """Send notification to admin when coordinator rejects an assignment"""
        from django.contrib.auth.models import User
        
        # Get all admin users
        admin_users = User.objects.filter(role__role='admin', is_active=True)
        admin_emails = [admin.email for admin in admin_users if admin.email]
        
        if not admin_emails:
            logger.warning('No admin emails found to send rejection notification')
            return False
        
        coordinator_name = f"{coordinator.first_name} {coordinator.last_name}".strip() or coordinator.username
        client_name = f"{submission.first_name} {submission.last_name}".strip() or 'Unknown Client'
        
        subject = f'Auditra - Coordinator Rejected Assignment: {submission.project_title}'
        
        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Assignment Rejected</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear Admin,</p>
                    <p>A coordinator has rejected their assignment. Please reassign a new coordinator.</p>
                    
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #DC2626; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Project:</strong> {submission.project_title}</p>
                        <p style="margin: 10px 0;"><strong>Client:</strong> {client_name}</p>
                        <p style="margin: 10px 0;"><strong>Coordinator:</strong> {coordinator_name}</p>
                        <p style="margin: 10px 0;"><strong>Rejection Reason:</strong></p>
                        <p style="margin: 10px 0; padding: 10px; background-color: #FEF2F2; border-radius: 4px;">{rejection_reason}</p>
                    </div>
                    
                    <p style="color: #d9534f; font-weight: bold;">Action Required: Please log in to the admin dashboard and assign a new coordinator to this submission.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_message = f"""
Coordinator Rejected Assignment

Project: {submission.project_title}
Client: {client_name}
Coordinator: {coordinator_name}
Rejection Reason: {rejection_reason}

Please log in to the admin dashboard and assign a new coordinator to this submission.
        """
        
        try:
            logger.info(f'Sending rejection notification to admins: {admin_emails}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=admin_emails,
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending rejection notification: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_payment_request_to_client(project, client, estimated_value, payment_instructions=None):
        """Send payment request email to client"""
        if not client.email:
            logger.warning(f'Client {client.username} has no email address')
            return False
        
        client_name = f"{client.first_name} {client.last_name}".strip() or client.username
        
        subject = f'Auditra - Payment Required for Project: {project.title}'
        
        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #4A90E2; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Payment Request</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {client_name},</p>
                    <p>Your project <strong>{project.title}</strong> is ready to proceed. Please make the payment to continue.</p>
                    
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #4A90E2; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Project:</strong> {project.title}</p>
                        <p style="margin: 5px 0;"><strong>Description:</strong> {project.description or 'N/A'}</p>
                    </div>
                    
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #16A34A; margin: 20px 0;">
                        <p style="margin: 10px 0; font-size: 24px; color: #16A34A; font-weight: bold;">
                            Amount: Rs. {estimated_value:,.2f}
                        </p>
                    </div>
                    
                    <p>Please log in to your dashboard to view payment details and upload your bank slip after making the payment.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_message = f"""
Payment Request for Project: {project.title}

Dear {client_name},

Your project is ready to proceed. Please make the payment to continue.

Project: {project.title}
Description: {project.description or 'N/A'}

Amount: Rs. {estimated_value:,.2f}

Please log in to your dashboard to view payment details and upload your bank slip after making the payment.

Best regards,
The Auditra Team
        """
        
        try:
            logger.info(f'Sending payment request to client: {client.email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[client.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending payment request: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_payment_approved_to_client(project, client):
        """Send payment approval confirmation to client"""
        if not client.email:
            logger.warning(f'Client {client.username} has no email address')
            return False
        
        client_name = f"{client.first_name} {client.last_name}".strip() or client.username
        
        subject = f'Auditra - Payment Approved: {project.title}'
        
        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #16A34A; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Payment Approved!</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {client_name},</p>
                    <p>Great news! Your payment for project <strong>{project.title}</strong> has been approved.</p>
                    
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #16A34A; margin: 20px 0; text-align: center;">
                        <p style="margin: 10px 0; font-size: 18px; color: #16A34A; font-weight: bold;">
                            ✓ Payment Verified Successfully
                        </p>
                    </div>
                    
                    <p>Your project will now proceed to the next stage. You will receive updates on the progress of your project.</p>
                    
                    <p>You can log in to your dashboard to track the project status.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_message = f"""
Payment Approved!

Dear {client_name},

Great news! Your payment for project "{project.title}" has been approved.

Your project will now proceed to the next stage. You will receive updates on the progress of your project.

You can log in to your dashboard to track the project status.

Best regards,
The Auditra Team
        """
        
        try:
            logger.info(f'Sending payment approval to client: {client.email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[client.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending payment approval: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_payment_rejected_to_client(project, client, rejection_reason):
        """Send payment rejection notification to client"""
        if not client.email:
            logger.warning(f'Client {client.username} has no email address')
            return False
        
        client_name = f"{client.first_name} {client.last_name}".strip() or client.username
        
        subject = f'Auditra - Payment Review Update: {project.title}'
        
        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #D97706; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Payment Requires Attention</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {client_name},</p>
                    <p>We have reviewed your payment submission for project <strong>{project.title}</strong>. Unfortunately, we were unable to verify the payment at this time.</p>
                    
                    <div style="background-color: white; padding: 20px; border-left: 4px solid #D97706; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Reason:</strong></p>
                        <p style="margin: 10px 0; padding: 10px; background-color: #FFFBEB; border-radius: 4px;">{rejection_reason}</p>
                    </div>
                    
                    <p style="color: #d9534f; font-weight: bold;">
                        Action Required: Please log in to your dashboard and upload a new/corrected bank slip.
                    </p>
                    
                    <p>If you have any questions, please contact our support team.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_message = f"""
Payment Requires Attention

Dear {client_name},

We have reviewed your payment submission for project "{project.title}". Unfortunately, we were unable to verify the payment at this time.

Reason: {rejection_reason}

Action Required: Please log in to your dashboard and upload a new/corrected bank slip.

If you have any questions, please contact our support team.

Best regards,
The Auditra Team
        """
        
        try:
            logger.info(f'Sending payment rejection to client: {client.email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[client.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending payment rejection: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_cancellation_notification(project, user, is_approved, reason, admin_remarks=''):
        """Send notification about project cancellation decision"""
        if not user.email:
            logger.warning(f'User {user.username} has no email address')
            return False
        
        user_name = f"{user.first_name} {user.last_name}".strip() or user.username
        
        if is_approved:
            subject = f'Auditra - Project Cancelled: {project.title}'
            status_color = '#DC2626'
            status_text = 'has been cancelled'
            header_text = 'Project Cancelled'
        else:
            subject = f'Auditra - Cancellation Request Rejected: {project.title}'
            status_color = '#D97706'
            status_text = 'cancellation request has been rejected'
            header_text = 'Cancellation Rejected'
        
        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: {status_color}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">{header_text}</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {user_name},</p>
                    <p>This is to inform you that the project <strong>{project.title}</strong> {status_text}.</p>
                    
                    <div style="background-color: white; padding: 20px; border-left: 4px solid {status_color}; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Cancellation Reason:</strong></p>
                        <p style="margin: 10px 0; padding: 10px; background-color: #FEF2F2; border-radius: 4px;">{reason}</p>
                        {f'<p style="margin: 10px 0;"><strong>Admin Remarks:</strong></p><p style="margin: 10px 0; padding: 10px; background-color: #F3F4F6; border-radius: 4px;">{admin_remarks}</p>' if admin_remarks else ''}
                    </div>
                    
                    {'<p style="color: #DC2626; font-weight: bold;">All work on this project has been stopped.</p>' if is_approved else '<p>The project will continue as normal.</p>'}
                    
                    <p>If you have any questions, please contact the administrator.</p>
                    
                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_message = f"""
{header_text}

Dear {user_name},

This is to inform you that the project "{project.title}" {status_text}.

Cancellation Reason: {reason}
{f"Admin Remarks: {admin_remarks}" if admin_remarks else ""}

{"All work on this project has been stopped." if is_approved else "The project will continue as normal."}

If you have any questions, please contact the administrator.

Best regards,
The Auditra Team
        """
        
        try:
            logger.info(f'Sending cancellation notification to: {user.email}')
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            logger.error(f'Error sending cancellation notification: {str(e)}', exc_info=True)
            return False

    @staticmethod
    def send_commission_report_to_agent(report, agent, project):
        """Send commission report PDF to agent via email"""
        if not agent.email:
            logger.warning(f'Agent {agent.username} has no email address')
            return False

        agent_name = f"{agent.first_name} {agent.last_name}".strip() or agent.username

        subject = f'Auditra - Commission Report: {project.title}'

        html_message = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1565C0; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                    <h1 style="margin: 0;">Commission Report</h1>
                </div>
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px;">
                    <p>Dear {agent_name},</p>
                    <p>Your commission report for the project <strong>{project.title}</strong> is ready.</p>

                    <div style="background-color: white; padding: 20px; border-left: 4px solid #1565C0; margin: 20px 0;">
                        <p style="margin: 10px 0;"><strong>Project:</strong> {project.title}</p>
                        <p style="margin: 10px 0; font-size: 20px; color: #16A34A; font-weight: bold;">
                            Commission: Rs. {report.commission_amount:,.2f}
                        </p>
                    </div>

                    <p>The commission report PDF is attached to this email. You can also view and download it from your dashboard.</p>

                    <p style="margin-top: 30px;">Best regards,<br>The Auditra Team</p>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        plain_message = f"""
Commission Report

Dear {agent_name},

Your commission report for the project "{project.title}" is ready.

Project: {project.title}
Commission: Rs. {report.commission_amount:,.2f}

The commission report PDF is attached to this email. You can also view and download it from your dashboard.

Best regards,
The Auditra Team
        """

        try:
            from django.core.mail import EmailMultiAlternatives

            logger.info(f'Sending commission report to agent: {agent.email}')

            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[agent.email],
            )
            email_msg.attach_alternative(html_message, 'text/html')

            # Attach the PDF file
            if report.report_file:
                report.report_file.open('rb')
                pdf_content = report.report_file.read()
                report.report_file.close()
                email_msg.attach(
                    f'commission_report_{project.title}.pdf',
                    pdf_content,
                    'application/pdf'
                )

            email_msg.send(fail_silently=False)
            return True
        except Exception as e:
            logger.error(f'Error sending commission report to {agent.email}: {str(e)}', exc_info=True)
            return False