const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('splitwise_jwt');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ? `${data.message || 'Request failed'}: ${data.detail}` : (data.message || 'Request failed'));
  return data;
}

export const api = {
  health: () => request('/health'),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  budgets: () => request('/budgets'),
  createBudget: (body) => request('/budgets', { method: 'POST', body: JSON.stringify(body) }),
  deleteBudget: (id) => request(`/budgets/${id}`, { method: 'DELETE' }),
  expenses: () => request('/expenses'),
  createExpense: (body) => request('/expenses', { method: 'POST', body: JSON.stringify(body) }),
  notifications: () => request('/notifications'),
  markNotification: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotifications: () => request('/notifications/read-all', { method: 'PATCH' })
};
