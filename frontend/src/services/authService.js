import { apiRequest } from './http.js';

export const authService = {
  me: async () => apiRequest('/auth/me'),

  login: async (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),

  register: async (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),

  logout: async () => apiRequest('/auth/logout', { method: 'POST' }),
};
