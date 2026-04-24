import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import realtimeSocket from '../services/realtimeSocket';
import { resolveRoleKey } from '../utils/roleConfig';

const AuthContext = createContext(null);

function normalizeRole(roleValue) {
  if (!roleValue || typeof roleValue !== 'string') return roleValue;
  return roleValue.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

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

      // Also try fetching avatar from profile/me
      let profileImageUrl = null;
      try {
        const meRes = await axiosClient.get('/auth/profile/me/');
        profileImageUrl = meRes.data?.profile?.profile_image_url || null;
      } catch {}

      const userData = { ...profileRes.data, profile_image_url: profileImageUrl };
      setUser(userData);
      setRole(resolveRoleKey(normalizeRole(roleRes.data.role)));
      setPasswordChanged(pwChanged);

      // Init WebSocket
      realtimeSocket.init(token);

      return { passwordChanged: pwChanged };
    } catch (err) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setRole(null);
      setPasswordChanged(true);
      realtimeSocket.disconnect();
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
    return { ...data, passwordChanged: !data.password_change_required };
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setRole(null);
    setPasswordChanged(true);
    realtimeSocket.disconnect();
  };

  const updateUser = (newUserData) => {
    setUser((prev) => ({ ...prev, ...newUserData }));
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, role, passwordChanged, loading, login, logout, isAuthenticated, refreshUser: fetchUserData, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
