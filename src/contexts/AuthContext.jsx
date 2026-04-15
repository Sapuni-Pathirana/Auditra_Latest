import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [passwordChanged, setPasswordChanged] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return { passwordChanged: true };
      }

      const [profileRes, roleRes] = await Promise.all([
        axiosClient.get('/auth/profile/'),
        axiosClient.get('/auth/my-role/'),
      ]);

      const pwChanged = roleRes.data.password_changed ?? true;
      setUser(profileRes.data);
      setRole(roleRes.data.role);
      setPasswordChanged(pwChanged);
      return { passwordChanged: pwChanged };
    } catch (err) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setRole(null);
      setPasswordChanged(true);
      return { passwordChanged: true };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const login = async (username, password) => {
    const { data } = await axiosClient.post('/auth/login/', { username, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    const userData = await fetchUserData();
    return { ...data, passwordChanged: userData.passwordChanged };
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setRole(null);
    setPasswordChanged(true);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, role, passwordChanged, loading, login, logout, isAuthenticated, refreshUser: fetchUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
