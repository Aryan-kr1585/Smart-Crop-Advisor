const TOKEN_KEY = 'ecoquest_token';
const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/v1`;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 401 && !path.startsWith('/auth/login')) setToken(null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Request failed');
    error.status = response.status;
    error.details = data?.error?.details || [];
    throw error;
  }
  return data;
}

export async function apiBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!response.ok) throw new Error('Could not load the file');
  return response.blob();
}

export function homeFor(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'TEACHER') return '/teach';
  return '/learn';
}
