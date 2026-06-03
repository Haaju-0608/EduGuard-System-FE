import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface User {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'lecture';
  name: string;
  studentId: string | null;
  department: string;
  avatar: string | null;
  initials: string;
}

interface LoginResponse {
  success: boolean;
  error?: string;
  user?: Omit<User, 'password'>;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => LoginResponse;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Mock User Database ──
const MOCK_USERS = [
  {
    id: 1,
    email: 'user@eduguard.com',
    password: '123456',
    role: 'user' as const,
    name: 'Nguyen Van An',
    studentId: '21110001',
    department: 'Information Technology',
    avatar: null,
    initials: 'NA',
  },
  {
    id: 2,
    email: 'admin@eduguard.com',
    password: 'admin123',
    role: 'admin' as const,
    name: 'Le Quang Minh',
    studentId: null,
    department: 'System Administration',
    avatar: null,
    initials: 'LM',
  },
  {
    id: 3,
    email: 'lecture@eduguard.com',
    password: 'lecture123',
    role: 'lecture' as const,
    name: 'Dr. Tran Van Hai',
    studentId: null,
    department: 'Information Technology',
    avatar: null,
    initials: 'TH',
  },
];

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

  const login = (email: string, password: string): LoginResponse => {
    const found = MOCK_USERS.find(
      (u) => u.email === email && u.password === password
    );
    if (!found) {
      return { success: false, error: 'Invalid email or password' };
    }
    // Don't store password in state
    const { password: _, ...userData } = found;
    setUser(userData);
    return { success: true, user: userData };
  };

  const logout = () => {
    setUser(null);
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
