import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  clearAuthTokens,
  getInitialsFromName,
  getUserIdFromToken,
  loginApi,
  mapApiRoleToAppRole,
  saveAuthTokens,
} from '../services/authApi';

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'lecture';
  apiRole: string;
  name: string;
  studentId: string | null;
  department: string;
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

  const isAuthenticated = !!user;

  useEffect(() => {
    if (user) {
      localStorage.setItem('eduguard_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('eduguard_user');
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const data = await loginApi(email, password);

      saveAuthTokens(data.accessToken, data.refreshToken);

      const userData: User = {
        id: getUserIdFromToken(data.accessToken),
        email: email.trim(),
        role: mapApiRoleToAppRole(data.role),
        apiRole: data.role,
        name: data.fullName?.trim() || email.trim(),
        studentId: null,
        department: data.role,
        avatar: null,
        initials: getInitialsFromName(data.fullName || email),
        institutionId: data.institutionId,
      };

      setUser(userData);
      return { success: true, user: userData };
    } catch (e) {
      clearAuthTokens();
      const message = e instanceof Error ? e.message : 'Đăng nhập thất bại';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setUser(null);
    clearAuthTokens();
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
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
  if (role === 'lecture') return '/lecture';
  return '/profile';
}
