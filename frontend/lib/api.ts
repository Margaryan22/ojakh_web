import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { MOCK_PRODUCTS, MOCK_USER, MOCK_CART_ITEMS } from '@/lib/mock-data';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  timeout: 10000,
  withCredentials: true,
});

// Add Bearer token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Mock data interceptor
if (USE_MOCK_DATA) {
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const config = error.config;
      const url = config.url || '';
      const method = config.method || 'get';

      // Mock products endpoint
      if (url === '/products' && method === 'get') {
        return Promise.resolve({
          data: MOCK_PRODUCTS,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }

      // Mock cart endpoint
      if (url === '/cart' && method === 'get') {
        return Promise.resolve({
          data: { items: MOCK_CART_ITEMS },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }

      // Mock auth check
      if (url === '/auth/me') {
        return Promise.resolve({
          data: MOCK_USER,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }

      // Mock date availability
      if (url.includes('/orders/availability/')) {
        return Promise.resolve({
          data: {
            available: true,
            tortCount: 0,
            maxTorts: 2,
            orderCount: 1,
            maxOrders: 10,
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }

      return Promise.reject(error);
    }
  );

  // Override response interceptor for mock mode
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        useAuthStore.getState().setAccessToken('mock-token');
        return api(originalRequest);
      }
      return Promise.reject(error);
    }
  );
} else {
  // Normal auth refresh flow
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          );
          useAuthStore.getState().setAccessToken(data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
}

export default api;
