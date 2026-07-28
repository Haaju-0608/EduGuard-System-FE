import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';
import DashboardOverview from './sections/DashboardOverview';
import UserManagementPage from './sections/UserManagementPage';
import ReportsPage from './sections/ReportsPage';
import CreditsPage from './sections/CreditsPage';
import InstitutionsPage from './sections/InstitutionsPage';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/admin' },
  { icon: '🏫', label: 'Institutions', path: '/admin/institutions' },
  { icon: '👥', label: 'Users', path: '/admin/users' },
  { icon: '💳', label: 'Credits', path: '/admin/credits' },
  { icon: '📊', label: 'Reports', path: '/admin/reports' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-7xl mx-auto w-full animate-fade-slide-in">
        <Routes>
          <Route index element={<DashboardOverview onNavigate={navigate} />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Routes>
      </div>
    </DashboardLayout>
  );
}
