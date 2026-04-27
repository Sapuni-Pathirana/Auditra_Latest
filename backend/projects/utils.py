"""
Utility functions for project creation and user management
"""
import secrets
import string
import re
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from authentication.models import UserRole, Invitation
from authentication.services import EmailService


def generate_username_from_name(name):
    """
    Generate username from name (e.g., "John Doe" -> "john.doe")
    Handles duplicates by appending numbers
    
    Args:
        name: Full name string
        
    Returns:
        Unique username
    """
    if not name:
        return None
    
    # Clean and normalize name
    name = name.strip().lower()
    # Replace spaces and special characters with dots
    name = re.sub(r'[^a-z0-9\s]', '', name)
    # Replace multiple spaces with single space
    name = re.sub(r'\s+', ' ', name)
    # Split into parts
    parts = name.split()
    
    if len(parts) == 0:
        return None
    elif len(parts) == 1:
        base_username = parts[0]
    else:
        # Use first name and last name
        base_username = f"{parts[0]}.{parts[-1]}"
    
    # Check for duplicates and append number if needed
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
    
    return username


def generate_secure_password(length=12):
    """
    Generate a cryptographically secure random password
    
    Args:
        length: Length of password (default: 12)
        
    Returns:
        Secure random password string
    """
    # Use a mix of uppercase, lowercase, digits, and special characters
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


def check_user_by_email(email):
    """
    Check if a user exists by email address
    
    Args:
        email: Email address to check
        
    Returns:
        User object if exists, None otherwise
    """
    if not email:
        return None
    
    try:
        return User.objects.get(email=email.lower().strip())
    except User.DoesNotExist:
        return None
    except User.MultipleObjectsReturned:
        # Handle edge case of duplicate emails
        return User.objects.filter(email=email.lower().strip()).first()


def create_user_account(email, name, role_type, phone=None, address=None, company=None):
    """
    Create a new user account with the specified role
    
    Args:
        email: User's email address
        name: User's full name
        role_type: 'client' or 'agent'
        phone: Phone number (optional)
        address: Address (optional)
        company: Company name (optional)
        
    Returns:
        Tuple of (user, password) if successful, (None, None) otherwise
    """
    if not email or not name:
        return None, None
    
    # Check if user already exists
    existing_user = check_user_by_email(email)
    if existing_user:
        return existing_user, None
    
    # Generate username from name
    username = generate_username_from_name(name)
    if not username:
        return None, None
    
    # Generate secure password
    password = generate_secure_password()
    
    # Split name into first and last
    name_parts = name.strip().split()
    first_name = name_parts[0] if name_parts else ''
    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
    
    try:
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email.lower().strip(),
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=True
        )

        # Explicitly fetch the role created by the post_save signal
        # to avoid Django OneToOneField reverse-cache issues
        user_role = UserRole.objects.get(user=user)
        user_role.role = role_type
        user_role.password_changed = False
        user_role.save()

        # Verify the account credentials work
        verified = authenticate(username=username, password=password)
        if verified is None:
            user.set_password(password)
            user.save(update_fields=['password'])

        # Feature #6 (C4): record invitation with invited_by (from calling context)
        try:
            from authentication.models import Invitation
            Invitation.objects.update_or_create(
                email=email.lower().strip(),
                defaults={
                    'user': user,
                    'role': role_type,
                    'status': 'sent',
                },
            )
        except Exception:
            pass

        return user, password
    except Exception as e:
        print(f"Error creating user account: {str(e)}")
        return None, None


def process_client_for_project(project, client_info, invited_by=None):
    """
    Process client information for project creation
    - Check if client exists by email, assign if exists
    - Create new account if doesn't exist
    - Send email with credentials if new account created
    
    Args:
        project: Project instance
        client_info: Dictionary with client information (name, email, phone, address, company)
        
    Returns:
        Tuple of (client_user, was_created, error_message)
    """
    if not client_info or not client_info.get('email'):
        return None, False, "Client email is required"
    
    email = client_info.get('email')
    name = client_info.get('name', '')
    
    # Check if client exists
    existing_user = check_user_by_email(email)
    
    if existing_user:
        # Check if user has client role
        if hasattr(existing_user, 'role') and existing_user.role.role == 'client':
            project.assigned_client = existing_user
            project.save()
            return existing_user, False, None
        else:
            # User exists but doesn't have client role
            return None, False, f"User with email {email} exists but is not a client"
    
    # Create new client account
    user, password = create_user_account(
        email=email,
        name=name,
        role_type='client',
        phone=client_info.get('phone'),
        address=client_info.get('address'),
        company=client_info.get('company')
    )
    
    if user:
        # Assign to project
        project.assigned_client = user
        project.save()

        # Send email with credentials
        print(f"[CLIENT_EMAIL] Attempting to send credentials to {email} for user {user.username}")
        email_sent = EmailService.send_account_credentials(
            email=email,
            username=user.username,
            password=password,
            user_type='client',
            name=name,
            role='Client',
            salary=UserRole.ROLE_SALARIES.get('client', 0)
        )
        if email_sent:
            print(f"[CLIENT_EMAIL] Successfully sent credentials to {email}")
        else:
            print(f"[CLIENT_EMAIL] FAILED to send credentials to {email}")

        # Track invitation for admin Invitations page.
        try:
            Invitation.objects.update_or_create(
                email=(email or '').lower(),
                defaults={
                    'user': user,
                    'role': 'client',
                    'status': 'sent',
                    'invited_by': invited_by,
                },
            )
        except Exception:
            pass


        return user, True, None
    else:
        return None, False, "Failed to create client account"


def process_agent_for_project(project, agent_info, invited_by=None):
    """
    Process agent information for project creation
    - Check if agent exists by email, assign if exists
    - Create new account if doesn't exist
    - Send email with credentials if new account created
    
    Args:
        project: Project instance
        agent_info: Dictionary with agent information (name, email, phone, address, license_number)
        
    Returns:
        Tuple of (agent_user, was_created, error_message)
    """
    if not agent_info or not agent_info.get('email'):
        return None, False, "Agent email is required"
    
    email = agent_info.get('email')
    name = agent_info.get('name', '')
    
    # Check if agent exists
    existing_user = check_user_by_email(email)
    
    if existing_user:
        # Check if user has agent role
        if hasattr(existing_user, 'role') and existing_user.role.role == 'agent':
            project.assigned_agent = existing_user
            project.save()
            return existing_user, False, None
        else:
            # User exists but doesn't have agent role
            return None, False, f"User with email {email} exists but is not an agent"
    
    # Create new agent account
    user, password = create_user_account(
        email=email,
        name=name,
        role_type='agent',
        phone=agent_info.get('phone'),
        address=agent_info.get('address')
    )
    
    if user:
        # Assign to project
        project.assigned_agent = user
        project.save()

        # Send email with credentials
        EmailService.send_account_credentials(
            email=email,
            username=user.username,
            password=password,
            user_type='agent',
            name=name,
            role='Agent',
            salary=UserRole.ROLE_SALARIES.get('agent', 0)
        )

        # Track invitation for admin Invitations page.
        try:
            Invitation.objects.update_or_create(
                email=(email or '').lower(),
                defaults={
                    'user': user,
                    'role': 'agent',
                    'status': 'sent',
                    'invited_by': invited_by,
                },
            )
        except Exception:
            pass

        return user, True, None
    else:
        return None, False, "Failed to create agent account"

