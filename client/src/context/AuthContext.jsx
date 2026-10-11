import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [availablePlatforms, setAvailablePlatforms] = useState(() => {
    const saved = localStorage.getItem('availablePlatforms');
    return saved ? JSON.parse(saved) : [];
  });

  const [activePlatform, setActivePlatform] = useState(() => {
    const saved = localStorage.getItem('activePlatform');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(true);

  // Initialize session verification
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          const profile = res.data.data.user;
          const platforms = res.data.data.availablePlatforms;
          setUser(prev => ({ ...prev, ...profile }));
          setAvailablePlatforms(platforms);
          localStorage.setItem('availablePlatforms', JSON.stringify(platforms));

          // Ensure active platform is still valid
          setActivePlatform(current => {
            if (!current && platforms.length > 0) {
              const defaultP = profile.isSuperAdmin
                ? { id: 'ALL', code: 'ALL', name: 'All Platforms', isAll: true }
                : platforms[0];
              localStorage.setItem('activePlatform', JSON.stringify(defaultP));
              return defaultP;
            }
            return current;
          });
        }
      } catch (err) {
        console.error('Session validation error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.data?.success) {
        const { token, refreshToken, user: userData, activePlatform: pData, availablePlatforms: pList } = res.data.data;

        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('activePlatform', JSON.stringify(pData));
        localStorage.setItem('availablePlatforms', JSON.stringify(pList));

        setUser(userData);
        setActivePlatform(pData);
        setAvailablePlatforms(pList);
        return { success: true };
      }
      return { success: false, message: res.data?.message || 'Login failed' };
    } catch (err) {
      return {
        success: false,
        code: err.response?.data?.code || 'AUTH_ERROR',
        message: err.response?.data?.message || 'Network error or invalid credentials.'
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('activePlatform');
      localStorage.removeItem('availablePlatforms');
      setUser(null);
      setActivePlatform(null);
      setAvailablePlatforms([]);
      window.location.href = '/login';
    }
  };

  // Switch Active Platform
  const switchPlatform = (platformCodeOrObj) => {
    let target = null;
    if (typeof platformCodeOrObj === 'object') {
      target = platformCodeOrObj;
    } else if (platformCodeOrObj === 'ALL' && user?.isSuperAdmin) {
      target = { id: 'ALL', code: 'ALL', name: 'All Platforms', isAll: true };
    } else {
      target = availablePlatforms.find(
        p => p.code?.toUpperCase() === platformCodeOrObj?.toUpperCase() ||
             String(p.id) === String(platformCodeOrObj)
      );
    }

    if (!target) {
      console.warn('Unauthorized platform switch attempt rejected.');
      return false;
    }

    // Update active platform and save
    setActivePlatform(target);
    localStorage.setItem('activePlatform', JSON.stringify(target));

    // Update user's active role for this platform
    if (!user?.isSuperAdmin && target.role) {
      const updatedUser = { ...user, activeRole: target.role };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }

    return true;
  };

  // Refresh available platforms list from backend
  const refreshPlatforms = async () => {
    try {
      const res = await api.get('/platforms');
      if (res.data?.success) {
        const platforms = res.data.data;
        setAvailablePlatforms(platforms);
        localStorage.setItem('availablePlatforms', JSON.stringify(platforms));
        return platforms;
      }
    } catch (e) {
      console.warn('Failed to refresh platforms:', e);
    }
    return availablePlatforms;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activePlatform,
        availablePlatforms,
        loading,
        login,
        logout,
        switchPlatform,
        refreshPlatforms,
        isAuthenticated: !!user && !!localStorage.getItem('token')
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

