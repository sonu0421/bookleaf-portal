import { createContext, useContext, useState, useEffect } from 'react';
import { auth, closeSocket } from '../services/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bookleaf_user') || 'null');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bookleaf_token');
    if (!token) {
      setLoading(false);
      return;
    }
    auth.me()
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('bookleaf_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        localStorage.removeItem('bookleaf_token');
        localStorage.removeItem('bookleaf_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await auth.login(email, password);
    localStorage.setItem('bookleaf_token', res.data.token);
    localStorage.setItem('bookleaf_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('bookleaf_token');
    localStorage.removeItem('bookleaf_user');
    closeSocket();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
