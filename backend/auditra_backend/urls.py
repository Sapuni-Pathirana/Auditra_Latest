"""
URL configuration for auditra_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from authentication.views import ClientRegistrationView, EmployeeRegistrationView

# Test imports (removed emojis for Windows compatibility)
try:
    print("[INFO] Loading URL patterns...")
    print("[INFO] Testing authentication.urls import...")
    from authentication import urls as auth_urls
    print(f"[OK] Authentication URLs loaded: {len(auth_urls.urlpatterns)} patterns")
    
    print("[INFO] Testing attendance.urls import...")
    from attendance import urls as attendance_urls
    print(f"[OK] Attendance URLs loaded: {len(attendance_urls.urlpatterns)} patterns")
    
    print("[INFO] Testing projects.urls import...")
    from projects import urls as projects_urls
    print(f"[OK] Projects URLs loaded: {len(projects_urls.urlpatterns)} patterns")
    
    print("[INFO] Testing valuations.urls import...")
    from valuations import urls as valuations_urls
    print(f"[OK] Valuations URLs loaded: {len(valuations_urls.urlpatterns)} patterns")
    
except Exception as e:
    print(f"[ERROR] ERROR loading URLs: {e}")
    import traceback
    traceback.print_exc()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/clients/register/', ClientRegistrationView.as_view(), name='client-register'),
    path('api/employees/register/', EmployeeRegistrationView.as_view(), name='employee-register'),
    path('api/attendance/', include('attendance.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/valuations/', include('valuations.urls')),
    path('api/system-logs/', include('system_logs.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/standups/', include('standups.urls')),
    path('api/catalog/', include('catalog.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/', include('reports_v2.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
