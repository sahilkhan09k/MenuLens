import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On app load: try profile, if 401 try refresh first, then profile again
    const rehydrate = async () => {
      try {
        const res = await api.get('/api/user/profile', { _skipRefresh: true });
        setUser(res.data.user);
      } catch (err) {
        if (err.response?.status === 401) {
          // Access token expired — try refresh token before giving up
          try {
            await api.post('/api/auth/refresh-token');
            const res = await api.get('/api/user/profile', { _skipRefresh: true });
            setUser(res.data.user);
          } catch {
            setUser(null); // refresh token also expired or invalid
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

  const login = (userData) => setUser(userData);

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
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
