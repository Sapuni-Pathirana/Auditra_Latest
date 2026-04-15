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
    high: '#0D47A1',
    medium: '#1E88E5',
    low: '#1565C0',
  };
  return colors[priority] || '#64748B';
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.toUpperCase();
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
