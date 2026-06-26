import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  clearAuthTokens,
  fetchCurrentUserProfile,
  getAccessToken,
  loginApi,
  mapApiUserToAuthUser,
  saveAuthTokens,
} from '../services/authApi';
import { ApiError } from '../services/apiClient';

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'schooladmin' | 'lecture';
  apiRole: string;
  name: string;
  studentId: string | null;
  department: string;
  phone: string | null;
  avatar: string | null;
  initials: string;
  institutionId: string | null;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('eduguard_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user && !!getAccessToken();

  const refreshProfile = useCallback(async () => {
    if (!getAccessToken()) return;
    const profile = await fetchCurrentUserProfile();
    setUser(mapApiUserToAuthUser(profile));
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('eduguard_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('eduguard_user');
    }
  }, [user]);

  /** Tải lại profile khi mở app (F5) nếu còn token */
  useEffect(() => {
    if (!getAccessToken()) {
      if (user) setUser(null);
      return;
    }
    refreshProfile().catch((e) => {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        clearAuthTokens();
      }
    });
  }, [refreshProfile]);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const data = await loginApi(email, password);
      saveAuthTokens(data.accessToken, data.refreshToken);

      const profile = await fetchCurrentUserProfile();
      const userData = mapApiUserToAuthUser(profile);
      setUser(userData);
      return { success: true, user: userData };
    } catch (e) {
      clearAuthTokens();
      setUser(null);
      const message = e instanceof Error ? e.message : 'Đăng nhập thất bại';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setUser(null);
    clearAuthTokens();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/** Đường dẫn dashboard theo role app */
export function getDashboardPath(role: User['role']): string {
  if (role === 'admin') return '/admin';
  if (role === 'schooladmin') return '/school';
  if (role === 'lecture') return '/lecture';
  return '/profile';
}
