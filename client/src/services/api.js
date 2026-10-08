import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bookleaf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bookleaf_token');
      localStorage.removeItem('bookleaf_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

let socket = null;
export function getSocket() {
  if (socket) return socket;
  const token = localStorage.getItem('bookleaf_token');
  const socketUrl = import.meta.env.VITE_SOCKET_URL || undefined;
  socket = io(socketUrl, { auth: { token } });
  return socket;
}
export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const booksApi = {
  list: () => api.get('/books'),
};

export const ticketsApi = {
  list: (params) => api.get('/tickets', { params }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  reply: (id, text) => api.post(`/tickets/${id}/messages`, { text }),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  updateTicket: (id, data) => api.patch(`/admin/tickets/${id}`, data),
  addNote: (id, text) => api.post(`/admin/tickets/${id}/notes`, { text }),
  regenerateDraft: (id) => api.post(`/admin/tickets/${id}/regenerate-draft`),
};

export default api;
