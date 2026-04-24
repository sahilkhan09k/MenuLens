import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On app load: check if we have tokens in localStorage
    // If access token exists, fetch profile. If 401, try refresh.
    const rehydrate = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!accessToken && !refreshToken) {
        // No tokens at all — definitely logged out
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/api/user/profile', { _skipRefresh: true });
        setUser(res.data.user);
      } catch (err) {
        if (err.response?.status === 401 && refreshToken) {
          // Access token expired — try to refresh
          try {
            const refreshRes = await api.post('/api/auth/refresh-token', { refreshToken });
            localStorage.setItem('accessToken', refreshRes.data.accessToken);
            localStorage.setItem('refreshToken', refreshRes.data.refreshToken);

            const profileRes = await api.get('/api/user/profile', { _skipRefresh: true });
            setUser(profileRes.data.user);
          } catch {
            // Refresh failed — clear tokens
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    rehydrate();
  }, []);

  const login = (userData, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const updateUser = (partial) => setUser(prev => ({ ...prev, ...partial }));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
