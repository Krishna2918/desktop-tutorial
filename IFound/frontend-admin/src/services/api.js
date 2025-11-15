import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/me'),
};

// Admin Analytics
export const analyticsAPI = {
  getDashboard: () => api.get('/admin/analytics'),
};

// Admin Users
export const usersAPI = {
  getAll: (params) => api.get('/admin/users', { params }),
  verify: (id) => api.put(`/admin/users/${id}/verify`),
  suspend: (id) => api.put(`/admin/users/${id}/suspend`),
};

// Admin Cases
export const casesAPI = {
  getAll: (params) => api.get('/admin/cases', { params }),
  suspend: (id) => api.put(`/admin/cases/${id}/suspend`),
  activate: (id) => api.put(`/admin/cases/${id}/activate`),
};

// Admin Submissions
export const submissionsAPI = {
  getAll: (params) => api.get('/admin/submissions', { params }),
  verify: (id) => api.put(`/submissions/${id}/verify`, { status: 'verified' }),
  reject: (id) => api.put(`/submissions/${id}/verify`, { status: 'rejected' }),
};

// Admin Transactions
export const transactionsAPI = {
  getAll: (params) => api.get('/admin/transactions', { params }),
};

export default api;
