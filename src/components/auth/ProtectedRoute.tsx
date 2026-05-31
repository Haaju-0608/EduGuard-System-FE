import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole?: 'user' | 'admin';
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user is trying to access a route not matching their role
  if (allowedRole && user && user.role !== allowedRole) {
    const redirectPath = user.role === 'admin' ? '/admin' : '/profile';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}
