import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  clearAuthTokens,
  fetchCurrentUserProfile,
  getAccessToken,
  loginApi,
  mapApiUserToAuthUser,
  saveAuthTokens,
} from '../services/authApi';
import { getAuthStorage } from '../services/authStorage';
import { ApiError } from '../services/apiClient';
import { stopAllHubConnections } from '../services/realtimeClient';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

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
  institutionName: string | null;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<LoginResponse>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Nơi lưu (localStorage nếu "Remember me", sessionStorage nếu không — xem authStorage.ts) —
  // luôn cùng 1 nơi với token, để 2 thứ không lệch nhau giữa các lần đăng nhập.
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = getAuthStorage().getItem('eduguard_user');
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
    const active = getAuthStorage();
    const other = active === localStorage ? sessionStorage : localStorage;
    other.removeItem('eduguard_user');
    if (user) {
      active.setItem('eduguard_user', JSON.stringify(user));
    } else {
      active.removeItem('eduguard_user');
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

  const login = async (email: string, password: string, remember = false): Promise<LoginResponse> => {
    try {
      const data = await loginApi(email, password);
      saveAuthTokens(data.accessToken, data.refreshToken, remember);

      const profile = await fetchCurrentUserProfile();
      const userData = mapApiUserToAuthUser(profile);
      setUser(userData);
      return { success: true, user: userData };
    } catch (e) {
      clearAuthTokens();
      setUser(null);
      const message = e instanceof Error ? e.message : 'Login failed.';
      return { success: false, error: message };
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    clearAuthTokens();
    stopAllHubConnections();
  }, []);

  const handleIdle = useCallback(() => {
    logout();
    window.location.href = '/login?reason=idle';
  }, [logout]);

  useIdleTimeout(handleIdle, 10 * 60 * 1000, isAuthenticated);

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
  return '/student';
}
