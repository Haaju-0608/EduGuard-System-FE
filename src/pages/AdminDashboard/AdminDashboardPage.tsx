import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import UserManagementPage from './sections/UserManagementPage';
import LiveMonitorPage from './sections/LiveMonitorPage';
import ReportsPage from './sections/ReportsPage';
import CreditsPage from './sections/CreditsPage';
import ApprovalsPage from './sections/ApprovalsPage';
import SettingsPage from './sections/SettingsPage';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/admin' },
  { icon: '👥', label: 'Users', path: '/admin/users' },
  { icon: '📡', label: 'Live Monitor', path: '/admin/live' },
  { icon: '📊', label: 'Reports', path: '/admin/reports' },
  { icon: '💳', label: 'Credits', path: '/admin/credits' },
  { icon: '✅', label: 'Approvals', path: '/admin/approvals' },
  { icon: '⚙️', label: 'Settings', path: '/admin/settings' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-[1400px] mx-auto animate-fade-slide-in">
        <Routes>
          <Route index element={<DashboardOverview onNavigate={navigate} />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="live" element={<LiveMonitorPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
