import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import AttendanceHistoryPage from './sections/AttendanceHistoryPage';
import SchedulePage from './sections/SchedulePage';
import ExamsPage from './sections/ExamsPage';
import ProfileDetailPage from './sections/ProfileDetailPage';
import SettingsPage from './sections/SettingsPage';
import MyClassesPage from './sections/MyClassesPage';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/profile' },
  { icon: '📚', label: 'My Classes', path: '/profile/classes' },
  { icon: '📊', label: 'Attendance', path: '/profile/attendance' },
  { icon: '📅', label: 'Schedule', path: '/profile/schedule' },
  { icon: '📝', label: 'Exams', path: '/profile/exams' },
  { icon: '👤', label: 'My Profile', path: '/profile/me' },
  { icon: '⚙️', label: 'Settings', path: '/profile/settings' },
];

export default function UserProfilePage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-350 mx-auto animate-fade-slide-in">
        <Routes>
          <Route index element={<DashboardOverview onNavigate={navigate} />} />
          <Route path="classes" element={<MyClassesPage />} />
          <Route path="attendance" element={<AttendanceHistoryPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="me" element={<ProfileDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
