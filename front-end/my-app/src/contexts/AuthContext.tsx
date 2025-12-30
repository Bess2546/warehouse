// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: number;
  name: string;
  code: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'user';
  organizationId?: number;
  organization?: Organization;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', 
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      setAccessToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      return true;
    } catch (error) {
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem('user');
      
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      // ลองดึง user จาก localStorage ก่อน (hydration)
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }

      const success = await refreshToken();
      if (!success && savedUser) {
        setUser(null);
        localStorage.removeItem('user');
      }

      setIsLoading(false);
    };

    initAuth();
  }, [refreshToken]);

  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      refreshToken();
    }, 25 * 60 * 1000); // 25 นาที

    return () => clearInterval(interval);
  }, [accessToken, refreshToken]);

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', 
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'เข้าสู่ระบบล้มเหลว');
    }

    const data = await response.json();
    setAccessToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));

    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('user');
    
    router.push('/login');
  };

  // ==================== LOGOUT ALL DEVICES ====================
  const logoutAllDevices = async () => {
    try {
      await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Logout all error:', error);
    }

    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('user');
    
    router.push('/login');
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        accessToken,
        isLoading, 
        login, 
        logout,
        logoutAllDevices,
        refreshToken,
        isSuperAdmin, 
        isAdmin 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ==================== FETCH WITH AUTO REFRESH ====================
export async function fetchWithAuth(
  url: string, 
  options: RequestInit = {},
  getToken: () => string | null,
  onRefresh: () => Promise<boolean>,
  onLogout: () => void,
) {
  let token = getToken();
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
    },
  });

  if (response.status === 401) {
    const refreshed = await onRefresh();

    if (refreshed) {
      token = getToken();
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
    } else {
      onLogout();
    }
  }

  return response;
}