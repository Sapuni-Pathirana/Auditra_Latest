import axiosClient from '../api/axiosClient';

const attendanceService = {
  markAttendance: () =>
    axiosClient.post('/attendance/mark/'),

  checkout: () =>
    axiosClient.post('/attendance/checkout/'),

  leaveEarly: () =>
    axiosClient.post('/attendance/leave-early/'),

  startOvertime: () =>
    axiosClient.post('/attendance/overtime/start/'),

  endOvertime: () =>
    axiosClient.post('/attendance/overtime/end/'),

  getToday: () =>
    axiosClient.get('/attendance/today/'),

  getSummary: (params) =>
    axiosClient.get('/attendance/summary/', { params }),

  getWeeklySummary: () =>
    axiosClient.get('/attendance/summary/weekly/'),

  getHRAttendanceSummary: (period = 'daily') =>
    axiosClient.get('/attendance/summary/hr/', { params: { period } }),

  getMyAttendances: () =>
    axiosClient.get('/attendance/my-attendances/'),
};

export default attendanceService;
