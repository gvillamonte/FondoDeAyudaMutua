import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Si no hay respuesta del servidor (error de red, conexión rechazada o caída)
    if (!error.response) {
      const baseUrl = error.config?.baseURL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const requestedUrl = error.config?.url || '';
      const fullUrl = requestedUrl.startsWith('http')
        ? requestedUrl
        : `${baseUrl.replace(/\/$/, '')}/${requestedUrl.replace(/^\//, '')}`;

      error.isConnectionError = true;
      error.targetUrl = fullUrl;
      error.friendlyMessage = `No se pudo conectar con el servidor en ${fullUrl}. Verifique que el backend esté activo y que la red/puerto sean accesibles.`;
      if (typeof console !== 'undefined') {
        console.error(`[API Conexión Fallida]`, {
          url: fullUrl,
          code: error.code,
          message: error.message,
        });
      }
    }

    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (typeof window === 'undefined') return Promise.reject(error);

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshUrl = `${(process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '')}/auth/refresh`;
        const { data } = await axios.post(
          refreshUrl,
          { refreshToken },
        );

        const newToken = data.accessToken;
        const newRefreshToken = data.refreshToken || refreshToken;

        localStorage.setItem('accessToken', newToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
