import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data)
};

// Videos API
export const videosAPI = {
  getAll: (params) => api.get('/videos', { params }),
  getFeatured: () => api.get('/videos/featured'),
  getTrending: () => api.get('/videos/trending'),
  getNewReleases: () => api.get('/videos/new-releases'),
  getById: (id) => api.get(`/videos/${id}`),
  getByGenre: (genre) => api.get(`/videos/genre/${genre}`),
  search: (query) => api.get(`/videos/search/${query}`)
};

// Watch History API
export const watchAPI = {
  getHistory: (profileIndex) => api.get('/watch/history', { params: { profileIndex } }),
  updateProgress: (data) => api.post('/watch/history', data),
  getMyList: (profileIndex) => api.get('/watch/mylist', { params: { profileIndex } }),
  addToMyList: (data) => api.post('/watch/mylist', data),
  removeFromMyList: (videoId, profileIndex) => api.delete(`/watch/mylist/${videoId}`, { params: { profileIndex } })
};

// Categories API
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  getBySlug: (slug) => api.get(`/categories/${slug}`)
};

export default api;
