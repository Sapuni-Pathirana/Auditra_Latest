"""
Quick test script to verify endpoints can be imported
Run this to check for import errors
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auditra_backend.settings')
django.setup()

# Test imports
try:
    print("Testing imports...")
    from attendance import views
    print("✅ attendance.views imported successfully")
    
    from attendance.urls import urlpatterns
    print(f"✅ attendance.urls imported - {len(urlpatterns)} URL patterns found")
    
    from auditra_backend.urls import urlpatterns as root_urlpatterns
    print(f"✅ Root URLs imported - {len(root_urlpatterns)} URL patterns found")
    
    # Test specific views
    from attendance.views import TodayAttendanceView, MarkAttendanceView
    print("✅ TodayAttendanceView imported")
    print("✅ MarkAttendanceView imported")
    
    print("\n✅ All imports successful! Endpoints should work.")
    
except Exception as e:
    print(f"❌ Import error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)




































