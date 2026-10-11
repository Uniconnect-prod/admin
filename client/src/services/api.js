import axios from 'axios';

// Resolve backend base URL from Vite environment variable
const rawApiUrl = import.meta.env.VITE_API_URL || '';
export const BASE_API_URL = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';

const api = axios.create({
  baseURL: BASE_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: add auth token & active platform headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const activePlatform = localStorage.getItem('activePlatform');
    if (activePlatform) {
      try {
        const parsed = JSON.parse(activePlatform);
        if (parsed?.code) {
          config.headers['x-platform-code'] = parsed.code;
        }
        if (parsed?.id) {
          config.headers['x-platform-id'] = parsed.id;
        }
      } catch (e) {
        // Ignore JSON parse error
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_API_URL}/auth/refresh`, { refreshToken });
          if (res.data?.success && res.data?.data?.token) {
            const newToken = res.data.data.token;
            localStorage.setItem('token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Refresh failed, log out
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

