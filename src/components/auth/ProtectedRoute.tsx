import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, getDashboardPath } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole?: 'user' | 'admin' | 'schooladmin' | 'lecture';
}

/** Lấy đường dẫn dashboard mặc định theo role */
function redirectPath(role: string): string {
  if (role === 'admin' || role === 'schooladmin' || role === 'lecture' || role === 'user') {
    return getDashboardPath(role as 'admin' | 'schooladmin' | 'lecture' | 'user');
  }
  return '/profile';
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user && user.role !== allowedRole) {
    return <Navigate to={redirectPath(user.role)} replace />;
  }

  return children;
}
