import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import UserProfilePage from './pages/UserProfile';
import AdminDashboardPage from './pages/AdminDashboard';
import SchoolAdminDashboardPage from './pages/SchoolAdminDashboard';
import LecturerDashboardPage from './pages/LecturerDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';

const AiProctoringPrototypePage = lazy(() => import('./pages/UserProfile/sections/AiProctoringPrototypePage'));

function AiPrototypeRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy text-white-soft grid place-items-center">Loading AI prototype...</div>}>
      <div className="min-h-screen bg-navy p-4 md:p-6">
        <div className="max-w-350 mx-auto">
          <AiProctoringPrototypePage />
        </div>
      </div>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ai-proctoring-prototype" element={<AiPrototypeRoute />} />
        <Route
          path="/profile/*"
          element={
            <ProtectedRoute allowedRole="user">
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/school/*"
          element={
            <ProtectedRoute allowedRole="schooladmin">
              <SchoolAdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lecture/*"
          element={
            <ProtectedRoute allowedRole="lecture">
              <LecturerDashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
