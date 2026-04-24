import 'valuation_model.dart';

class Project {
  final int id;
  final String title;
  final String? description;
  final int coordinatorId;
  final String coordinatorUsername;
  final String? coordinatorName;
  final int? assignedFieldOfficerId;
  final String? assignedFieldOfficerUsername;
  final String? assignedFieldOfficerName;
  final String? assignedFieldOfficerEmail;
  final int? assignedClientId;
  final String? assignedClientUsername;
  final String? assignedClientName;
  final String? assignedClientEmail;
  final int? assignedAgentId;
  final String? assignedAgentUsername;
  final String? assignedAgentName;
  final String? assignedAgentEmail;
  final int? assignedAccessorId;
  final String? assignedAccessorUsername;
  final String? assignedAccessorName;
  final String? assignedAccessorEmail;
  final int? assignedSeniorValuerId;
  final String? assignedSeniorValuerUsername;
  final String? assignedSeniorValuerName;
  final String? assignedSeniorValuerEmail;
  final bool hasAgent;
  final Map<String, dynamic>? clientInfo;
  final Map<String, dynamic>? agentInfo;
  final String? priority;
  final String status;
  final String statusDisplay;
  final String? workflowStage;
  final DateTime? startDate;
  final DateTime? endDate;
  /// Earliest upcoming scheduled site visit (valuation) from API (`next_scheduled_visit`, ISO date).
  final String? nextScheduledVisit;
  final List<ProjectDocument> documents;
  final int documentsCount;
  final List<Valuation> valuations;
  final int valuationsCount;
  final String? mdGmApprovalStatus;
  final String? mdGmApprovalStatusDisplay;
  final String? mdGmRejectionReason;
  final DateTime? mdGmApprovedAt;
  final DateTime? mdGmRejectedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  Project({
    required this.id,
    required this.title,
    this.description,
    required this.coordinatorId,
    required this.coordinatorUsername,
    this.coordinatorName,
    this.assignedFieldOfficerId,
    this.assignedFieldOfficerUsername,
    this.assignedFieldOfficerName,
    this.assignedFieldOfficerEmail,
    this.assignedClientId,
    this.assignedClientUsername,
    this.assignedClientName,
    this.assignedClientEmail,
    this.assignedAgentId,
    this.assignedAgentUsername,
    this.assignedAgentName,
    this.assignedAgentEmail,
    this.assignedAccessorId,
    this.assignedAccessorUsername,
    this.assignedAccessorName,
    this.assignedAccessorEmail,
    this.assignedSeniorValuerId,
    this.assignedSeniorValuerUsername,
    this.assignedSeniorValuerName,
    this.assignedSeniorValuerEmail,
    this.hasAgent = false,
    this.clientInfo,
    this.agentInfo,
    this.priority,
    required this.status,
    required this.statusDisplay,
    this.workflowStage,
    this.startDate,
    this.endDate,
    this.nextScheduledVisit,
    required this.documents,
    required this.documentsCount,
    required this.valuations,
    required this.valuationsCount,
    this.mdGmApprovalStatus,
    this.mdGmApprovalStatusDisplay,
    this.mdGmRejectionReason,
    this.mdGmApprovedAt,
    this.mdGmRejectedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    // Helper to safely parse int values
    int? parseIntSafely(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is String) return int.tryParse(value);
      if (value is double) return value.toInt();
      return null;
    }

    // Parse required int fields with validation
    final id = parseIntSafely(json['id']);
    final coordinatorId = parseIntSafely(json['coordinator']);

    if (id == null) {
      throw FormatException('Required field "id" is null or cannot be parsed in Project JSON: ${json['id']}');
    }
    if (coordinatorId == null) {
      throw FormatException('Required field "coordinator" is null or cannot be parsed in Project JSON: ${json['coordinator']}');
    }

    // Parse valuations safely, skipping any that fail to parse
    List<Valuation> valuations = [];
    if (json['valuations'] != null && json['valuations'] is List) {
      for (var valJson in json['valuations']) {
        try {
          valuations.add(Valuation.fromJson(valJson));
        } catch (e) {
          print('Warning: Failed to parse valuation: $e');
          // Continue with other valuations
        }
      }
    }

    return Project(
      id: id,
      title: json['title'] ?? '',
      description: json['description'],
      coordinatorId: coordinatorId,
      coordinatorUsername: json['coordinator_username'] ?? '',
      coordinatorName: json['coordinator_name'],
      assignedFieldOfficerId: parseIntSafely(json['assigned_field_officer']),
      assignedFieldOfficerUsername: json['assigned_field_officer_username'],
      assignedFieldOfficerName: json['assigned_field_officer_name'],
      assignedFieldOfficerEmail: json['assigned_field_officer_email'],
      assignedClientId: json['assigned_client'],
      assignedClientUsername: json['assigned_client_username'],
      assignedClientName: json['assigned_client_name'],
      assignedClientEmail: json['assigned_client_email'],
      assignedAgentId: json['assigned_agent'],
      assignedAgentUsername: json['assigned_agent_username'],
      assignedAgentName: json['assigned_agent_name'],
      assignedAgentEmail: json['assigned_agent_email'],
      assignedAccessorId: json['assigned_accessor'],
      assignedAccessorUsername: json['assigned_accessor_username'],
      assignedAccessorName: json['assigned_accessor_name'],
      assignedAccessorEmail: json['assigned_accessor_email'],
      assignedSeniorValuerId: json['assigned_senior_valuer'],
      assignedSeniorValuerUsername: json['assigned_senior_valuer_username'],
      assignedSeniorValuerName: json['assigned_senior_valuer_name'],
      assignedSeniorValuerEmail: json['assigned_senior_valuer_email'],
      hasAgent: json['has_agent'] ?? false,
      clientInfo: json['client_info'] != null ? Map<String, dynamic>.from(json['client_info']) : null,
      agentInfo: json['agent_info'] != null ? Map<String, dynamic>.from(json['agent_info']) : null,
      priority: (json['priority'] ?? 'medium').toString(),
      status: json['status'] ?? 'pending',
      statusDisplay: json['status_display'] ?? 'Pending',
      workflowStage: json['workflow_stage'],
      startDate: json['start_date'] != null ? DateTime.parse(json['start_date']) : null,
      endDate: json['end_date'] != null ? DateTime.parse(json['end_date']) : null,
      nextScheduledVisit: json['next_scheduled_visit'] as String?,
      documents: (json['documents'] as List<dynamic>?)
          ?.map((doc) {
            try {
              return ProjectDocument.fromJson(doc);
            } catch (e) {
              print('Warning: Failed to parse document: $e');
              return null;
            }
          })
          .whereType<ProjectDocument>()
          .toList() ?? [],
      documentsCount: parseIntSafely(json['documents_count']) ?? 0,
      valuations: valuations,
      valuationsCount: parseIntSafely(json['valuations_count']) ?? valuations.length,
      mdGmApprovalStatus: json['md_gm_approval_status'],
      mdGmApprovalStatusDisplay: json['md_gm_approval_status_display'],
      mdGmRejectionReason: json['md_gm_rejection_reason'],
      mdGmApprovedAt: json['md_gm_approved_at'] != null ? DateTime.parse(json['md_gm_approved_at']) : null,
      mdGmRejectedAt: json['md_gm_rejected_at'] != null ? DateTime.parse(json['md_gm_rejected_at']) : null,
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
    );
  }

  bool get isAssigned => assignedFieldOfficerId != null;
  bool get isPending => status == 'pending';
  bool get isInProgress => status == 'in_progress';
  bool get isCompleted => status == 'completed';

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'coordinator': coordinatorId,
      'coordinator_username': coordinatorUsername,
      'coordinator_name': coordinatorName,
      'assigned_field_officer': assignedFieldOfficerId,
      'assigned_field_officer_username': assignedFieldOfficerUsername,
      'assigned_field_officer_name': assignedFieldOfficerName,
      'assigned_field_officer_email': assignedFieldOfficerEmail,
      'assigned_client': assignedClientId,
      'assigned_client_username': assignedClientUsername,
      'assigned_client_name': assignedClientName,
      'assigned_client_email': assignedClientEmail,
      'assigned_agent': assignedAgentId,
      'assigned_agent_username': assignedAgentUsername,
      'assigned_agent_name': assignedAgentName,
      'assigned_agent_email': assignedAgentEmail,
      'assigned_accessor': assignedAccessorId,
      'assigned_accessor_username': assignedAccessorUsername,
      'assigned_accessor_name': assignedAccessorName,
      'assigned_accessor_email': assignedAccessorEmail,
      'assigned_senior_valuer': assignedSeniorValuerId,
      'assigned_senior_valuer_username': assignedSeniorValuerUsername,
      'assigned_senior_valuer_name': assignedSeniorValuerName,
      'assigned_senior_valuer_email': assignedSeniorValuerEmail,
      'has_agent': hasAgent,
      'client_info': clientInfo,
      'agent_info': agentInfo,
      'priority': priority,
      'status': status,
      'status_display': statusDisplay,
      'workflow_stage': workflowStage,
      'start_date': startDate?.toIso8601String(),
      'end_date': endDate?.toIso8601String(),
      'next_scheduled_visit': nextScheduledVisit,
      'documents': documents.map((doc) => doc.toJson()).toList(),
      'documents_count': documentsCount,
      'valuations': valuations.map((val) => _valuationToJson(val)).toList(),
      'valuations_count': valuationsCount,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  // Helper to convert Valuation to JSON (simplified)
  Map<String, dynamic> _valuationToJson(Valuation val) {
    return {
      'id': val.id,
      'project': val.projectId,
      'category': val.category,
      'status': val.status,
      'description': val.description,
      'estimated_value': val.estimatedValue,
      // Add other fields as needed
    };
  }
}

class ProjectDocument {
  final int id;
  final int projectId;
  final String? fileUrl;
  final int? fileSize;
  final String name;
  final String? description;
  final int? uploadedById;
  final String? uploadedByUsername;
  final int? assignedToId;
  final String? assignedToUsername;
  final String? assignedToName;
  final DateTime uploadedAt;

  ProjectDocument({
    required this.id,
    required this.projectId,
    this.fileUrl,
    this.fileSize,
    required this.name,
    this.description,
    this.uploadedById,
    this.uploadedByUsername,
    this.assignedToId,
    this.assignedToUsername,
    this.assignedToName,
    required this.uploadedAt,
  });

  factory ProjectDocument.fromJson(Map<String, dynamic> json) {
    // Helper to safely parse int values
    int? parseIntSafely(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is String) return int.tryParse(value);
      if (value is double) return value.toInt();
      return null;
    }

    final id = parseIntSafely(json['id']);
    final projectId = parseIntSafely(json['project']);

    if (id == null) {
      throw FormatException('Required field "id" is null or cannot be parsed in ProjectDocument JSON: ${json['id']}');
    }
    if (projectId == null) {
      throw FormatException('Required field "project" is null or cannot be parsed in ProjectDocument JSON: ${json['project']}');
    }

    return ProjectDocument(
      id: id,
      projectId: projectId,
      fileUrl: json['file_url'],
      fileSize: parseIntSafely(json['file_size']),
      name: json['name'] ?? 'Unknown Document',
      description: json['description'],
      uploadedById: parseIntSafely(json['uploaded_by']),
      uploadedByUsername: json['uploaded_by_username'],
      assignedToId: json['assigned_to'],
      assignedToUsername: json['assigned_to_username'],
      assignedToName: json['assigned_to_name'],
      uploadedAt: DateTime.parse(json['uploaded_at']),
    );
  }

  String get fileSizeFormatted {
    if (fileSize == null) return 'Unknown size';
    if (fileSize! < 1024) return '${fileSize}B';
    if (fileSize! < 1024 * 1024) return '${(fileSize! / 1024).toStringAsFixed(1)}KB';
    return '${(fileSize! / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'project': projectId,
      'file_url': fileUrl,
      'file_size': fileSize,
      'name': name,
      'description': description,
      'uploaded_by': uploadedById,
      'uploaded_by_username': uploadedByUsername,
      'assigned_to': assignedToId,
      'assigned_to_username': assignedToUsername,
      'assigned_to_name': assignedToName,
      'uploaded_at': uploadedAt.toIso8601String(),
    };
  }
}

class FieldOfficer {
  final int id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String fullName;
  final int assignedProjectsCount;

  FieldOfficer({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    required this.fullName,
    required this.assignedProjectsCount,
  });

  factory FieldOfficer.fromJson(Map<String, dynamic> json) {
    return FieldOfficer(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      fullName: json['full_name'] ?? json['username'],
      assignedProjectsCount: json['assigned_projects_count'] ?? 0,
    );
  }
}

class Client {
  final int id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String fullName;
  final int assignedProjectsCount;

  Client({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    required this.fullName,
    required this.assignedProjectsCount,
  });

  factory Client.fromJson(Map<String, dynamic> json) {
    return Client(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      fullName: json['full_name'] ?? json['username'],
      assignedProjectsCount: json['assigned_projects_count'] ?? 0,
    );
  }
}

class Agent {
  final int id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String fullName;
  final int assignedProjectsCount;

  Agent({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    required this.fullName,
    required this.assignedProjectsCount,
  });

  factory Agent.fromJson(Map<String, dynamic> json) {
    return Agent(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      fullName: json['full_name'] ?? json['username'],
      assignedProjectsCount: json['assigned_projects_count'] ?? 0,
    );
  }
}

class Accessor {
  final int id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String fullName;
  final int assignedProjectsCount;

  Accessor({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    required this.fullName,
    required this.assignedProjectsCount,
  });

  factory Accessor.fromJson(Map<String, dynamic> json) {
    return Accessor(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      fullName: json['full_name'] ?? json['username'],
      assignedProjectsCount: json['assigned_projects_count'] ?? 0,
    );
  }
}

class SeniorValuer {
  final int id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String fullName;
  final int assignedProjectsCount;

  SeniorValuer({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    required this.fullName,
    required this.assignedProjectsCount,
  });

  factory SeniorValuer.fromJson(Map<String, dynamic> json) {
    return SeniorValuer(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      fullName: json['full_name'] ?? json['username'],
      assignedProjectsCount: json['assigned_projects_count'] ?? 0,
    );
  }
}

