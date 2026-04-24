export const getStatusColor = (status) => {
  const colors = {
    pending: '#1E88E5',
    pending: '#1E88E5',
    active: '#2563EB',
    in_progress: '#2563EB',
    completed: '#1565C0',
    cancelled: '#0D47A1',
    approved: '#1565C0',
    rejected: '#D32F2F',
    submitted: '#1565C0',
    reviewed: '#0D47A1',
    accepted: '#1565C0',
    md_approved: '#1565C0',
    present: '#1565C0',
    absent: '#D32F2F',
    half_day: '#1E88E5',
  };
  return colors[status] || '#90CAF9';
  return colors[status] || '#90CAF9';
};

export const getPriorityColor = (priority) => {
  const colors = {
    urgent: '#6A1B9A',  // deep purple
    high: '#d32f2f',    // red
    medium: '#ed6c02',  // orange
    low: '#2e7d32',     // green
  };
  return colors[priority] || '#64748B';
};

export const getPriorityBgColor = (priority) => {
  const colors = {
    urgent: '#f3e5f5',
    high: '#fdecea',
    medium: '#fff3e0',
    low: '#e8f5e9',
  };
  return colors[priority] || '#f5f5f5';
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCurrency = (amount) => {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const extractApiErrorMessage = (err, fallback = 'Request failed') => {
  const data = err?.response?.data;

  if (data && typeof data === 'object') {
    if (data.error) return data.error;
    if (data.detail) return data.detail;
    if (data.message) return data.message;

    const msgs = Object.entries(data).map(([key, value]) => {
      const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const message = Array.isArray(value) ? value.join(', ') : value;
      return `${fieldName}: ${message}`;
    });

    if (msgs.length > 0) {
      return msgs.join('\n');
    }
  }

  return err?.message || fallback;
};
