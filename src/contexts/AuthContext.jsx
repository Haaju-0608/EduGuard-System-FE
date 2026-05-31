import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(undefined);

// ── Mock User Database ──
const MOCK_USERS = [
  {
    id: 1,
    email: 'user@eduguard.com',
    password: '123456',
    role: 'user',
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
    role: 'admin',
    name: 'Le Quang Minh',
    studentId: null,
    department: 'System Administration',
    avatar: null,
    initials: 'LM',
  },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
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

  const login = (email, password) => {
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
