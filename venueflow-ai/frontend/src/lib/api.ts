import axios from 'axios';
import { getApiBaseUrl } from './runtime';

const getStoredToken = () => {
  const directToken = localStorage.getItem('venueflow-token');
  if (directToken) return directToken;

  const persistedAuth = localStorage.getItem('venueflow-auth');
  if (!persistedAuth) return null;

  try {
    const parsed = JSON.parse(persistedAuth);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('venueflow-token');
      localStorage.removeItem('venueflow-user');
      localStorage.removeItem('venueflow-auth');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/' && window.location.pathname !== '/demo') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
