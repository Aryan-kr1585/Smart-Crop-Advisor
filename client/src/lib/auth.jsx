import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api('/users/me'),
    enabled: Boolean(getToken()),
    retry: false,
  });

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.accessToken);
    queryClient.setQueryData(['me'], data.user);
    return data.user;
  }

  async function logout() {
    try {
      if (getToken()) await api('/auth/logout', { method: 'POST', body: {} });
    } finally {
      setToken(null);
      queryClient.clear();
    }
  }

  const value = {
    user: me.data ?? null,
    loading: Boolean(getToken()) && me.isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
