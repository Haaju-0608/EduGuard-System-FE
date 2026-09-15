import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminDashboardPage from './pages/AdminDashboard';
import SchoolAdminDashboardPage from './pages/SchoolAdminDashboard';
import LecturerDashboardPage from './pages/LecturerDashboard';
import StudentDashboardPage, { StudentExamVerifyPage, StudentExamTakingPage } from './pages/StudentDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ProctoringTestPage from './pages/DevTools/ProctoringTestPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Trang debug tạm — soi pipeline AI proctoring độc lập, không đụng exam/participation
            nào. Chưa gắn vào sidebar nào cả, cứ vào thẳng URL này khi cần test. */}
        <Route
          path="/proctoring-test"
          element={
            <ProtectedRoute>
              <ProctoringTestPage />
            </ProtectedRoute>
          }
        />

        {/* Full-screen exam flow — placed BEFORE /student/* so they match first */}
        <Route
          path="/student/exams/:examId/verify"
          element={
            <ProtectedRoute allowedRole="user">
              <StudentExamVerifyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/exams/:examId/take"
          element={
            <ProtectedRoute allowedRole="user">
              <StudentExamTakingPage />
            </ProtectedRoute>
          }
        />

        {/* Student dashboard with sidebar */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRole="user">
              <StudentDashboardPage />
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
