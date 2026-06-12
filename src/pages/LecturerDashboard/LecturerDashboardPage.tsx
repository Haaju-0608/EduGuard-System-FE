import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import ClassManagementPage from './sections/ClassManagementPage';
import StudentManagementPage from './sections/StudentManagementPage';
import AttendanceSessionPage from './sections/AttendanceSessionPage';
import BiometricApprovalPage from './sections/BiometricApprovalPage';
import ExamSlotsPage from './sections/ExamSlotsPage';
import LecturerNotFoundPage from './sections/NotFoundPage';

/** Menu sidebar cho role giảng viên */
const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/lecture' },
  { icon: '📚', label: 'Classes', path: '/lecture/classes' },
  { icon: '👥', label: 'Students', path: '/lecture/students' },
  { icon: '📋', label: 'Attendance', path: '/lecture/attendance' },
  { icon: '📝', label: 'Exams', path: '/lecture/exams' },
  { icon: '🔐', label: 'Biometrics', path: '/lecture/biometric' },
];

/** Layout chính dashboard giảng viên — điều hướng các trang con */
export default function LecturerDashboardPage() {
  return (
    <DashboardLayout menuItems={menuItems} campusMode>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="classes" element={<ClassManagementPage />} />
        <Route path="students" element={<StudentManagementPage />} />
        <Route path="attendance" element={<AttendanceSessionPage />} />
        <Route path="exams" element={<ExamSlotsPage />} />
        <Route path="biometric" element={<BiometricApprovalPage />} />
        <Route path="*" element={<LecturerNotFoundPage />} />
      </Routes>
    </DashboardLayout>
  );
}
