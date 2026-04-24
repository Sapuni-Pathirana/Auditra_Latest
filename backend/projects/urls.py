from django.urls import path
from . import views

app_name = 'projects'

urlpatterns = [
    path('', views.ProjectListView.as_view(), name='project-list'),
    path('check-email/', views.CheckUserByEmailView.as_view(), name='check-email'),
    path('<int:pk>/', views.ProjectDetailView.as_view(), name='project-detail'),
    path('<int:project_id>/assign-field-officer/', views.AssignFieldOfficerView.as_view(), name='assign-field-officer'),
    path('<int:project_id>/assign-client/', views.AssignClientView.as_view(), name='assign-client'),
    path('<int:project_id>/assign-agent/', views.AssignAgentView.as_view(), name='assign-agent'),
    path('<int:project_id>/assign-accessor/', views.AssignAccessorView.as_view(), name='assign-accessor'),
    path('<int:project_id>/assign-senior-valuer/', views.AssignSeniorValuerView.as_view(), name='assign-senior-valuer'),
    path('field-officers/', views.AvailableFieldOfficersView.as_view(), name='available-field-officers'),
    path('clients/', views.AvailableClientsView.as_view(), name='available-clients'),
    path('agents/', views.AvailableAgentsView.as_view(), name='available-agents'),
    path('accessors/', views.AvailableAccessorsView.as_view(), name='available-accessors'),
    path('senior-valuers/', views.AvailableSeniorValuersView.as_view(), name='available-senior-valuers'),
    path('users/<int:user_id>/projects/<str:role_type>/', views.UserAssignedProjectsView.as_view(), name='user-assigned-projects'),
    path('documents/', views.ProjectDocumentView.as_view(), name='project-document-create'),
    path('documents/<int:pk>/', views.ProjectDocumentDeleteView.as_view(), name='project-document-delete'),
    path('<int:pk>/md-gm-approve/', views.md_gm_approve_project, name='md-gm-approve-project'),
    path('<int:pk>/md-gm-reject/', views.md_gm_reject_project, name='md-gm-reject-project'),
    # Admin approval endpoints (for direct projects without submission)
    path('<int:pk>/admin-approve/', views.admin_approve_project, name='admin-approve-project'),
    path('<int:pk>/admin-reject/', views.admin_reject_project, name='admin-reject-project'),
    path('<int:pk>/request-admin-approval/', views.request_admin_approval, name='request-admin-approval'),
    path('admin-pending-projects/', views.admin_pending_projects, name='admin-pending-projects'),
    # Payment workflow endpoints
    path('<int:project_id>/send-payment-request/', views.SendPaymentRequestView.as_view(), name='send-payment-request'),
    path('<int:project_id>/upload-bank-slip/', views.UploadBankSlipView.as_view(), name='upload-bank-slip'),
    path('<int:project_id>/initiate-payhere-payment/', views.InitiatePayHerePaymentView.as_view(), name='initiate-payhere-payment'),
    path('<int:project_id>/approve-payment/', views.ApprovePaymentView.as_view(), name='approve-payment'),
    path('<int:project_id>/reject-payment/', views.RejectPaymentView.as_view(), name='reject-payment'),
    path('<int:project_id>/payment-details/', views.GetPaymentDetailsView.as_view(), name='payment-details'),
    path('<int:project_id>/start-project/', views.StartProjectView.as_view(), name='start-project'),
    path('client-payments/', views.ClientPaymentOverviewView.as_view(), name='client-payments'),
    path('agent-payments/', views.AgentPaymentOverviewView.as_view(), name='agent-payments'),
    path('<int:project_id>/record-agent-payment/', views.RecordAgentPaymentView.as_view(), name='record-agent-payment'),
    path('payhere/notify/', views.PayHerePaymentNotificationView.as_view(), name='payhere-notify'),
    # Cancellation request endpoints
    path('<int:project_id>/request-cancellation/', views.RequestCancellationView.as_view(), name='request-cancellation'),
    path('<int:project_id>/cancellation-status/', views.GetProjectCancellationStatusView.as_view(), name='cancellation-status'),
    path('cancellation-requests/', views.GetCancellationRequestsView.as_view(), name='cancellation-requests'),
    path('cancellation-requests/<int:request_id>/approve/', views.ApproveCancellationView.as_view(), name='approve-cancellation'),
    path('cancellation-requests/<int:request_id>/reject/', views.RejectCancellationView.as_view(), name='reject-cancellation'),
    # Commission report endpoints
    path('<int:project_id>/generate-commission-report/', views.GenerateCommissionReportView.as_view(), name='generate-commission-report'),
    path('commission-reports/<int:report_id>/send/', views.SendCommissionReportView.as_view(), name='send-commission-report'),
    path('agent-commission-reports/', views.AgentCommissionReportsView.as_view(), name='agent-commission-reports'),
    # Visit scheduling (Feature #2)
    path('<int:project_id>/visits/', views.ProjectVisitListCreateView.as_view(), name='project-visits'),
    path('visits/<int:pk>/', views.ProjectVisitDetailView.as_view(), name='project-visit-detail'),
    # Public email role check (Feature #7)
    path('public/check-email/', views.PublicCheckEmailView.as_view(), name='public-check-email'),
]

