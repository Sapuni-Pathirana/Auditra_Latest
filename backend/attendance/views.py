from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import datetime, date, timedelta, time
from django.contrib.auth.models import User
from .models import Attendance, Holiday
from .serializers import (
    AttendanceSerializer,
    AttendanceSummarySerializer,
    HolidaySerializer
)


def _notify_attendance_action(user, title, message, action, extra_meta=None):
    """Best-effort in-app notification for attendance actions."""
    try:
        from notifications.services import notify
        meta = {'action': action}
        if extra_meta:
            meta.update(extra_meta)
        notify(
            user=user,
            category='attendance',
            severity='info',
            title=title,
            message=message,
            meta=meta,
            action_url='/attendance',
            email_subject=title,
        )
    except Exception:
        # Notifications should not block attendance operations.
        pass


class MarkAttendanceView(APIView):
    """Mark attendance (check-in) for the current day"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        now = timezone.now()
        today = now.date()
        user = request.user
        
        # Check if it's a working day
        if not Attendance.is_working_day(today):
            return Response({
                'error': 'Today is not a working day (Sunday or Holiday)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if it's within check-in window (6 AM - 8 AM)
        local_now = timezone.localtime(now)
        current_hour = local_now.hour
        
        if current_hour < 6 or current_hour >= 8:
            return Response({
                'error': f'Attendance can only be marked between 6 AM and 8 AM. Current time: {local_now.strftime("%I:%M %p")}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if attendance already marked
        attendance, created = Attendance.objects.get_or_create(
            user=user,
            date=today,
            defaults={
                'check_in': timezone.now(),
                'status': 'present'
            }
        )
        
        if not created:
            if attendance.check_in:
                return Response({
                    'error': 'Attendance already marked for today'
                }, status=status.HTTP_400_BAD_REQUEST)
            # If attendance exists but not checked in, and it's before 12 PM, allow marking
            attendance.check_in = timezone.now()
            attendance.status = 'present'
            attendance.save()
        
        serializer = AttendanceSerializer(attendance)

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='ATTENDANCE_CHECK_IN',
                user=user,
                description=f"Attendance marked (check-in) for {today}",
                category='attendance',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_attendance_action(
            user=user,
            title='Attendance Marked',
            message=f'You checked in on {today}.',
            action='check_in',
            extra_meta={'date': today.isoformat()},
        )

        return Response({
            'message': 'Attendance marked successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class LeaveEarlyView(APIView):
    """Mark early leave (check-out before 5 PM)"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        today = timezone.now().date()
        user = request.user
        
        try:
            attendance = Attendance.objects.get(user=user, date=today)
        except Attendance.DoesNotExist:
            return Response({
                'error': 'Please mark attendance first'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if attendance.check_out:
            return Response({
                'error': 'Already checked out for today'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark check-out
        attendance.check_out = timezone.now()
        attendance.save()  # This will calculate working hours and update status

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='ATTENDANCE_CHECK_OUT',
                user=user,
                description=f"Early leave marked for {today} (working hours: {attendance.working_hours})",
                category='attendance',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_attendance_action(
            user=user,
            title='Early Leave Recorded',
            message=f'You marked early leave on {today} ({attendance.working_hours} hours).',
            action='leave_early',
            extra_meta={
                'date': today.isoformat(),
                'working_hours': float(attendance.working_hours),
                'is_full_day': attendance.is_full_day(),
            },
        )

        serializer = AttendanceSerializer(attendance)
        return Response({
            'message': 'Early leave marked successfully',
            'data': serializer.data,
            'is_full_day': attendance.is_full_day(),
            'working_hours': float(attendance.working_hours)
        }, status=status.HTTP_200_OK)


class CheckOutView(APIView):
    """Regular check-out at 5 PM"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        today = timezone.now().date()
        user = request.user
        
        try:
            attendance = Attendance.objects.get(user=user, date=today)
        except Attendance.DoesNotExist:
            return Response({
                'error': 'Please mark attendance first'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if attendance.check_out:
            return Response({
                'error': 'Already checked out for today'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark check-out at 5 PM or current time if after 5 PM
        now = timezone.now()
        five_pm = timezone.make_aware(
            datetime.combine(today, time(17, 0))
        )
        
        attendance.check_out = min(now, five_pm)
        attendance.save()

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='ATTENDANCE_CHECK_OUT',
                user=user,
                description=f"Checked out for {today}",
                category='attendance',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_attendance_action(
            user=user,
            title='Checked Out',
            message=f'You checked out on {today}.',
            action='check_out',
            extra_meta={'date': today.isoformat()},
        )

        serializer = AttendanceSerializer(attendance)
        return Response({
            'message': 'Checked out successfully',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


class StartOvertimeView(APIView):
    """Start overtime work (from 5 PM to 8 AM next day, after checkout)"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        now = timezone.now()
        today = now.date()
        user = request.user
        
        try:
            attendance = Attendance.objects.get(user=user, date=today)
        except Attendance.DoesNotExist:
            return Response({
                'error': 'Please mark attendance first'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if user is absent - absentees cannot do overtime
        if attendance.status == 'absent':
            return Response({
                'error': 'Cannot start overtime. You are marked as absent for today.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if already checked out
        if not attendance.check_out:
            return Response({
                'error': 'Please check out first before starting overtime'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if overtime already started
        if attendance.overtime_start:
            return Response({
                'error': 'Overtime already started'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if it's within overtime window (5 PM to 8 AM next day)
        # Use local time (timezone-aware) for the check
        local_now = timezone.localtime(now)
        current_hour = local_now.hour
        is_overtime_allowed = current_hour >= 17 or current_hour < 8
        
        if not is_overtime_allowed:
            return Response({
                'error': f'Overtime can only start between 5 PM and 8 AM. Current time: {local_now.strftime("%I:%M %p")}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        attendance.overtime_start = now
        attendance.save()

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='ATTENDANCE_OVERTIME_START',
                user=user,
                description=f"Overtime started for {today}",
                category='attendance',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_attendance_action(
            user=user,
            title='Overtime Started',
            message=f'You started overtime on {today}.',
            action='overtime_start',
            extra_meta={'date': today.isoformat()},
        )

        serializer = AttendanceSerializer(attendance)
        return Response({
            'message': 'Overtime started successfully',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


class EndOvertimeView(APIView):
    """End overtime work"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        today = timezone.now().date()
        user = request.user
        
        try:
            attendance = Attendance.objects.get(user=user, date=today)
        except Attendance.DoesNotExist:
            return Response({
                'error': 'Attendance not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        if not attendance.overtime_start:
            return Response({
                'error': 'Overtime not started'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if attendance.overtime_end:
            return Response({
                'error': 'Overtime already ended'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        attendance.overtime_end = timezone.now()
        attendance.save()

        try:
            from system_logs.utils import log_action, get_client_ip
            log_action(
                action='ATTENDANCE_OVERTIME_END',
                user=user,
                description=f"Overtime ended for {today} (overtime hours: {attendance.overtime_hours})",
                category='attendance',
                ip_address=get_client_ip(request),
            )
        except Exception:
            pass
        _notify_attendance_action(
            user=user,
            title='Overtime Ended',
            message=f'You ended overtime on {today} ({attendance.overtime_hours} hours).',
            action='overtime_end',
            extra_meta={
                'date': today.isoformat(),
                'overtime_hours': float(attendance.overtime_hours),
            },
        )

        serializer = AttendanceSerializer(attendance)
        return Response({
            'message': 'Overtime ended successfully',
            'data': serializer.data,
            'overtime_hours': float(attendance.overtime_hours)
        }, status=status.HTTP_200_OK)


class TodayAttendanceView(APIView):
    """Get today's attendance status"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        now = timezone.now()
        today = now.date()
        user = request.user
        
        try:
            attendance = Attendance.objects.get(user=user, date=today)
            
            # Implementation of "Lazy" Auto Check-out
            # If it's past 5 PM and user hasn't checked out, auto check-out them at 5 PM
            local_now = timezone.localtime(now)
            if not attendance.check_out and local_now.hour >= 17:
                five_pm = timezone.make_aware(
                    datetime.combine(today, time(17, 0))
                )
                attendance.check_out = five_pm
                attendance.save()
            
            serializer = AttendanceSerializer(attendance)
            data = serializer.data
            
            # Add status flags for frontend buttons
            local_time = local_now.time()
            data['flags'] = {
                'can_check_in': local_time >= time(6, 0) and local_time < time(8, 0) and not attendance.check_in,
                'can_leave_early': attendance.check_in and not attendance.check_out and local_time < time(17, 0),
                'can_checkout': attendance.check_in and not attendance.check_out and local_time >= time(17, 0),
                'can_start_overtime': attendance.check_in and attendance.check_out and attendance.status != 'absent' and not attendance.overtime_start and (local_time >= time(17, 0) or local_time < time(8, 0)),
            }
            
            return Response({
                'success': True,
                'data': data
            }, status=status.HTTP_200_OK)
        except Attendance.DoesNotExist:
            # Check if it's a working day
            is_working_day = Attendance.is_working_day(today)
            
            # If it's after 8 AM and no attendance marked, auto-mark as absent
            if is_working_day:
                local_now = timezone.localtime(now)
                if local_now.hour >= 8:
                    # Auto-mark as absent
                    attendance = Attendance.objects.create(
                        user=user,
                        date=today,
                        status='absent'
                    )
                    serializer = AttendanceSerializer(attendance)
                    return Response({
                        'success': True,
                        'data': serializer.data
                    }, status=status.HTTP_200_OK)
            
            local_time = timezone.localtime(now).time()
            return Response({
                'success': False,
                'data': {
                    'flags': {
                        'can_check_in': is_working_day and local_time >= time(6, 0) and local_time < time(8, 0),
                        'can_leave_early': False,
                        'can_checkout': False,
                        'can_start_overtime': False,
                    }
                },
                'is_working_day': is_working_day,
                'message': 'Attendance not marked for today' if is_working_day else 'Today is not a working day'
            }, status=status.HTTP_200_OK)


class AttendanceSummaryView(APIView):
    """Get attendance summary (daily, weekly, monthly, yearly)"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        period = request.query_params.get('period', 'daily')  # daily, weekly, monthly, yearly
        user = request.user
        
        today = timezone.now().date()
        
        if period == 'daily':
            # Today's attendance
            try:
                attendance = Attendance.objects.get(user=user, date=today)
                data = {
                    'date': today,
                    'attendance': AttendanceSerializer(attendance).data,
                    'summary': {
                        'present': 1 if attendance.status == 'present' else 0,
                        'half_day': 1 if attendance.status == 'half_day' else 0,
                        'absent': 1 if attendance.status == 'absent' else 0,
                        'working_hours': float(attendance.working_hours),
                        'overtime_hours': float(attendance.overtime_hours),
                    }
                }
            except Attendance.DoesNotExist:
                data = {
                    'date': today,
                    'attendance': None,
                    'summary': {
                        'present': 0,
                        'half_day': 0,
                        'absent': 1,
                        'working_hours': 0.0,
                        'overtime_hours': 0.0,
                    }
                }
        
        elif period == 'weekly':
            # This week's attendance
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            
            attendances = Attendance.objects.filter(
                user=user,
                date__range=[week_start, week_end]
            )
            
            data = self._calculate_summary(attendances, week_start, week_end)
        
        elif period == 'monthly':
            # This month's attendance
            month_start = today.replace(day=1)
            if today.month == 12:
                month_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                month_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
            
            attendances = Attendance.objects.filter(
                user=user,
                date__range=[month_start, month_end]
            )
            
            data = self._calculate_summary(attendances, month_start, month_end)
        
        elif period == 'yearly':
            # This year's attendance
            year_start = today.replace(month=1, day=1)
            year_end = today.replace(month=12, day=31)
            
            attendances = Attendance.objects.filter(
                user=user,
                date__range=[year_start, year_end]
            )
            
            data = self._calculate_summary(attendances, year_start, year_end)
        
        else:
            return Response({
                'error': 'Invalid period. Use: daily, weekly, monthly, yearly'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'period': period,
            'data': data
        }, status=status.HTTP_200_OK)
    
    def _calculate_summary(self, attendances, start_date, end_date):
        """Calculate summary statistics for a date range"""
        total_days = (end_date - start_date).days + 1
        
        # Count working days (excluding Sundays and holidays)
        working_days = 0
        current_date = start_date
        holidays = set(Holiday.objects.filter(
            date__range=[start_date, end_date],
            is_active=True
        ).values_list('date', flat=True))
        
        while current_date <= end_date:
            if current_date.weekday() != 6 and current_date not in holidays:
                working_days += 1
            current_date += timedelta(days=1)
        
        present_count = attendances.filter(status='present').count()
        half_day_count = attendances.filter(status='half_day').count()
        absent_count = working_days - present_count - half_day_count
        
        total_working_hours = attendances.aggregate(
            total=Sum('working_hours')
        )['total'] or 0.0
        
        total_overtime_hours = attendances.aggregate(
            total=Sum('overtime_hours')
        )['total'] or 0.0
        
        attendance_percentage = 0.0
        if working_days > 0:
            attendance_percentage = ((present_count + half_day_count * 0.5) / working_days) * 100
        
        # Get daily breakdown for charts
        daily_data = []
        current_date = start_date
        while current_date <= end_date:
            if current_date.weekday() != 6 and current_date not in holidays:
                try:
                    att = attendances.get(date=current_date)
                    daily_data.append({
                        'date': current_date.isoformat(),
                        'status': att.status,
                        'check_in': att.check_in.isoformat() if att.check_in else None,
                        'check_out': att.check_out.isoformat() if att.check_out else None,
                        'working_hours': float(att.working_hours),
                        'overtime_hours': float(att.overtime_hours),
                    })
                except Attendance.DoesNotExist:
                    daily_data.append({
                        'date': current_date.isoformat(),
                        'status': 'absent',
                        'check_in': None,
                        'check_out': None,
                        'working_hours': 0.0,
                        'overtime_hours': 0.0,
                    })
            current_date += timedelta(days=1)
        
        return {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'total_days': total_days,
            'working_days': working_days,
            'summary': {
                'present': present_count,
                'half_day': half_day_count,
                'absent': absent_count,
                'total_working_hours': float(total_working_hours),
                'total_overtime_hours': float(total_overtime_hours),
                'attendance_percentage': round(float(attendance_percentage), 2),
            },
            'daily_data': daily_data
        }


class MyAttendancesView(generics.ListAPIView):
    """Get all attendances for the current user"""
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceSerializer
    
    def get_queryset(self):
        return Attendance.objects.filter(user=self.request.user).order_by('-date')


class WeeklyAttendanceSummaryView(APIView):
    """Get weekly attendance summary for all employees (HR Head only)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Check if user is HR Head
        from authentication.models import UserRole
        try:
            user_role = UserRole.objects.get(user=request.user)
            if user_role.role != 'hr_head':
                return Response({
                    'error': 'Only HR Head can access this endpoint'
                }, status=status.HTTP_403_FORBIDDEN)
        except UserRole.DoesNotExist:
            if not request.user.is_staff:
                return Response({
                    'error': 'User role not found and user is not a staff member'
                }, status=status.HTTP_403_FORBIDDEN)
        
        # Get week_start from query params or default to current Monday
        week_start_str = request.query_params.get('week_start')
        if not week_start_str:
            today = timezone.now().date()
            week_start = today - timedelta(days=today.weekday())
        else:
            try:
                week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({
                    'error': 'Invalid date format. Use YYYY-MM-DD'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate week end (6 days after week start)
        week_end = week_start + timedelta(days=6)
        
        # Get all employees with specific roles (excluding Admin)
        employee_roles = [
            'coordinator',
            'field_officer',
            'senior_valuer',
            'accessor',
            'md_gm',
            'general_employee'
        ]
        
        employee_users = User.objects.filter(
            role__role__in=employee_roles
        ).select_related('role')
        
        # Get holidays for the week
        holidays = set(Holiday.objects.filter(
            date__range=[week_start, week_end],
            is_active=True
        ).values_list('date', flat=True))
        
        # Calculate working days in the week
        working_days = 0
        current_date = week_start
        while current_date <= week_end:
            if current_date.weekday() != 6 and current_date not in holidays:  # Not Sunday and not holiday
                working_days += 1
            current_date += timedelta(days=1)
        
        # Get attendance data for all employees for this week
        attendances = Attendance.objects.filter(
            date__range=[week_start, week_end]
        ).select_related('user')
        
        # Build summary for each employee
        summary_data = []
        for user in employee_users:
            user_attendances = attendances.filter(user=user)
            
            # Count present, half_day, and absent
            present_count = user_attendances.filter(status='present').count()
            half_day_count = user_attendances.filter(status='half_day').count()
            absent_count = working_days - present_count - half_day_count
            
            # Calculate total overtime hours for the week
            total_overtime = user_attendances.aggregate(
                total=Sum('overtime_hours')
            )['total'] or 0.0
            
            # Calculate attendance percentage
            attendance_percentage = 0.0
            if working_days > 0:
                attendance_percentage = ((present_count + half_day_count * 0.5) / working_days) * 100
            
            # Get employee name
            employee_name = user.get_full_name() or user.username
            
            # Use User ID as Employee number
            employee_number = str(user.id)
            
            summary_data.append({
                'employee_name': employee_name,
                'employee_number': employee_number,
                'absent_days': absent_count,
                'half_days': half_day_count,
                'attendance_percentage': round(float(attendance_percentage), 2),
                'overtime_hours': round(float(total_overtime), 2),
            })
        
        # Sort by employee name
        summary_data.sort(key=lambda x: x['employee_name'])
        
        return Response({
            'success': True,
            'data': summary_data,
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'working_days': working_days,
        }, status=status.HTTP_200_OK)


class HRAttendanceSummaryView(APIView):
    """Get attendance summary for all employees - daily, weekly, or monthly (HR Head only)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from authentication.models import UserRole
        try:
            user_role = UserRole.objects.get(user=request.user)
            if user_role.role != 'hr_head':
                return Response({
                    'error': 'Only HR Head can access this endpoint'
                }, status=status.HTTP_403_FORBIDDEN)
        except UserRole.DoesNotExist:
            if not request.user.is_staff:
                return Response({
                    'error': 'User role not found and user is not a staff member'
                }, status=status.HTTP_403_FORBIDDEN)

        period = request.query_params.get('period', 'daily')
        today = timezone.now().date()

        if period == 'daily':
            start_date = today
            end_date = today
        elif period == 'weekly':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif period == 'monthly':
            start_date = today.replace(day=1)
            if today.month == 12:
                end_date = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                end_date = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
        else:
            return Response({
                'error': 'Invalid period. Use: daily, weekly, monthly'
            }, status=status.HTTP_400_BAD_REQUEST)

        employee_roles = [
            'coordinator', 'field_officer', 'senior_valuer',
            'accessor', 'md_gm', 'general_employee'
        ]
        employee_users = User.objects.filter(
            role__role__in=employee_roles
        ).select_related('role')

        holidays = set(Holiday.objects.filter(
            date__range=[start_date, end_date],
            is_active=True
        ).values_list('date', flat=True))

        working_days = 0
        current_date = start_date
        while current_date <= end_date:
            if current_date.weekday() != 6 and current_date not in holidays:
                working_days += 1
            current_date += timedelta(days=1)

        attendances = Attendance.objects.filter(
            date__range=[start_date, end_date]
        ).select_related('user')

        summary_data = []

        if period == 'daily':
            for user in employee_users:
                user_att = attendances.filter(user=user, date=today).first()
                employee_name = user.get_full_name() or user.username
                employee_number = str(user.id)

                if user_att:
                    summary_data.append({
                        'employee_name': employee_name,
                        'employee_number': employee_number,
                        'status': user_att.status,
                        'check_in': user_att.check_in.isoformat() if user_att.check_in else None,
                        'check_out': user_att.check_out.isoformat() if user_att.check_out else None,
                        'working_hours': round(float(user_att.working_hours), 2),
                        'overtime_hours': round(float(user_att.overtime_hours), 2),
                    })
                else:
                    is_working = today.weekday() != 6 and today not in holidays
                    summary_data.append({
                        'employee_name': employee_name,
                        'employee_number': employee_number,
                        'status': 'absent' if is_working else 'N/A',
                        'check_in': None,
                        'check_out': None,
                        'working_hours': 0.0,
                        'overtime_hours': 0.0,
                    })
        else:
            for user in employee_users:
                user_attendances = attendances.filter(user=user)
                present_count = user_attendances.filter(status='present').count()
                half_day_count = user_attendances.filter(status='half_day').count()
                absent_count = max(0, working_days - present_count - half_day_count)

                total_overtime = user_attendances.aggregate(
                    total=Sum('overtime_hours')
                )['total'] or 0.0

                attendance_percentage = 0.0
                if working_days > 0:
                    attendance_percentage = ((present_count + half_day_count * 0.5) / working_days) * 100

                employee_name = user.get_full_name() or user.username
                employee_number = str(user.id)

                summary_data.append({
                    'employee_name': employee_name,
                    'employee_number': employee_number,
                    'present_days': present_count,
                    'absent_days': absent_count,
                    'half_days': half_day_count,
                    'overtime_hours': round(float(total_overtime), 2),
                    'attendance_percentage': round(float(attendance_percentage), 2),
                })

        summary_data.sort(key=lambda x: x['employee_name'])

        return Response({
            'success': True,
            'data': summary_data,
            'period': period,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'working_days': working_days,
        }, status=status.HTTP_200_OK)