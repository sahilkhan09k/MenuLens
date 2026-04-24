import axios from 'axios';

// In production: requests go to /api/* which Vercel proxies to Render backend
// This makes cookies first-party and solves cross-origin session persistence
// In development: requests go directly to localhost:5000
const baseURL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000')
  : '';  // empty = relative URLs, proxied by Vercel

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Response interceptor: on 401, attempt refresh, retry once
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve());
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest.url?.includes('/api/auth/');
    const isProfileCheck = originalRequest.url?.includes('/api/user/profile') || originalRequest._skipRefresh;

    // Skip refresh for auth routes and the initial profile rehydration check
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute && !isProfileCheck) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest)).catch(err => Promise.reject(err));
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await api.post('/api/auth/refresh-token');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Only redirect if not already on login page to prevent reload loop
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
