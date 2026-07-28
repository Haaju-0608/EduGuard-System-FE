import React from 'react';
import { Route, Routes } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import ProfileDetailPage from '../UserProfile/sections/ProfileDetailPage';
import StudentOverview from './sections/StudentOverview';
import StudentExamsPage from './sections/StudentExamsPage';
import StudentAttendancePage from './sections/StudentAttendancePage';
import StudentSchedulePage from './sections/StudentSchedulePage';
import StudentExamVerifyPage from './sections/StudentExamVerifyPage';
import StudentExamTakingPage from './sections/StudentExamTakingPage';
import StudentGuidePage from './sections/StudentGuidePage';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard',  path: '/student' },
  { icon: '🗓', label: 'Schedule',   path: '/student/schedule' },
  { icon: '📋', label: 'Attendance', path: '/student/attendance' },
  { icon: '📝', label: 'My Exams',   path: '/student/exams' },
  { icon: '📖', label: 'Exam Guide', path: '/student/guide' },
  { icon: '👤', label: 'My Profile', path: '/student/profile' },
];

// Full-screen pages (no sidebar) — registered in App.tsx directly
export { StudentExamVerifyPage, StudentExamTakingPage };

export default function StudentDashboardPage() {
  return (
    <DashboardLayout menuItems={menuItems} campusMode>
      <Routes>
        <Route index element={<StudentOverview />} />
        <Route path="schedule"   element={<StudentSchedulePage />} />
        <Route path="attendance" element={<StudentAttendancePage />} />
        <Route path="exams"      element={<StudentExamsPage />} />
        <Route path="guide"      element={<StudentGuidePage />} />
        <Route path="profile"    element={<ProfileDetailPage />} />
      </Routes>
    </DashboardLayout>
  );
}
