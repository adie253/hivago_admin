import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
const rawUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const API_URL = rawUrl.endsWith('/api') ? rawUrl : (rawUrl ? `${rawUrl}/api` : '/api');

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    const isLoginRequest = config.url?.includes('/login');
    const isRefreshRequest = config.url?.includes('/refresh');
    
    if (token && config.headers && !isLoginRequest && !isRefreshRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Prevent aggressive browser/proxy caching by appending a timestamp to GET requests
    if (config.method?.toUpperCase() === 'GET') {
      config.params = {
        ...config.params,
        _ts: Date.now()
      };
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

import toast from 'react-hot-toast';

// Response Interceptor
// Response Interceptor
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Extract API validation errors and format them into the message property
    // so all components automatically show them in their existing toast handlers.
    if (error.response?.data) {
      const data = error.response.data;
      
      // Handle standard ASP.NET validation dictionary: { "Email": ["Required"] }
      if (data.errors && typeof data.errors === 'object') {
        const errorMessages = Object.values(data.errors).flat().filter(Boolean);
        if (errorMessages.length > 0) {
          data.message = errorMessages.join(' • ');
        }
      } 
      // Handle custom details array: [{ field: "email", message: "Required" }]
      else if (Array.isArray(data.details) && data.details.length > 0) {
        const errorMessages = data.details.map((d: any) => d.message).filter(Boolean);
        if (errorMessages.length > 0) {
          data.message = errorMessages.join(' • ');
        }
      }
    }

    const isLoginRequest = originalRequest?.url?.includes('/login');
    const isRefreshRequest = originalRequest?.url?.includes('/refresh');

    if (error.response?.status === 401 && !isLoginRequest && !isRefreshRequest) {
      if (originalRequest && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              if (originalRequest.method?.toUpperCase() === 'GET' && originalRequest.params) {
                originalRequest.params._ts = Date.now();
              }
              return apiClient(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
          try {
            const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, {
              headers: {
                Authorization: undefined
              }
            });
            const rawData = response.data;
            const data = rawData?.data || rawData;
            const newToken = data?.accessToken;
            const newExpiresAt = data?.accessTokenExpiresAt;
            const newRefreshToken = data?.refreshToken;

            if (newToken) {
              useAuthStore.getState().extendSession(newExpiresAt, newToken, newRefreshToken);
              processQueue(null, newToken);
              
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              if (originalRequest.method?.toUpperCase() === 'GET' && originalRequest.params) {
                originalRequest.params._ts = Date.now();
              }
              return apiClient(originalRequest);
            }
          } catch (refreshError) {
            processQueue(refreshError, null);
            toast.error('Session expired. Please log in again.');
            useAuthStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          } finally {
            isRefreshing = false;
          }
        }
      }

      // If no refresh token or refresh attempt failed
      toast.error('Session expired. Please log in again.');
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
