import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole?: 'user' | 'admin' | 'lecture';
}

/** Lấy đường dẫn dashboard mặc định theo role */
function getDashboardPath(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'lecture') return '/lecture';
  return '/profile';
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user is trying to access a route not matching their role
  if (allowedRole && user && user.role !== allowedRole) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return children;
}
